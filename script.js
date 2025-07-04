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
    let currentUser; // Сохраним информацию о пользователе здесь
    let userPersonalData = { notes: {}, ratings: {} }; // Здесь будут храниться заметки и рейтинги

    async function main() {
        showLoader("Проверка доступа...");
        const user = tg.initDataUnsafe?.user;
        if (!user?.id) {
            showError("Не удалось определить пользователя. Пожалуйста, запустите приложение через Telegram.");
            return;
        }
        currentUser = user; // Сохраняем пользователя

        try {
            const { data, error } = await supabaseClient.functions.invoke('check-and-add-employee', {
                body: { user: { id: user.id, first_name: user.first_name } }
            });
            if (error) throw error;
            if (!data.accessGranted) {
                showError(`Доступ запрещен. Обратитесь к руководителю.`);
                return;
            }

            // --- НОВЫЙ ШАГ: ЗАГРУЗКА ПЕРСОНАЛЬНЫХ ДАННЫХ ---
            showLoader("Загрузка персональных данных...");
            const { data: personalData, error: personalDataError } = await supabaseClient.functions.invoke('get-user-data', {
                body: { userId: user.id }
            });
            if (personalDataError) throw personalDataError;
            userPersonalData = personalData; // Сохраняем заметки и рейтинги

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
    function showLoader(text) { /* ... */ }
    function showError(text) { /* ... */ }
    function renderMainInterface(data, userName) { /* ... */ }

    function renderResults(results) {
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.innerHTML = '';
        if (!results || results.length === 0) {
            resultsContainer.innerHTML = '<p>Ничего не найдено.</p>';
            return;
        }
        results.forEach(item => {
            const record = item.item ? item.item : item;
            const card = document.createElement('div');
            card.className = 'item-card';

            const userNote = userPersonalData.notes[record.id] || '';
            const userRating = userPersonalData.ratings[record.id] || 0;

            // --- НОВЫЙ HTML ДЛЯ КАРТОЧКИ ---
            card.innerHTML = `
                <h3>${record.question} <span class="category-badge">${record.category}</span></h3>
                <p>${record.answer ? record.answer.replace(/\n/g, '<br>') : ''}</p>
                <div class="user-interaction">
                    <div class="rating-stars" data-objection-id="${record.id}">
                        ${[1, 2, 3, 4, 5].map(star =>
                `<span class="star ${star <= userRating ? 'filled' : ''}" data-value="${star}">★</span>`
            ).join('')}
                    </div>
                    <textarea class="note-input" data-objection-id="${record.id}" placeholder="Ваша личная заметка...">${userNote}</textarea>
                </div>
            `;
            resultsContainer.appendChild(card);
        });
        // После отрисовки навешиваем новые обработчики
        setupInteractionListeners();
    }

    // --- ЛОГИКА ВЗАИМОДЕЙСТВИЯ И ПОИСКА ---

    // Функция для сохранения данных на сервер
    let saveTimeout;
    function saveData(objectionId, dataToSave) {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            try {
                await supabaseClient.functions.invoke('save-user-data', {
                    body: { userId: currentUser.id, objectionId, ...dataToSave }
                });
            } catch (error) {
                console.error("Failed to save data:", error);
                // Можно добавить уведомление пользователю об ошибке сохранения
            }
        }, 1000); // Сохраняем через секунду после последнего изменения
    }

    // Функция для новых обработчиков (заметки и рейтинги)
    function setupInteractionListeners() {
        document.querySelectorAll('.rating-stars').forEach(starsContainer => {
            starsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('star')) {
                    const ratingValue = parseInt(e.target.dataset.value);
                    const objectionId = parseInt(starsContainer.dataset.objectionId);
                    userPersonalData.ratings[objectionId] = ratingValue; // Обновляем локально
                    // Перерисовываем звезды
                    starsContainer.querySelectorAll('.star').forEach(star => {
                        star.classList.toggle('filled', parseInt(star.dataset.value) <= ratingValue);
                    });
                    saveData(objectionId, { rating: ratingValue }); // Отправляем на сервер
                }
            });
        });

        document.querySelectorAll('.note-input').forEach(textarea => {
            textarea.addEventListener('input', (e) => {
                const noteText = e.target.value;
                const objectionId = parseInt(e.target.dataset.objectionId);
                userPersonalData.notes[objectionId] = noteText; // Обновляем локально
                saveData(objectionId, { note: noteText }); // Отправляем на сервер
            });
        });
    }

    function setupEventListeners(data) { /* ... */ }

    // --- КОПИПАСТ СТАРЫХ ФУНКЦИЙ ---
    function showLoader(text) { appContainer.innerHTML = `<div class="loader">${text}</div>`; }
    function showError(text) { appContainer.innerHTML = `<div class="error-screen"><h3>Ошибка</h3><p>${text}</p></div>`; }
    function renderMainInterface(data, userName) { if (tg.colorScheme) { document.body.className = tg.colorScheme; } appContainer.innerHTML = `<h1>Привет, ${userName}!</h1><p>Поиск по возражениям</p><div class="controls"><input type="text" id="searchInput" placeholder="Введите ключевое слово для поиска..."><div class="filters"><button class="filter-btn active" data-filter="all">Все</button><button class="filter-btn" data-filter="Упаковка">Упаковка</button><button class="filter-btn" data-filter="Брокеридж">Брокеридж</button></div></div><div id="resultsContainer"></div>`; setupEventListeners(data); }
    function setupEventListeners(data) { const searchInput = document.getElementById('searchInput'); const filterButtons = document.querySelectorAll('.filter-btn'); let currentFilter = 'all'; const fuseOptions = { keys: ['question'], includeScore: true, threshold: 0.3, minMatchCharLength: 3, ignoreLocation: true, useExtendedSearch: true, }; function performSearch() { const searchTerm = searchInput.value; let dataToSearch = data; if (currentFilter !== 'all') { dataToSearch = data.filter(item => item.category === currentFilter); } if (searchTerm.trim().length < fuseOptions.minMatchCharLength) { renderResults(dataToSearch); return; } const fuseInstance = new Fuse(dataToSearch, fuseOptions); const extendedSearchTerm = searchTerm.split(' ').filter(word => word.length >= fuseOptions.minMatchCharLength).map(word => `'${word}`).join(' | '); const searchResult = fuseInstance.search(extendedSearchTerm); renderResults(searchResult); } searchInput.addEventListener('input', performSearch); filterButtons.forEach(button => { button.addEventListener('click', () => { filterButtons.forEach(btn => btn.classList.remove('active')); button.classList.add('active'); currentFilter = button.getAttribute('data-filter'); performSearch(); }); }); renderResults(data); }

    main();
});