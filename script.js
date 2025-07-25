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
    
    let currentUser;
    let objectionsData = [];
    let userPersonalData = { notes: {}, ratings: {} };
    let gamificationData = { leaderboard: [], marketplaceItems: [], currentUser: {} };
    let currentFilter = 'all';
    let currentSearchTerm = '';

    async function main() {
        showLoader("Загрузка...");
        currentUser = tg.initDataUnsafe?.user;
        if (!currentUser?.id) {
            showError("Не удалось определить пользователя. Пожалуйста, запустите приложение через Telegram.");
            return;
        }

        try {
            const { data: authData, error: authError } = await supabaseClient.functions.invoke('check-and-add-employee', { body: { user: currentUser } });
            if (authError || !authData.accessGranted) throw new Error(authData.reason || "Доступ запрещен");

            showLoader("Загрузка данных...");
            const [personalDataRes, objectionsRes, gameDataRes] = await Promise.all([
                supabaseClient.functions.invoke('get-user-data', { body: {} }),
                supabaseClient.from('objections').select('*'),
                supabaseClient.functions.invoke('gamification-get-data', { body: { userId: currentUser.id } })
            ]);
            
            if (personalDataRes.error) throw personalDataRes.error;
            if (objectionsRes.error) throw objectionsRes.error;
            if (gameDataRes.error) throw gameDataRes.error;
            
            userPersonalData = personalDataRes.data;
            objectionsData = objectionsRes.data;
            gamificationData = gameDataRes.data;

            renderMainLayout(currentUser.first_name, gamificationData.currentUser.mc_balance);
            renderKnowledgeBaseTab();

        } catch (error) {
            console.error(error);
            showError(`Произошла критическая ошибка: ${error.message}`);
        }
    }

    function showLoader(text) { appContainer.innerHTML = `<div class="loader">${text}</div>`; }
    function showError(text) { appContainer.innerHTML = `<div class="error-screen"><h3>Ошибка</h3><p>${text}</p></div>`; }

    function renderMainLayout(userName, balance) {
        if (tg.colorScheme) { document.body.className = tg.colorScheme; }
        appContainer.innerHTML = `
            <div class="header">
                <h1>Привет, ${userName}!</h1>
                <div class="balance-widget">
                    <div class="amount">${balance || 0} MC</div>
                    <div class="label">Ваш баланс</div>
                </div>
            </div>
            <div class="tabs">
                <button class="tab-btn active" data-tab="kb">База знаний</button>
                <button class="tab-btn" data-tab="market">Магазин</button>
                <button class="tab-btn" data-tab="rating">Рейтинг</button>
            </div>
            <div id="tab-content"></div>`;
        
        document.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                const tab = e.target.dataset.tab;
                if (tab === 'kb') renderKnowledgeBaseTab();
                if (tab === 'market') renderMarketplaceTab();
                if (tab === 'rating') renderRatingTab();
            });
        });
    }

    function renderKnowledgeBaseTab() {
        document.getElementById('tab-content').innerHTML = `
            <div class="controls">
                <input type="text" id="searchInput" placeholder="Введите ключевое слово для поиска...">
                <div class="filters">
                    <button class="filter-btn active" data-filter="all">Все</button>
                    <button class="filter-btn" data-filter="Упаковка">Упаковка</button>
                    <button class="filter-btn" data-filter="Брокеридж">Брокеридж</button>
                </div>
            </div>
            <div id="resultsContainer"></div>`;
        setupStaticEventListeners();
        performSearchAndRender();
    }

    function renderMarketplaceTab() {
        const { marketplaceItems, currentUser } = gamificationData;
        document.getElementById('tab-content').innerHTML = `
            <div class="marketplace-grid">
                ${marketplaceItems.map(item => `
                    <div class="market-item-card">
                        <div class="title">${item.title}</div>
                        <p class="description">${item.description || ''}</p>
                        <div class="footer">
                            <span class="price">${item.price_mc} MC</span>
                            <button class="action-btn" data-action="buy" data-item-id="${item.id}" data-item-price="${item.price_mc}" ${currentUser.mc_balance < item.price_mc ? 'disabled' : ''}>
                                Купить
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>`;
        setupMarketplaceListeners();
    }

    function renderRatingTab() {
        const { leaderboard } = gamificationData;
        document.getElementById('tab-content').innerHTML = `
            <div class="leaderboard">
                ${leaderboard.map((player, index) => `
                    <div class="leaderboard-item">
                        <div class="rank">#${index + 1}</div>
                        <div class="name">${player.first_name || 'Аноним'}</div>
                        <div class="score">${player.mc_balance} MC</div>
                    </div>
                `).join('')}
            </div>`;
    }

    function renderResults(results) {
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.innerHTML = '';
        if (!results || results.length === 0) {
            const searchTerm = currentSearchTerm;
            resultsContainer.innerHTML = `<div class="not-found-container"><p>По запросу "<strong>${searchTerm}</strong>" ничего не найдено.</p><button class="action-btn" id="report-btn">Отправить на доработку</button></div>`;
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
    
    async function saveData(objectionId, noteText, ratingValue) {
        try {
            await supabaseClient.functions.invoke('save-user-data', { body: { userId: currentUser.id, objectionId, note: noteText, rating: ratingValue } });
            tg.showAlert('Ваш отзыв сохранен!');
            await refreshAllData();
            renderKnowledgeBaseTab();
        } catch (error) {
            console.error("Failed to save data:", error);
            tg.showAlert('Ошибка сохранения.');
        }
    }

    async function deleteData(objectionId) {
        try {
            await Promise.all([
                supabaseClient.functions.invoke('delete-user-data', { body: { userId: currentUser.id, objectionId, type: 'note' } }),
                supabaseClient.functions.invoke('delete-user-data', { body: { userId: currentUser.id, objectionId, type: 'rating' } })
            ]);
            tg.showAlert('Ваш отзыв удален.');
            await refreshAllData();
            renderKnowledgeBaseTab();
        } catch(error) {
            console.error("Failed to delete data:", error);
            tg.showAlert('Ошибка удаления.');
        }
    }
    
    async function reportMissingObjection() {
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput.value;
        if (!searchTerm) {
            tg.showAlert('Пожалуйста, введите запрос, который вы не смогли найти.');
            return;
        }
        const reportButton = document.getElementById('report-btn');
        if (reportButton) {
            reportButton.disabled = true;
            reportButton.textContent = 'Отправка...';
        }
        try {
            await supabaseClient.functions.invoke('report-missing-objection', {
                body: { searchTerm: searchTerm, user: currentUser }
            });
            if (reportButton) {
                reportButton.textContent = '✅ Отправлено!';
            }
            searchInput.value = '';
        } catch (error) {
            console.error("Failed to report missing objection:", error);
            tg.showAlert('Произошла ошибка при отправке запроса.');
            if (reportButton) {
                reportButton.disabled = false;
                reportButton.textContent = 'Отправить на доработку';
            }
        }
    }
    
    async function refreshAllData() {
        const [personalDataRes, gameDataRes] = await Promise.all([
            supabaseClient.functions.invoke('get-user-data', { body: {} }),
            supabaseClient.functions.invoke('gamification-get-data', { body: { userId: currentUser.id } })
        ]);
        if (personalDataRes.data) userPersonalData = personalDataRes.data;
        if (gameDataRes.data) gamificationData = gameDataRes.data;
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
                    tg.showConfirm('Вы уверены, что хотите удалить свой отзыв?', (confirmed) => {
                        if (confirmed) { deleteData(objectionId); }
                    });
                }
            });
        });
    }

    function setupStaticEventListeners() {
        const searchInput = document.getElementById('searchInput');
        const filterButtons = document.querySelectorAll('.filter-btn');
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

    function setupMarketplaceListeners() {
        document.querySelectorAll('.action-btn[data-action="buy"]').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = e.target.dataset.itemId;
                const itemPrice = parseInt(e.target.dataset.itemPrice);
                tg.showConfirm(`Вы уверены, что хотите купить этот товар за ${itemPrice} MC?`, async (confirmed) => {
                    if (confirmed) {
                        try {
                            e.target.disabled = true;
                            e.target.textContent = 'Обработка...';
                            const { data, error } = await supabaseClient.functions.invoke('gamification-purchase-item', {
                                body: { userId: currentUser.id, itemId: itemId }
                            });
                            if (error) throw error;
                            tg.showAlert('Покупка совершена! Администратор скоро свяжется с вами.');
                            gamificationData.currentUser.mc_balance = data.newBalance;
                            renderMainLayout(currentUser.first_name, gamificationData.currentUser.mc_balance);
                            renderMarketplaceTab();
                        } catch (err) {
                            tg.showAlert(`Ошибка покупки: ${err.message}`);
                            e.target.disabled = false;
                            e.target.textContent = 'Купить';
                        }
                    }
                });
});
    }

    function performSearchAndRender() {
        let results = objectionsData;
        if (currentFilter !== 'all') { results = results.filter(item => item.category === currentFilter); }
        if (currentSearchTerm.trim().length >= 3) {
            const fuseOptions = { keys: ['question'], threshold: 0.0, minMatchCharLength: 3, useExtendedSearch: true, ignoreLocation: true };
            const fuseInstance = new Fuse(results, fuseOptions);
            const extendedSearchTerm = currentSearchTerm.split(' ').filter(word => word.length >= 3).map(word => `'${word}`).join(' | ');
            results = fuseInstance.search(extendedSearchTerm);
        }
        renderResults(results);
    }

    main();
});
