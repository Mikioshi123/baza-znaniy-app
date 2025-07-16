document.addEventListener('DOMContentLoaded', () => {

    // --- НАСТРОЙКИ ---
    // 🔴 Не забудьте вставить свои URL и ключ!
    const SUPABASE_URL = 'https://adyqqfkwgdzanpgsvzgl.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkeXFxZmt3Z2R6YW5wZ3N2emdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NTM1NTgsImV4cCI6MjA2NzEyOTU1OH0.rfFekXWr933GcjA2JZQ2gvUObS3zuzctDQZvZfopP2g';
    // -----------------

    // --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
    const appContainer = document.querySelector('.app-content');
    const tg = window.Telegram.WebApp;
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let currentUser;
    let objectionsData = [];
    let gamificationData = { balance: 0, tasks: [], shopItems: [] };
    let currentFilter = 'all';
    let currentSearchTerm = '';

    // --- ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ---
    async function main() {
        tg.ready();
        document.body.className = tg.colorScheme || 'light';
        showLoader("Проверка доступа...");
        currentUser = tg.initDataUnsafe?.user;
        if (!currentUser?.id) {
            showError("Не удалось определить пользователя. Пожалуйста, запустите приложение через Telegram.");
            return;
        }

        try {
            const { data: authData, error: authError } = await supabaseClient.functions.invoke('check-and-add-employee', { body: { user: currentUser } });
            if (authError || !authData.accessGranted) throw new Error(authData.reason || "Доступ запрещен");

            showLoader("Загрузка данных...");
            await loadAllData();

            renderKnowledgeBase(); // По умолчанию показываем базу знаний
            renderGamificationPage(); // Рендерим вторую вкладку в фоне
            setupTabListeners();

        } catch (error) {
            console.error(error);
            showError(`Произошла критическая ошибка: ${error.message}`);
        }
    }

    async function loadAllData() {
        const [gamificationRes, objectionsRes] = await Promise.all([
            supabaseClient.functions.invoke('get-gamification-data', { body: { userId: currentUser.id } }),
            supabaseClient.from('objections').select('*')
        ]);
        if (gamificationRes.error) throw gamificationRes.error;
        if (objectionsRes.error) throw objectionsRes.error;
        gamificationData = gamificationRes.data;
        objectionsData = objectionsRes.data;
    }

    // --- РЕНДЕР ОСНОВНЫХ РАЗДЕЛОВ ---
    function showLoader(text) { appContainer.innerHTML = `<div class="loader">${text}</div>`; }
    function showError(text) { appContainer.innerHTML = `<div class="error-screen"><h3>Ошибка</h3><p>${text}</p></div>`; }

    function renderKnowledgeBase() {
        const kbPanel = document.getElementById('knowledge-base-panel');
        kbPanel.innerHTML = `
            <div class="header">
                <h1>Привет, ${currentUser.first_name}!</h1>
            </div>
            <p>Поиск по возражениям</p>
            <div class="controls">
                <input type="text" id="searchInput" placeholder="Введите ключевое слово для поиска..." value="${currentSearchTerm}">
                <div class="filters">
                    <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">Все</button>
                    <button class="filter-btn ${currentFilter === 'Упаковка' ? 'active' : ''}" data-filter="Упаковка">Упаковка</button>
                    <button class="filter-btn ${currentFilter === 'Брокеридж' ? 'active' : ''}" data-filter="Брокеридж">Брокеридж</button>
                </div>
            </div>
            <div id="resultsContainer"></div>`;
        setupKBSearchAndFilters();
        performSearchAndRender();
    }

    function renderGamificationPage() {
        const gPanel = document.getElementById('gamification-panel');
        const balance = gamificationData.balance || 0;

        const tasksHTML = gamificationData.tasks.map(task => {
            const progress = task.is_completed ? 100 : Math.round(((task.employee_tasks[0]?.current_count || 0) / task.target_count) * 100);
            return `
                <div class="task-item ${task.is_completed ? 'completed' : ''}">
                    <div class="task-title">${task.title} (+${task.reward_coins}💎)</div>
                    <div class="task-desc">${task.description}</div>
                    <div class="task-progress-bar"><div class="task-progress" style="width: ${progress}%;"></div></div>
                    <div class="task-status">${task.is_completed ? 'Выполнено' : `${(task.employee_tasks[0]?.current_count || 0)}/${task.target_count}`}</div>
                </div>`;
        }).join('') || '<p>Новых заданий пока нет.</p>';

        const shopHTML = gamificationData.shopItems.map(item => `
            <div class="shop-item">
                <span class="shop-item-price">${item.price} 💎</span>
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-desc">${item.description}</div>
                <button class="buy-btn" data-id="${item.id}" data-price="${item.price}" ${balance < item.price ? 'disabled' : ''}>Купить</button>
            </div>
        `).join('') || '<p>Магазин пуст.</p>';

        gPanel.innerHTML = `
            <div class="gamification-header">
                <div>Ваш баланс:</div>
                <div class="coin-balance">${balance} 💎</div>
            </div>
            <div class="gamification-section">
                <h2>Активные задания</h2>
                <div class="tasks-list">${tasksHTML}</div>
            </div>
            <div class="gamification-section">
                <h2>Магазин призов</h2>
                <div class="shop-list">${shopHTML}</div>
            </div>`;
        setupGamificationListeners();
    }

    // --- ЛОГИКА ПОИСКА (БАЗА ЗНАНИЙ) ---
    function performSearchAndRender() {
        // ... (код этой функции остается без изменений)
    }
    function renderResults(results) {
        // ... (код этой функции остается без изменений)
    }

    // --- ЛОГИКА ВЗАИМОДЕЙСТВИЯ (БАЗА ЗНАНИЙ) ---
    function setupCardInteractionListeners() {
        // ... (код этой функции остается без изменений)
    }
    async function saveData(objectionId, noteText, ratingValue) {
        // ... (код этой функции остается без изменений)
    }
    async function deleteData(objectionId) {
        // ... (код этой функции остается без изменений)
    }
    async function reportMissingObjection() {
        // ... (код этой функции остается без изменений)
    }
    async function refreshPersonalData() {
        const { data, error } = await supabaseClient.functions.invoke('get-user-data', { body: {} });
        if (!error) { userPersonalData = data; }
    }

    // --- СЛУШАТЕЛИ СОБЫТИЙ ---
    function setupTabListeners() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabPanels = document.querySelectorAll('.tab-panel');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                const targetTab = button.dataset.tab;
                tabPanels.forEach(panel => {
                    panel.classList.toggle('active', panel.id === `${targetTab}-panel`);
                });
            });
        });
    }
    function setupKBSearchAndFilters() {
        // ... (код этой функции остается без изменений)
    }
    function setupGamificationListeners() {
        document.querySelectorAll('.buy-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const itemId = parseInt(e.target.dataset.id);
                const itemPrice = parseInt(e.target.dataset.price);
                tg.showConfirm(`Вы уверены, что хотите купить этот приз за ${itemPrice} 💎?`, async (confirmed) => {
                    if (confirmed) {
                        try {
                            const { data, error } = await supabaseClient.functions.invoke('purchase-item', { body: { userId: currentUser.id, itemId } });
                            if (error || !data.success) throw new Error(data.error || "Не удалось совершить покупку.");
                            tg.showAlert('Поздравляем с покупкой!');
                            await loadAllData(); // Обновляем все данные
                            renderGamificationPage(); // Перерисовываем страницу геймификации
                        } catch (err) {
                            tg.showAlert(err.message);
                        }
                    }
                });
            });
        });
    }

    // Запускаем приложение
    main();
});