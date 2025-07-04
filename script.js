document.addEventListener('DOMContentLoaded', () => {

    // --- НАСТРОЙКИ ---
    const SUPABASE_URL = 'https://adyqqfkwgdzanpgsvzgl.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkeXFxZmt3Z2R6YW5wZ3N2emdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NTM1NTgsImV4cCI6MjA2NzEyOTU1OH0.rfFekXWr933GcjA2JZQ2gvUObS3zuzctDQZvZfopP2g';
    // -----------------

    const appContainer = document.getElementById('appContainer');
    const tg = window.Telegram.WebApp;
    tg.ready();

    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- ГЛАВНАЯ ФУНКЦИЯ ---
    async function main() {
        showLoader("Проверка доступа...");

        const user = tg.initDataUnsafe?.user;
        if (!user?.id) {
            showError("Не удалось определить пользователя. Пожалуйста, запустите приложение через Telegram.");
            return;
        }

        try {
            const { data, error } = await supabaseClient.functions.invoke('check-and-add-employee', {
                body: { user: { id: user.id, first_name: user.first_name } }
            });

            if (error) throw error;

            if (!data.accessGranted) {
                const reason = data.reason === "Account is inactive" ? "Ваш аккаунт деактивирован." : "Вы не состоите в рабочей группе.";
                showError(`Доступ запрещен. ${reason} Обратитесь к руководителю.`);
                return;
            }

            showLoader("Загрузка возражений...");
            const { data: objections, error: objectionsError } = await supabaseClient
                .from('objections')
                .select('id, category, question, answer');

            if (objectionsError) throw objectionsError;

            renderMainInterface(objections, user.first_name);

        } catch (error) {
            console.error(error);
            showError(`Произошла критическая ошибка: ${error.message}`);
        }
    }

    // --- ФУНКЦИИ ОТОБРАЖЕНИЯ ---
    function showLoader(text) {
        appContainer.innerHTML = `<div class="loader">${text}</div>`;
    }

    function showError(text) {
        appContainer.innerHTML = `<div class="error-screen"><h3>Ошибка</h3><p>${text}</p></div>`;
    }

    function renderMainInterface(data, userName) {
        if (tg.colorScheme) {
            document.body.className = tg.colorScheme;
        }
        appContainer.innerHTML = `
            <h1>Привет, ${userName}!</h1>
            <p>Поиск по возражениям и скриптам</p>
            <div class="controls">
                <input type="text" id="searchInput" placeholder="Введите ключевое слово для поиска...">
                <div class="filters">
                    <button class="filter-btn active" data-filter="all">Все</button>
                    <button class="filter-btn" data-filter="Упаковка">Упаковка</button>
                    <button class="filter-btn" data-filter="Брокеридж">Брокеридж</button>
                </div>
            </div>
            <div id="resultsContainer"></div>
        `;
        setupEventListeners(data);
    }

    function renderResults(results) {
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.innerHTML = '';

        if (!results || results.length === 0) {
            resultsContainer.innerHTML = '<p>Ничего не найдено. Попробуйте изменить запрос или выбрать другую категорию.</p>';
            return;
        }

        results.forEach(item => {
            const record = item.item ? item.item : item;
            const card = document.createElement('div');
            card.className = 'item-card';

            const answerText = record.answer ? record.answer.replace(/\n/g, '<br>') : '';

            card.innerHTML = `
                <h3>
                    ${record.question}
                    <span class="category-badge">${record.category}</span>
                </h3>
                <p>${answerText}</p> 
            `;
            resultsContainer.appendChild(card);
        });
    }

    // --- ЛОГИКА ПОИСКА И ФИЛЬТРОВ ---
    function setupEventListeners(data) {
        const searchInput = document.getElementById('searchInput');
        const filterButtons = document.querySelectorAll('.filter-btn');
        let currentFilter = 'all';

        const fuse = new Fuse(data, {
            keys: ['question'], // ИСПРАВЛЕНО
            includeScore: true,
            threshold: 0.4,
        });

        function performSearch() {
            const searchTerm = searchInput.value;
            let dataToSearch = data;

            if (currentFilter !== 'all') {
                dataToSearch = data.filter(item => item.category === currentFilter);
            }

            if (searchTerm.trim() === '') {
                renderResults(dataToSearch);
                return;
            }

            const fuseInstance = new Fuse(dataToSearch, {
                keys: ['question'], // ИСПРАВЛЕНО
                threshold: 0.4,
                includeScore: true
            });
            const searchResult = fuseInstance.search(searchTerm);
            renderResults(searchResult);
        }

        searchInput.addEventListener('input', performSearch);

        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                currentFilter = button.getAttribute('data-filter');
                performSearch();
            });
        });
        performSearch();
    }

    // Запускаем приложение
    main();
});