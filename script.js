document.addEventListener('DOMContentLoaded', () => {

    // --- НАСТРОЙКИ ---
    // 🔴 Не забудьте вставить свои URL и ключ!
    const SUPABASE_URL = 'https://adyqqfkwgdzanpgsvzgl.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkeXFxZmt3Z2R6YW5wZ3N2emdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NTM1NTgsImV4cCI6MjA2NzEyOTU1OH0.rfFekXWr933GcjA2JZQ2gvUObS3zuzctDQZvZfopP2g';
    // -----------------

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
        if (!kbPanel) return;
        kbPanel.innerHTML = `
            <div class="header"><h1>Привет, ${currentUser.first_name}!</h1></div>
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
        if (!gPanel) return;
        const balance = gamificationData.balance || 0;

        const tasksHTML = gamificationData.tasks.map(task => {
            const currentCount = task.employee_tasks[0]?.current_count || 0;
            const isCompleted = task.employee_tasks[0]?.is_completed || false;
            const progress = isCompleted ? 100 : Math.round((currentCount / task.target_count) * 100);
            return `<div class="task-item ${isCompleted ? 'completed' : ''}"><div class="task-title">${task.title} (+${task.reward_coins}💎)</div><div class="task-desc">${task.description}</div><div class="task-progress-bar"><div class="task-progress" style="width: ${progress}%;"></div></div><div class="task-status">${isCompleted ? 'Выполнено' : `${currentCount}/${task.target_count}`}</div></div>`;
        }).join('') || '<p class="no-feedback">Новых заданий пока нет.</p>';

        const shopHTML = gamificationData.shopItems.map(item => `
            <div class="shop-item"><span class="shop-item-price">${item.price} 💎</span><div class="shop-item-name">${item.name}</div><div class="shop-item-desc">${item.description}</div><button class="buy-btn" data-id="${item.id}" data-price="${item.price}" ${balance < item.price ? 'disabled' : ''}>Купить</button></div>
        `).join('') || '<p class="no-feedback">Магазин пуст.</p>';

        gPanel.innerHTML = `
            <div class="gamification-header"><div>Ваш баланс:</div><div class="coin-balance">${balance} 💎</div></div>
            <div class="gamification-section"><h2>Активные задания</h2><div class="tasks-list">${tasksHTML}</div></div>
            <div class="gamification-section"><h2>Магазин призов</h2><div class="shop-list">${shopHTML}</div></div>`;
        setupGamificationListeners();
    }

    function renderResults(results) {
        const resultsContainer = document.getElementById('resultsContainer');
        if (!resultsContainer) return;
        resultsContainer.innerHTML = '';
        if (!results || results.length === 0) {
            resultsContainer.innerHTML = `<div class="not-found-container"><p>Ничего не найдено.</p></div>`;
            return;
        }
        results.forEach(item => {
            const record = item.item ? item.item : item;
            const card = document.createElement('div');
            card.className = 'item-card';
            const objectionNotes = userPersonalData.notes[record.id] || [];
            const objectionRatings = userPersonalData.ratings[record.id] || [];
            const currentUserRatingObj = objectionRatings.find(r => r.authorId === currentUser.id);
            const currentUserNoteObj = objectionNotes.find(n => n.authorId === currentUser.id);
            const currentUserRating = currentUserRatingObj?.value || 0;
            const currentUserNote = currentUserNoteObj?.text || '';
            const othersNotesHTML = objectionNotes.filter(n => n.authorId !== currentUser.id).map(n => `<div class="note-item"><div class="note-author">${n.author || 'Аноним'} написал:</div><div class="note-text">${(n.text || '').replace(/\n/g, '<br>')}</div></div>`).join('');
            const averageRating = objectionRatings.length > 0 ? Math.round(objectionRatings.reduce((sum, r) => sum + r.value, 0) / objectionRatings.length) : 0;
            card.innerHTML = `<h3>${record.question} <span class="category-badge">${record.category}</span></h3><p>${record.answer ? record.answer.replace(/\n/g, '<br>') : ''}</p><div class="user-interaction"><h4>Ваш отзыв:</h4><div class="rating-stars" data-objection-id="${record.id}">${[1, 2, 3, 4, 5].map(star => `<span class="star ${star <= currentUserRating ? 'filled' : ''}" data-value="${star}">★</span>`).join('')}</div><textarea class="note-input" data-objection-id="${record.id}" placeholder="Ваша личная заметка...">${currentUserNote}</textarea><div class="card-actions"><button class="action-btn" data-action="save" data-id="${record.id}">Подтвердить</button>${(currentUserRatingObj || currentUserNoteObj) ? `<button class="action-btn delete" data-action="delete" data-id="${record.id}">Удалить мой отзыв</button>` : ''}</div></div><div class="public-feedback"><h4>Отзывы команды:</h4><div class="average-rating">Общий рейтинг: ${[1, 2, 3, 4, 5].map(star => `<span class="star small ${star <= averageRating ? 'filled' : ''}">★</span>`).join('')} (${objectionRatings.length} оценок)</div><div class="notes-list">${othersNotesHTML.length > 0 ? othersNotesHTML : '<p class="no-feedback">Пока нет других заметок.</p>'}</div></div>`;
            resultsContainer.appendChild(card);
        });
        setupCardInteractionListeners();
    }

    async function saveData(objectionId, noteText, ratingValue) {
        try {
            await supabaseClient.functions.invoke('save-user-data', { body: { userId: currentUser.id, objectionId, note: noteText, rating: ratingValue } });
            tg.showAlert('Ваш отзыв сохранен!');
            await refreshAllDataAndRender();
        } catch (error) {
            console.error("Failed to save data:", error);
            tg.showAlert('Ошибка сохранения.');
        }
    }

    async function deleteData(objectionId) {
        try {
            tg.showConfirm('Вы уверены, что хотите удалить свой отзыв?', async (confirmed) => {
                if (confirmed) {
                    await Promise.all([
                        supabaseClient.functions.invoke('delete-user-data', { body: { userId: currentUser.id, objectionId, type: 'note' } }),
                        supabaseClient.functions.invoke('delete-user-data', { body: { userId: currentUser.id, objectionId, type: 'rating' } })
                    ]);
                    tg.showAlert('Ваш отзыв удален.');
                    await refreshAllDataAndRender();
                }
            });
        } catch (error) {
            console.error("Failed to delete data:", error);
            tg.showAlert('Ошибка удаления.');
        }
    }

    async function refreshAllDataAndRender() {
        showLoader("Обновление данных...");
        await loadAllData();
        performSearchAndRender();
        renderGamificationPage();
    }

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
        const searchInput = document.getElementById('searchInput');
        const filterButtons = document.querySelectorAll('.filters .filter-btn');
        searchInput.addEventListener('input', (e) => { currentSearchTerm = e.target.value; performSearchAndRender(); });
        filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                currentFilter = e.target.dataset.filter;
                performSearchAndRender();
            });
        });
    }

    function setupCardInteractionListeners() {
        document.querySelectorAll('.rating-stars').forEach(starsContainer => {
            starsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('star')) {
                    const ratingValue = parseInt(e.target.dataset.value);
                    starsContainer.querySelectorAll('.star').forEach(star => {
                        star.classList.toggle('filled', parseInt(star.dataset.value) <= ratingValue);
                    });
                }
            });
        });
        document.querySelectorAll('.action-btn[data-action]').forEach(button => {
            button.addEventListener('click', (e) => {
                const objectionId = parseInt(e.target.dataset.id);
                const action = e.target.dataset.action;
                if (action === 'save') {
                    const noteInput = document.querySelector(`.note-input[data-objection-id="${objectionId}"]`);
                    const starsContainer = document.querySelector(`.rating-stars[data-objection-id="${objectionId}"]`);
                    const rating = starsContainer.querySelectorAll('.star.filled').length;
                    saveData(objectionId, noteInput.value, rating);
                } else if (action === 'delete') {
                    deleteData(objectionId);
                }
            });
        });
    }

    function setupGamificationListeners() {
        document.querySelectorAll('.buy-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = parseInt(e.target.dataset.id);
                const itemPrice = parseInt(e.target.dataset.price);
                tg.showConfirm(`Вы уверены, что хотите купить этот приз за ${itemPrice} 💎?`, async (confirmed) => {
                    if (confirmed) {
                        try {
                            const { data, error } = await supabaseClient.functions.invoke('purchase-item', { body: { userId: currentUser.id, itemId } });
                            if (error || !data.success) throw new Error(data.error || "Не удалось совершить покупку.");
                            tg.showAlert('Поздравляем с покупкой!');
                            await refreshAllDataAndRender();
                        } catch (err) {
                            tg.showAlert(err.message);
                        }
                    }
                });
            });
        });
    }

    function performSearchAndRender() {
        let results = objectionsData;
        if (currentFilter !== 'all') { results = results.filter(item => item.category === currentFilter); }
        if (currentSearchTerm.trim().length >= 3) {
            const fuseOptions = { keys: ['question'], threshold: 0.3, ignoreLocation: true };
            const fuseInstance = new Fuse(results, fuseOptions);
            results = fuseInstance.search(currentSearchTerm);
        }
        renderResults(results);
    }

    main();
});