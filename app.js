// Конфигурация приложения
const CONFIG = {
    // URL вашего Google Apps Script Web App (замените на свой после деплоя)
    API_URL: 'https://script.google.com/macros/s/AKfycbyl2aY5zMb2-93fPfucqdoZnV4f4sIjsxmtZ14lgcEms974K-JMhgzr7AuDAR_6EmSVaw/exec',
    // Максимальная стоимость подарка (вынесено в переменную)
    MAX_GIFT_PRICE: 1000
};

// Состояние приложения
let appState = {
    currentUser: null,
    isAdmin: false,
    password: null,
    gameStatus: null
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

/**
 * Инициализация приложения
 */
function initializeApp() {
    // Настройка Telegram Web App
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
    }

    // Обработчики событий
    setupEventListeners();
    
    // Установка максимальной цены в интерфейсе
    document.getElementById('maxPrice').textContent = CONFIG.MAX_GIFT_PRICE;
}

/**
 * Настройка обработчиков событий
 */
function setupEventListeners() {
    // Форма входа
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Кнопки пользователя
    document.getElementById('orderGiftBtn').addEventListener('click', showGiftModal);
    document.getElementById('viewGiftBtn').addEventListener('click', handleViewGift);
    document.getElementById('rulesBtn').addEventListener('click', showRulesModal);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Кнопки админа
    document.getElementById('addUserForm').addEventListener('submit', handleAddUser);
    document.getElementById('runDistributionBtn').addEventListener('click', handleRunDistribution);
    document.getElementById('adminLogoutBtn').addEventListener('click', handleLogout);
    
    // Модальные окна
    setupModalListeners();
}

/**
 * Настройка обработчиков модальных окон
 */
function setupModalListeners() {
    // Закрытие модальных окон по клику на крестик
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });
    
    // Закрытие модальных окон по клику вне их
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
    
    // Форма заказа подарка
    document.getElementById('giftForm').addEventListener('submit', handleSubmitGift);
    
    // Кнопка OK в предупреждении
    document.getElementById('warningOkBtn').addEventListener('click', () => {
        closeModal('warningModal');
    });
}

/**
 * Показать индикатор загрузки
 */
function showLoading() {
    document.getElementById('loadingOverlay').classList.add('active');
}

/**
 * Скрыть индикатор загрузки
 */
function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

/**
 * Универсальная функция для API запросов к Google Apps Script
 */
async function apiRequest(params) {
    const url = new URL(CONFIG.API_URL);
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
            url.searchParams.append(key, String(params[key]));
        }
    });
    
    const response = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'follow'
    });
    
    return await response.json();
}

/**
 * Обработка входа
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const password = document.getElementById('passwordInput').value.trim();
    const errorDiv = document.getElementById('loginError');
    
    if (!password) {
        showError(errorDiv, 'Введите пароль');
        return;
    }
    
    try {
        showLoading();
        // Вызов API для входа
        const data = await apiRequest({
            action: 'login',
            password: password
        });
        
        if (data.success) {
            appState.password = password;
            appState.isAdmin = data.isAdmin;
            appState.currentUser = data.user;
            
            // Переход на соответствующий экран
            if (data.isAdmin) {
                showScreen('adminScreen');
                loadAdminData();
            } else {
                showScreen('userScreen');
                loadUserData();
            }
            
            // Очистка формы
            document.getElementById('passwordInput').value = '';
            hideError(errorDiv);
        } else {
            showError(errorDiv, data.message || 'Неверный пароль');
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
        showError(errorDiv, 'Ошибка соединения. Проверьте настройки API.');
    } finally {
        hideLoading();
    }
}

/**
 * Загрузка данных пользователя
 */
async function loadUserData() {
    try {
        showLoading();
        // Получение данных пользователя
        const userData = await apiRequest({
            action: 'getUserData',
            password: appState.password
        });
        
        if (userData.success) {
            appState.currentUser = userData.user;
            document.getElementById('userName').textContent = userData.user.name;
            
            // Обновление статуса игры
            await updateGameStatus();
            
            // Обновление состояния кнопок
            updateUserButtons();
        }
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    } finally {
        hideLoading();
    }
}

/**
 * Обновление статуса игры
 */
