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

    let currentUser; // Информация о текущем пользователе
    let objectionsData = []; // Все возражения
    let userPersonalData = { notes: {}, ratings: {} }; // Все заметки и рейтинги

    // --- ГЛАВНАЯ ФУНКЦИЯ ПРИЛОЖЕНИЯ ---
    async function main() {
        showLoader("Проверка доступа...");
        currentUser = tg.initDataUnsafe?.user;
        if (!currentUser?.id) {
            showError("Не удалось определить пользователя. Пожалуйста, запустите приложение через Telegram.");
            return;
        }

        try {
            // 1. Проверяем авторизацию
            const { data: authData, error: authError } = await supabaseClient.functions.invoke('check-and-add-employee', {
                body: { user: currentUser }
            });
            if (authError || !authData.accessGranted) throw new Error(authData.reason || "Доступ запрещен");

            // 2. Загружаем все данные параллельно
            showLoader("Загрузка данных...");
            const [personalDataRes, objectionsRes] = await Promise.all([
                supabaseClient.functions.invoke('get-user-data', { body: {} }), // Запрашиваем данные всех пользователей
                supabaseClient.from('objections').select('*')
            ]);

            if (personalDataRes.error) throw personalDataRes.error;
            if (objectionsRes.error) throw objectionsRes.error;

            userPersonalData = personalDataRes.data;
            objectionsData = objectionsRes.data;

            // 3. Отображаем интерфейс
            renderMainInterface(objectionsData, currentUser.first_name);

        } catch (error) {
            console.error(error);
            showError(`Произошла критическая ошибка: ${error.message}`);
        }
    }

    // --- ФУНКЦИИ УПРАВЛЕНИЯ ИНТЕРФЕЙСОМ ---
    function showLoader(text) { appContainer.innerHTML = `<div class="loader">${text}</div>`; }
    function showError(text) { appContainer.innerHTML = `<div class="error-screen"><h3>Ошибка</h3><p>${text}</p></div>`; }

    function renderMainInterface(data, userName) {
        if (tg.colorScheme) { document.body.className = tg.colorScheme; }
        appContainer.innerHTML = `
            <h1>Привет, ${userName}!</h1><p>Поиск по возражениям</p>
            <div class="controls">
                <input type="text" id="searchInput" placeholder="Введите ключевое слово для поиска...">
                <div class="filters">
                    <button class="filter-btn active" data-filter="all">Все</button>
                    <button class="filter-btn" data-filter="Упаковка">Упаковка</button>
                    <button class="filter-btn" data-filter="Брокеридж">Брокеридж</button>
                </div>
            </div>
            <div id="resultsContainer"></div>`;
        setupEventListeners(data);
    }

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

            const objectionNotes = userPersonalData.notes[record.id] || [];
            const objectionRatings = userPersonalData.ratings[record.id] || [];

            const currentUserRatingObj = objectionRatings.find(r => r.authorId === currentUser.id);
            const currentUserNoteObj = objectionNotes.find(n => n.authorId === currentUser.id);

            const currentUserRating = currentUserRatingObj?.value || 0;
            const currentUserNote = currentUserNoteObj?.text || '';

            const othersNotesHTML = objectionNotes
                .filter(n => n.authorId !== currentUser.id)
                .map(n => `<div class="note-item"><div class="note-author">${n.author || 'Аноним'} написал:</div><div class="note-text">${n.text}</div></div>`)
                .join('');

            const averageRating = objectionRatings.length > 0 ? Math.round(objectionRatings.reduce((sum, r) => sum + r.value, 0) / objectionRatings.length) : 0;

            card.innerHTML = `
                <h3>${record.question} <span class="category-badge">${record.category}</span></h3>
                <p>${record.answer ? record.answer.replace(/\n/g, '<br>') : ''}</p>
                
                <div class="user-interaction">
                    <h4>Ваш отзыв:</h4>
                    <div class="rating-stars" data-objection-id="${record.id}">
                        ${[1, 2, 3, 4, 5].map(star => `<span class="star ${star <= currentUserRating ? 'filled' : ''}" data-value="${star}">★</span>`).join('')}
                    </div>
                    <textarea class="note-input" data-objection-id="${record.id}" placeholder="Ваша личная заметка...">${currentUserNote}</textarea>
                    <div class="card-actions">
                        <button class="action-btn" data-action="save" data-id="${record.id}">Подтвердить</button>
                        ${(currentUserRatingObj || currentUserNoteObj) ? `<button class="action-btn delete" data-action="delete" data-id="${record.id}">Удалить мой отзыв</button>` : ''}
                    </div>
                </div>

                <div class="public-feedback">
                    <h4>Отзывы команды:</h4>
                    <div class="average-rating">Общий рейтинг: 
                        ${[1, 2, 3, 4, 5].map(star => `<span class="star small ${star <= averageRating ? 'filled' : ''}">★</span>`).join('')}
                        (${objectionRatings.length} оценок)
                    </div>
                    <div class="notes-list">${othersNotesHTML.length > 0 ? othersNotesHTML : '<p class="no-feedback">Пока нет других заметок.</p>'}</div>
                </div>`;
            resultsContainer.appendChild(card);
        });
        setupInteractionListeners();
    }

    // --- ФУНКЦИИ ДЛЯ РАБОТЫ С СЕРВЕРОМ ---
    async function saveData(objectionId, noteText, ratingValue) {
        try {
            tg.showProgress();
            await supabaseClient.functions.invoke('save-user-data', {
                body: { userId: currentUser.id, objectionId, note: noteText, rating: ratingValue }
            });
            tg.showAlert('Ваш отзыв сохранен!');
            main(); // Перезагружаем все данные для обновления
        } catch (error) {
            console.error("Failed to save data:", error);
            tg.showAlert('Ошибка сохранения.');
        } finally {
            tg.hideProgress();
        }
    }

    async function deleteData(objectionId) {
        try {
            tg.showProgress();
            await Promise.all([
                supabaseClient.functions.invoke('delete-user-data', { body: { userId: currentUser.id, objectionId, type: 'note' } }),
                supabaseClient.functions.invoke('delete-user-data', { body: { userId: currentUser.id, objectionId, type: 'rating' } })
            ]);
            tg.showAlert('Ваш отзыв удален.');
            main(); // Перезагружаем все данные для обновления
        } catch (error) {
            console.error("Failed to delete data:", error);
            tg.showAlert('Ошибка удаления.');
        } finally {
            tg.hideProgress();
        }
    }

    // --- ФУНКЦИИ-СЛУШАТЕЛИ СОБЫТИЙ ---
    function setupInteractionListeners() {
        // Клик по звездам (только визуальное изменение)
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

        // Клик по кнопкам "Подтвердить" и "Удалить"
        document.querySelectorAll('.action-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const objectionId = parseInt(e.target.dataset.id);
                const action = e.target.dataset.action;

                if (action === 'save') {
                    const noteInput = document.querySelector(`.note-input[data-objection-id="${objectionId}"]`);
                    const starsContainer = document.querySelector(`.rating-stars[data-objection-id="${objectionId}"]`);
                    const rating = starsContainer.querySelectorAll('.star.filled').length;
                    saveData(objectionId, noteInput.value, rating);
                } else if (action === 'delete') {
                    tg.showConfirm('Вы уверены, что хотите удалить свой отзыв для этого возражения?', (confirmed) => {
                        if (confirmed) {
                            deleteData(objectionId);
                        }
                    });
                }
            });
        });
    }

    function setupEventListeners(data) {
        const searchInput = document.getElementById('searchInput');
        const filterButtons = document.querySelectorAll('.filter-btn');
        let currentFilter = 'all';
        const fuseOptions = { keys: ['question'], threshold: 0.0, minMatchCharLength: 3, useExtendedSearch: true, ignoreLocation: true };

        function performSearch() {
            const searchTerm = searchInput.value;
            let dataToSearch = data;
            if (currentFilter !== 'all') {
                dataToSearch = data.filter(item => item.category === currentFilter);
            }
            if (searchTerm.trim().length < 3) {
                renderResults(dataToSearch);
                return;
            }
            const fuseInstance = new Fuse(dataToSearch, fuseOptions);
            const extendedSearchTerm = searchTerm.split(' ').filter(word => word.length >= 3).map(word => `'${word}`).join(' | ');
            renderResults(fuseInstance.search(extendedSearchTerm));
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
        renderResults(data);
    }

    // Запускаем приложение
    main();
});