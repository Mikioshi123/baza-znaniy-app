document.addEventListener('DOMContentLoaded', () => {

    // --- НАСТРОЙКИ ---
    // 🔴 Не забудьте вставить свои URL и ключ!
    const SUPABASE_URL = 'https://adyqqfkwgdzanpgsvzgl.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkeXFxZmt3Z2R6YW5wZ3N2emdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NTM1NTgsImV4cCI6MjA2NzEyOTU1OH0.rfFekXWr933GcjA2JZQ2gvUObS3zuzctDQZvZfopP2g';
    // -----------------

    const appContainer = document.getElementById('appContainer');
    const tg = window.Telegram.WebApp;
    tg.ready();

    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Глобальные переменные для хранения состояния
    let currentUser;
    let objectionsData = [];
    let gamificationData = { balance: 0, tasks: [], shop_items: [] };
    let currentFilter = 'all';
    let currentSearchTerm = '';

    // --- ГЛАВНАЯ ФУНКЦИЯ ПРИЛОЖЕНИЯ ---
    async function main() {
        showLoader("Проверка доступа...");
        currentUser = tg.initDataUnsafe?.user;
        if (!currentUser?.id) {
            showError("Не удалось определить пользователя. Пожалуйста, запустите приложение через Telegram.");
            return;
        }

        try {
            const { data: authData, error: authError } = await supabaseClient.functions.invoke('check-and-add-employee', { body: { user: currentUser } });
            if (authError || !authData.accessGranted) throw new Error(authData.reason || "Доступ запрещен");

            await loadAllData();
            renderAppShell(currentUser.first_name);
            showTab('knowledgeBase');

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

    // --- ФУНКЦИИ УПРАВЛЕНИЯ ИНТЕРФЕЙСОМ ---
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
        document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
        document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
        document.getElementById(tabId).style.display = 'block';
        document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');

        if (tabId === 'knowledgeBase') {
            renderKnowledgeBase();
        } else if (tabId === 'gamification') {
            renderGamificationPage();
        }
    }

    // --- ЛОГИКА ВКЛАДКИ "БАЗА ЗНАНИЙ" ---
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

        const searchInput = document.getElementById('searchInput');
        const filterButtons = document.querySelectorAll('.filter-btn');

        searchInput.value = currentSearchTerm;
        document.querySelector(`.filter-btn[data-filter="${currentFilter}"]`)?.classList.add('active');

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

        performSearchAndRender();
    }

    function performSearchAndRender() {
        let filteredData = objectionsData;

        if (currentFilter !== 'all') {
            filteredData = objectionsData.filter(item => item.category === currentFilter);
        }

        if (currentSearchTerm.trim().length < 3) {
            renderResults(filteredData);
            return;
        }

        const fuseOptions = { keys: ['question'], threshold: 0.0, minMatchCharLength: 3, useExtendedSearch: true, ignoreLocation: true };
        const fuseInstance = new Fuse(filteredData, fuseOptions);
        const extendedSearchTerm = currentSearchTerm.split(' ').filter(word => word.length >= 3).map(word => `'${word}`).join(' | ');
        const searchResults = fuseInstance.search(extendedSearchTerm);

        renderResults(searchResults);
    }

    function renderResults(results) {
        // ... (Код этой функции из предыдущего сообщения остается без изменений)
    }

    // --- ЛОГИКА ВКЛАДКИ "ГЕЙМИФИКАЦИЯ" ---
    function renderGamificationPage() {
        // ... (Код этой функции из предыдущего сообщения остается без изменений)
    }

    // ... (Все остальные функции: renderTasks, renderShop, purchaseItem, saveData, deleteData, и т.д. остаются без изменений)
    // ... (Я вставлю их ниже для полноты)

    // Полный код функции renderResults, которую я сократил выше
    function renderResults(results) {
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.innerHTML = '';
        if (!results || results.length === 0) {
            resultsContainer.innerHTML = `<div class="not-found-container"><p>По запросу "<strong>${currentSearchTerm}</strong>" ничего не найдено.</p><button class="action-btn" id="report-btn">Отправить на доработку</button></div>`;
            document.getElementById('report-btn')?.addEventListener('click', reportMissingObjection);
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

    // Все остальные функции...
    async function saveData(objectionId, noteText, ratingValue) { try { await supabaseClient.functions.invoke('save-user-data', { body: { userId: currentUser.id, objectionId, note: noteText, rating: ratingValue } }); tg.showAlert('Ваш отзыв сохранен!'); await refreshPersonalData(); performSearchAndRender(); } catch (error) { console.error("Failed to save data:", error); tg.showAlert('Ошибка сохранения.'); } }
    async function deleteData(objectionId) { try { await Promise.all([supabaseClient.functions.invoke('delete-user-data', { body: { userId: currentUser.id, objectionId, type: 'note' } }), supabaseClient.functions.invoke('delete-user-data', { body: { userId: currentUser.id, objectionId, type: 'rating' } })]); tg.showAlert('Ваш отзыв удален.'); await refreshPersonalData(); performSearchAndRender(); } catch (error) { console.error("Failed to delete data:", error); tg.showAlert('Ошибка удаления.'); } }
    async function reportMissingObjection() { const searchInput = document.getElementById('searchInput'); const searchTerm = searchInput.value; if (!searchTerm) { tg.showAlert('Пожалуйста, введите запрос, который вы не смогли найти.'); return; } const reportButton = document.getElementById('report-btn'); if (reportButton) { reportButton.disabled = true; reportButton.textContent = 'Отправка...'; } try { await supabaseClient.functions.invoke('report-missing-objection', { body: { searchTerm: searchTerm, user: currentUser } }); if (reportButton) { reportButton.textContent = '✅ Отправлено!'; } searchInput.value = ''; } catch (error) { console.error("Failed to report missing objection:", error); tg.showAlert('Произошла ошибка при отправке запроса.'); if (reportButton) { reportButton.disabled = false; reportButton.textContent = 'Отправить на доработку'; } } }
    async function refreshPersonalData() { const { data, error } = await supabaseClient.functions.invoke('get-user-data', { body: {} }); if (error) { console.error("Failed to refresh personal data:", error); return; } userPersonalData = data; }
    function setupCardInteractionListeners() { document.querySelectorAll('.rating-stars').forEach(starsContainer => { starsContainer.addEventListener('click', (e) => { if (e.target.classList.contains('star')) { const ratingValue = parseInt(e.target.dataset.value); starsContainer.querySelectorAll('.star').forEach(star => { star.classList.toggle('filled', parseInt(star.dataset.value) <= ratingValue); }); } }); }); document.querySelectorAll('.action-btn[data-action]').forEach(button => { button.addEventListener('click', (e) => { const objectionId = parseInt(e.target.dataset.id); const action = e.target.dataset.action; if (action === 'save') { const noteInput = document.querySelector(`.note-input[data-objection-id="${objectionId}"]`); const starsContainer = document.querySelector(`.rating-stars[data-objection-id="${objectionId}"]`); const rating = starsContainer.querySelectorAll('.star.filled').length; saveData(objectionId, noteInput.value, rating); } else if (action === 'delete') { tg.showConfirm('Вы уверены, что хотите удалить свой отзыв?', (confirmed) => { if (confirmed) { deleteData(objectionId); } }); } }); }); }
    function renderGamificationPage() { const container = document.getElementById('gamification'); container.innerHTML = `<div class="gamification-page"><div class="balance-display">Мои Маркеткоины: <span>${gamificationData.balance} 🪙</span></div><h2>Задания</h2><div id="tasks-list"></div><h2>Магазин призов</h2><div id="shop-list"></div></div>`; renderTasks(); renderShop(); }
    function renderTasks() { const container = document.getElementById('tasks-list'); container.innerHTML = gamificationData.tasks.map(task => { const progress = Math.min(100, (task.current_count / task.target_count) * 100); return `<div class="task-card ${task.is_completed && !task.is_repeatable ? 'completed' : ''}"><div class="task-title">${task.title}</div><div class="task-description">${task.description}</div><div class="progress-bar"><div class="progress-bar-inner" style="width: ${progress}%;"></div></div><div class="progress-text">${task.current_count} / ${task.target_count}</div><div class="reward">+${task.reward_coins} 🪙</div></div>`; }).join(''); }
    function renderShop() { const container = document.getElementById('shop-list'); container.innerHTML = gamificationData.shop_items.map(item => `<div class="shop-item-card"><div class="shop-item-info"><h4>${item.name}</h4><p>${item.description || ''}</p></div><div class="shop-item-buy"><div class="price">${item.price} 🪙</div><button class="buy-btn" data-item-id="${item.id}" data-item-price="${item.price}" ${gamificationData.balance < item.price ? 'disabled' : ''}>Купить</button></div></div>`).join(''); document.querySelectorAll('.buy-btn').forEach(button => { button.addEventListener('click', (e) => { const itemId = parseInt(e.target.dataset.itemId); const itemPrice = parseInt(e.target.dataset.itemPrice); tg.showConfirm(`Вы уверены, что хотите купить этот товар за ${itemPrice} маркеткоинов?`, (confirmed) => { if (confirmed) { purchaseItem(itemId); } }); }); }); }
    async function purchaseItem(itemId) { try { const { data, error } = await supabaseClient.functions.invoke('purchase-item', { body: { userId: currentUser.id, itemId: itemId } }); if (error) throw new Error(error.message); if (!data.success) throw new Error(data.message); tg.showAlert('Поздравляем с покупкой!'); await loadAllData(); renderGamificationPage(); } catch (error) { tg.showAlert(`Ошибка покупки: ${error.message}`); } }

    main();
});