async function updateGameStatus() {
    try {
        const data = await apiRequest({
            action: 'getStatus'
        });
        
        if (data.success) {
            appState.gameStatus = data.status;
            const statusDiv = document.getElementById('gameStatus');
            const statusText = document.getElementById('statusText');
            
            if (data.status.isDistributed) {
                statusText.innerHTML = `
                    ✅ <strong>Распределение выполнено</strong><br>
                    Дата распределения: ${formatDate(data.status.distributionDate)}<br>
                    Дедлайн подготовки подарка: ${formatDate(data.status.giftDeadline)}
                `;
            } else {
                statusText.innerHTML = `
                    ⏳ <strong>Ожидание распределения</strong><br>
                    Администратор еще не запустил распределение участников
                `;
            }
        }
    } catch (error) {
        console.error('Ошибка получения статуса:', error);
    }
}

/**
 * Обновление состояния кнопок пользователя
 */
function updateUserButtons() {
    const viewGiftBtn = document.getElementById('viewGiftBtn');
    const orderGiftBtn = document.getElementById('orderGiftBtn');
    
    // Проверка, заказан ли уже подарок
    if (appState.currentUser && appState.currentUser.gift_request) {
        orderGiftBtn.disabled = true;
        orderGiftBtn.textContent = '🎁 Подарок уже заказан';
        orderGiftBtn.style.opacity = '0.6';
        orderGiftBtn.style.cursor = 'not-allowed';
    }
}

/**
 * Показать модальное окно заказа подарка
 */
function showGiftModal() {
    // Проверка, не заказан ли уже подарок
    if (appState.currentUser && appState.currentUser.gift_request) {
        showWarning('Вы уже заказали подарок. Редактирование запрещено.');
        return;
    }
    
    // Очистка формы
    document.getElementById('giftForm').reset();
    document.getElementById('giftFormError').classList.remove('active');
    
    showModal('giftModal');
}

/**
 * Обработка отправки заказа подарка
 */
async function handleSubmitGift(e) {
    e.preventDefault();
    
    const text = document.getElementById('giftText').value.trim();
    const link = document.getElementById('giftLink').value.trim();
    const errorDiv = document.getElementById('giftFormError');
    
    if (!text) {
        showError(errorDiv, 'Введите описание подарка');
        return;
    }
    
    // Проверка, не заказан ли уже подарок
    if (appState.currentUser && appState.currentUser.gift_request) {
        showError(errorDiv, 'Вы уже заказали подарок');
        return;
    }
    
    // Предупреждение перед отправкой
    const confirmed = confirm('Вы уверены? После сохранения редактирование будет невозможно.');
    if (!confirmed) {
        return;
    }
    
    try {
        showLoading();
        const data = await apiRequest({
            action: 'submitGift',
            password: appState.password,
            text: text,
            link: link
        });
        
        if (data.success) {
            // Обновление данных пользователя
            appState.currentUser.gift_request = text;
            appState.currentUser.gift_link = link;
            
            // Закрытие модального окна
            closeModal('giftModal');
            
            // Обновление кнопок
            updateUserButtons();
            
            // Показ сообщения об успехе
            alert('Подарок успешно заказан! 🎁');
        } else {
            showError(errorDiv, data.message || 'Ошибка сохранения подарка');
        }
    } catch (error) {
        console.error('Ошибка сохранения подарка:', error);
        showError(errorDiv, 'Ошибка соединения');
    } finally {
        hideLoading();
    }
}

/**
 * Обработка просмотра подарка
 */
async function handleViewGift() {
    if (!appState.gameStatus || !appState.gameStatus.isDistributed) {
        showWarning('Ожидайте распределения. Администратор ещё не запустил распределение.');
        return;
    }

    try {
        showLoading();

        const data = await apiRequest({
            action: 'getRecipient',
            password: appState.password
        });

        const giftInfo = document.getElementById('giftInfo');

        if (!data.success) {
            showWarning(data.message || 'Ошибка загрузки данных');
            return;
        }

        const r = data.recipient;

        giftInfo.innerHTML = `
            <div class="gift-recipient">
                <p><strong>🎁 Вы дарите подарок:</strong></p>
                <p class="info-text">${r.name}</p>
            </div>

            <div class="gift-request">
                <p><strong>🎅 Этот человек заказал:</strong></p>
                <p class="info-text">${r.gift_request || 'Описание не указано'}</p>
                ${r.gift_link ? `<p class="info-text">Ссылка: <a href="${r.gift_link}" target="_blank" class="gift-link">${r.gift_link}</a></p>` : ''}
            </div>
        `;

        showModal('viewGiftModal');

    } catch (error) {
        console.error(error);
        showWarning('Ошибка соединения');
    } finally {
        hideLoading();
    }
}



/**
 * Показать модальное окно правил
 */
function showRulesModal() {
    showModal('rulesModal');
}

/**
 * Загрузка данных админа
 */
async function loadAdminData() {
    try {
        showLoading();
        await updateAdminStatus();
        await loadParticipants();
    } finally {
        hideLoading();
    }
}

