document.addEventListener('DOMContentLoaded', () => {

    const SUPABASE_URL = 'https://adyqqfkwgdzanpgsvzgl.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkeXFxZmt3Z2R6YW5wZ3N2emdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NTM1NTgsImV4cCI6MjA2NzEyOTU1OH0.rfFekXWr933GcjA2JZQ2gvUObS3zuzctDQZvZfopP2g';

    const appContainer = document.getElementById('appContainer');
    const tg = window.Telegram.WebApp;
    tg.ready();

    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let currentUser;
    let objectionsData = [];
    let gamificationData = { balance: 0, tasks: [], shop_items: [] };

    async function main() {
        showLoader("Проверка доступа...");
        currentUser = tg.initDataUnsafe?.user;
        if (!currentUser?.id) { showError("Не удалось определить пользователя."); return; }

        try {
            const { data: authData, error: authError } = await supabaseClient.functions.invoke('check-and-add-employee', { body: { user: currentUser } });
            if (authError || !authData.accessGranted) throw new Error(authData.reason || "Доступ запрещен");

            await loadAllData();
            renderAppShell(currentUser.first_name);
            showTab('knowledgeBase'); // Показываем базу знаний по умолчанию

        } catch (error) {
            console.error(error);
            showError(`Произошла критическая ошибка: ${error.message}`);
        }
    }

    async function loadAllData() {
        showLoader("Загрузка данных...");
        const [gamificationRes, objectionsRes] = await Promise.all([
            supabaseClient.functions.invoke('get-gamification-data', { body: { userId: currentUser.id } }),
            supabaseClient.from('objections').select('*')
        ]);
        if (gamificationRes.error) throw gamificationRes.error;
        if (objectionsRes.error) throw objectionsRes.error;
        gamificationData = gamificationRes.data;
        objectionsData = objectionsRes.data;
    }

    function showLoader(text) { appContainer.innerHTML = `<div class="loader">${text}</div>`; }
    function showError(text) { appContainer.innerHTML = `<div class="error-screen"><h3>Ошибка</h3><p>${text}</p></div>`; }

    function renderAppShell(userName) {
        if (tg.colorScheme) { document.body.className = tg.colorScheme; }
        appContainer.innerHTML = `
            <h1>Привет, ${userName}!</h1>
            <div class="tabs">
                <button class="tab-button" data-tab="knowledgeBase">База знаний</button>
                <button class="tab-button" data-tab="gamification">Задания и Призы</button>
            </div>
            <div id="knowledgeBase" class="tab-content"></div>
            <div id="gamification" class="tab-content"></div>
        `;
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => showTab(button.dataset.tab));
        });
    }

    function showTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));

        document.getElementById(tabId).classList.add('active');
        document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');

        if (tabId === 'knowledgeBase') {
            renderKnowledgeBase();
        } else if (tabId === 'gamification') {
            renderGamificationPage();
        }
    }

    function renderKnowledgeBase() {
        const container = document.getElementById('knowledgeBase');
        container.innerHTML = `
        <p>Поиск по возражениям</p>
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

        // Заново навешиваем слушателей на только что созданные элементы
        const searchInput = document.getElementById('searchInput');
        const filterButtons = document.querySelectorAll('.filter-btn');

        searchInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value;
            performSearchAndRender();
        });

        filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                currentFilter = e.target.dataset.filter;
                performSearchAndRender();
            });
        });

        // Выполняем начальную отрисовку с текущими фильтрами
        performSearchAndRender();
    }

    function performSearchAndRender(searchTerm) { /* ... (Код из предыдущей версии) ... */ }
    function renderResults(results) { /* ... (Код из предыдущей версии) ... */ }
    function setupCardInteractionListeners() { /* ... (Код из предыдущей версии) ... */ }
    async function saveData() { /* ... (Код из предыдущей версии) ... */ }
    // ... и т.д. Все функции от Базы Знаний, которые у нас уже есть

    // --- ЛОГИКА ВКЛАДКИ "ЗАДАНИЯ И ПРИЗЫ" ---
    function renderGamificationPage() {
        const container = document.getElementById('gamification');
        container.innerHTML = `
            <div class="gamification-page">
                <div class="balance-display">Мои Маркеткоины: <span>${gamificationData.balance} 🪙</span></div>
                
                <h2>Задания</h2>
                <div id="tasks-list"></div>
                
                <h2>Магазин призов</h2>
                <div id="shop-list"></div>
            </div>
        `;
        renderTasks();
        renderShop();
    }

    function renderTasks() {
        const container = document.getElementById('tasks-list');
        container.innerHTML = gamificationData.tasks.map(task => {
            const progress = Math.min(100, (task.current_count / task.target_count) * 100);
            return `
                <div class="task-card ${task.is_completed && !task.is_repeatable ? 'completed' : ''}">
                    <div class="task-title">${task.title}</div>
                    <div class="task-description">${task.description}</div>
                    <div class="progress-bar"><div class="progress-bar-inner" style="width: ${progress}%;"></div></div>
                    <div class="progress-text">${task.current_count} / ${task.target_count}</div>
                    <div class="reward">+${task.reward_coins} 🪙</div>
                </div>
            `;
        }).join('');
    }

    function renderShop() {
        const container = document.getElementById('shop-list');
        container.innerHTML = gamificationData.shop_items.map(item => `
            <div class="shop-item-card">
                <div class="shop-item-info">
                    <h4>${item.name}</h4>
                    <p>${item.description || ''}</p>
                </div>
                <div class="shop-item-buy">
                    <div class="price">${item.price} 🪙</div>
                    <button class="buy-btn" data-item-id="${item.id}" data-item-price="${item.price}" ${gamificationData.balance < item.price ? 'disabled' : ''}>Купить</button>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.buy-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = parseInt(e.target.dataset.itemId);
                const itemPrice = parseInt(e.target.dataset.itemPrice);
                tg.showConfirm(`Вы уверены, что хотите купить этот товар за ${itemPrice} маркеткоинов?`, (confirmed) => {
                    if (confirmed) {
                        purchaseItem(itemId);
                    }
                });
            });
        });
    }

    async function purchaseItem(itemId) {
        try {
            const { data, error } = await supabaseClient.functions.invoke('purchase-item', {
                body: { userId: currentUser.id, itemId: itemId }
            });
            if (error) throw new Error(error.message);
            if (!data.success) throw new Error(data.message);

            tg.showAlert('Поздравляем с покупкой!');
            await loadAllData(); // Обновляем все данные
            renderGamificationPage(); // Перерисовываем страницу
        } catch (error) {
            tg.showAlert(`Ошибка покупки: ${error.message}`);
        }
    }

    // Запускаем приложение
    main();
});