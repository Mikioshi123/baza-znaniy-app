// --- СПЕЦИАЛЬНАЯ ОТЛАДОЧНАЯ ВЕРСИЯ ---
document.addEventListener('DOMContentLoaded', async () => {
    const SUPABASE_URL = 'https://adyqqfkwgdzanpgsvzgl.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkeXFxZmt3Z2R6YW5wZ3N2emdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NTM1NTgsImV4cCI6MjA2NzEyOTU1OH0.rfFekXWr933GcjA2JZQ2gvUObS3zuzctDQZvZfopP2g';

    const appContainer = document.getElementById('appContainer');
    console.log('App starting in debug mode...');
    appContainer.innerHTML = `<div class="loader">Starting debug test...</div>`;

    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    try {
        console.log("Attempting to invoke 'check-and-add-employee'...");

        // Мы имитируем вызов с фейковым пользователем, чтобы проверить СЕТЕВОЕ СОЕДИНЕНИЕ
        const { data, error } = await supabaseClient.functions.invoke('check-and-add-employee', {
            body: { user: { id: 12345, first_name: "Debug" } }
        });

        if (error) {
            console.error('--- ERROR RECEIVED ---');
            console.error('Function invocation failed with error:', error);
            showError(`Тест провален. Ошибка при вызове функции: ${error.message}`);
        } else {
            console.log('--- SUCCESS RECEIVED ---');
            console.log('Function returned data:', data);
            appContainer.innerHTML = `<div class="success">Тест пройден! Соединение с функцией установлено. Ответ: <pre>${JSON.stringify(data, null, 2)}</pre></div>`;
        }

    } catch (e) {
        console.error('--- CRITICAL CATCH ---');
        console.error('A critical network or CORS error occurred:', e);
        showError(`Критический сбой. Не удалось отправить запрос. Проверьте вкладку Network. Ошибка: ${e.message}`);
    }

    function showError(text) { appContainer.innerHTML = `<div class="error-screen">${text}</div>`; }
});