/**
 * Обновление статуса в админ-панели
 */
async function updateAdminStatus() {
    try {
        const data = await apiRequest({
            action: 'getStatus'
        });
        
        if (data.success) {
            const statusDiv = document.getElementById('adminStatus');
            const statusText = document.getElementById('adminStatusText');
            
            if (data.status.isDistributed) {
                statusText.innerHTML = `
                    ✅ <strong>Распределение выполнено</strong><br>
                    Дата: ${formatDate(data.status.distributionDate)}<br>
                    Дедлайн: ${formatDate(data.status.giftDeadline)}
                `;
                document.getElementById('runDistributionBtn').disabled = true;
                document.getElementById('runDistributionBtn').textContent = 'Распределение уже выполнено';
                document.getElementById('runDistributionBtn').style.opacity = '0.6';
            } else {
                statusText.innerHTML = '⏳ <strong>Ожидание распределения</strong>';
            }
        }
    } catch (error) {
        console.error('Ошибка получения статуса:', error);
    }
}

/**
 * Загрузка списка участников
 */
async function loadParticipants() {
    const data = await apiRequest({
        action: 'getParticipants',
        adminPassword: appState.password
    });
    
    if (data.success) {
        const participantsList = document.getElementById('participantsList');
        const count = document.getElementById('participantsCount');
        
        count.textContent = data.participants.length;
        
        if (data.participants.length === 0) {
            participantsList.innerHTML = '<p class="info-text">Участников пока нет</p>';
        } else {
            participantsList.innerHTML = data.participants.map(p => `
                <div class="participant-item">
                    <span class="participant-name">${p.name}</span>
                    <span class="participant-password">${p.password}</span>
                </div>
            `).join('');
        }
    }
}

/**
 * Обработка добавления участника
 */
async function handleAddUser(e) {
    e.preventDefault();
    
    const name = document.getElementById('newUserName').value.trim();
    const password = document.getElementById('newUserPassword').value.trim();
    
    if (!name) {
        alert('Введите имя участника');
        return;
    }
    
    try {
        showLoading();
        const data = await apiRequest({
            action: 'addUser',
            adminPassword: appState.password,
            name: name,
            password: password || '' // Если пусто, сгенерируется автоматически
        });
        
        if (data.success) {
            // Очистка формы
            document.getElementById('addUserForm').reset();
            
            // Обновление списка участников
            await loadParticipants();
            
            alert(`Участник "${name}" добавлен! Пароль: ${data.password}`);
        } else {
            alert(data.message || 'Ошибка добавления участника');
        }
    } catch (error) {
        console.error('Ошибка добавления участника:', error);
        alert('Ошибка соединения');
    } finally {
        hideLoading();
    }
}

/**
 * Обработка запуска распределения
 */
async function handleRunDistribution() {
    const confirmed = confirm('Вы уверены, что хотите запустить распределение? Это действие нельзя отменить.');
    if (!confirmed) {
        return;
    }
    
    const errorDiv = document.getElementById('distributionError');
    hideError(errorDiv);
    
    try {
        showLoading();
        const data = await apiRequest({
            action: 'runDistribution',
            adminPassword: appState.password
        });
        
        if (data.success) {
            // Обновление статуса
            await updateAdminStatus();
            alert('Распределение успешно выполнено! 🎉');
        } else {
            showError(errorDiv, data.message || 'Ошибка распределения');
        }
    } catch (error) {
        console.error('Ошибка распределения:', error);
        showError(errorDiv, 'Ошибка соединения');
    } finally {
        hideLoading();
    }
}

/**
 * Обработка выхода
 */
function handleLogout() {
    appState = {
        currentUser: null,
        isAdmin: false,
        password: null,
        gameStatus: null
    };
    
    showScreen('loginScreen');
    document.getElementById('passwordInput').value = '';
}

/**
 * Показать экран
 */
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

/**
 * Показать модальное окно
 */
function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

/**
 * Закрыть модальное окно
 */
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

/**
 * Показать предупреждение
 */
function showWarning(message) {
    document.getElementById('warningMessage').textContent = message;
    showModal('warningModal');
}

/**
 * Показать ошибку
 */
function showError(errorDiv, message) {
    errorDiv.textContent = message;
    errorDiv.classList.add('active');
}

/**
 * Скрыть ошибку
 */
function hideError(errorDiv) {
    errorDiv.classList.remove('active');
    errorDiv.textContent = '';
}

/**
 * Форматирование даты
 */
function formatDate(dateString) {
    if (!dateString) return 'Не указано';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}
