document.addEventListener('DOMContentLoaded', async () => {

    const SUPABASE_URL = 'https://adyqqfkwgdzanpgsvzgl.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkeXFxZmt3Z2R6YW5wZ3N2emdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NTM1NTgsImV4cCI6MjA2NzEyOTU1OH0.rfFekXWr933GcjA2JZQ2gvUObS3zuzctDQZvZfopP2g';

    const appContainer = document.getElementById('appContainer');
    const tg = window.Telegram.WebApp;
    tg.ready();

    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase client created.");

    // --- ГЛАВНАЯ ФУНКЦИЯ ---
    async function main() {
        showLoader("Проверка доступа...");
        console.log("Main function started.");

        const user = tg.initDataUnsafe?.user;
        if (!user?.id) {
            showError("Не удалось определить пользователя. Пожалуйста, запустите приложение через Telegram.");
            console.error("User ID not found.");
            return;
        }
        console.log("User found:", user.id);

        try {
            console.log("Invoking edge function 'check-and-add-employee'...");
            const { data, error } = await supabaseClient.functions.invoke('check-and-add-employee', {
                body: { user: { id: user.id, first_name: user.first_name } }
            });

            if (error) {
                console.error("Edge function error:", error);
                throw error;
            }
            console.log("Edge function response:", data);

            if (!data.accessGranted) {
                const reason = data.reason === "Account is inactive"
                    ? "Ваш аккаунт деактивирован."
                    : "Вы не состоите в рабочей группе.";
                showError(`Доступ запрещен. ${reason} Обратитесь к руководителю.`);
                console.warn("Access denied:", data.reason);
                return;
            }
            console.log("Access granted.");

            // --- ОТЛАДКА ЗАГРУЗКИ ДАННЫХ ---
            showLoader("Загрузка возражений...");
            console.log("Fetching objections from database...");

            const { data: objections, error: objectionsError, count } = await supabaseClient
                .from('objections')
                .select('*', { count: 'exact' }); // Запрашиваем всё и общее количество

            // Выводим в консоль всё, что получили
            console.log("Objections data:", objections);
            console.log("Objections error:", objectionsError);
            console.log("Objections count:", count);

            if (objectionsError) {
                throw objectionsError;
            }

            console.log(`Successfully fetched ${objections.length} objections.`);
            renderMainInterface(objections, user.first_name);

        } catch (error) {
            console.error("Critical error in main function:", error);
            showError(`Произошла критическая ошибка: ${error.message}`);
        }
    }

    // ... (остальные функции остаются без изменений)
    function showLoader(text) { appContainer.innerHTML = `<div class="loader">${text}</div>`; }
    function showError(text) { appContainer.innerHTML = `<div class="error-screen"><h3>Ошибка</h3><p>${text}</p></div>`; }
    function renderMainInterface(data, userName) { if (tg.colorScheme) { document.body.className = tg.colorScheme; } appContainer.innerHTML = `<h1>Привет, ${userName}!</h1> <p>Поиск по возражениям и скриптам</p> <div class="controls"> <input type="text" id="searchInput" placeholder="Введите ключевое слово для поиска..."> <div class="filters"> <button class="filter-btn active" data-filter="all">Все</button> <button class="filter-btn" data-filter="Упаковка">Упаковка</button> <button class="filter-btn" data-filter="Брокеридж">Брокеридж</button> <button class="filter-btn" data-filter="Скрипты">Скрипты</button> </div> </div> <div id="resultsContainer"></div>`; setupEventListeners(data); }
    function renderResults(results) { const resultsContainer = document.getElementById('resultsContainer'); resultsContainer.innerHTML = ''; if (results.length === 0) { resultsContainer.innerHTML = '<p>Ничего не найдено. Попробуйте изменить запрос или выбрать другую категорию.</p>'; return; } results.forEach(item => { const record = item.item ? item.item : item; const card = document.createElement('div'); card.className = 'item-card'; card.innerHTML = `<h3> ${record.question} <span class="category-badge">${record.category}</span> </h3> <p>${record.answer.replace(/\n/g, '<br>')}</p>`; resultsContainer.appendChild(card); }); }
    function setupEventListeners(data) { const searchInput = document.getElementById('searchInput'); const filterButtons = document.querySelectorAll('.filter-btn'); let currentFilter = 'all'; const fuse = new Fuse(data, { keys: ['question', 'answer'], includeScore: true, threshold: 0.4, }); function performSearch() { const searchTerm = searchInput.value; let dataToSearch = data; if (currentFilter !== 'all') { dataToSearch = data.filter(item => item.category === currentFilter); } if (searchTerm.trim() === '') { renderResults(dataToSearch); return; } const fuseInstance = new Fuse(dataToSearch, { keys: ['question', 'answer'], threshold: 0.4, includeScore: true }); const searchResult = fuseInstance.search(searchTerm); renderResults(searchResult); } searchInput.addEventListener('input', performSearch); filterButtons.forEach(button => { button.addEventListener('click', () => { filterButtons.forEach(btn => btn.classList.remove('active')); button.classList.add('active'); currentFilter = button.getAttribute('data-filter'); performSearch(); }); }); performSearch(); }

    main();
});