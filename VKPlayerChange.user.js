// ==UserScript==
// @name         VK Video Live - Смена плеера (с отслеживанием навигации)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Заменяет плеер VK Live на плеер Kick, YouTube или Twitch
// @author       Assistant
// @match        https://live.vkvideo.ru/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Конфигурация
    const CONFIG = {
        buttonId: 'vk-live-player-switcher',
        restoreButtonId: 'vk-live-player-restore',
        storageKey: 'vk_live_temp_data'
    };

    // Функции для генерации embed-кода
    const embedGenerators = {
        youtube: (input) => {
            let videoId = input;
            const patterns = [
                /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
                /^([a-zA-Z0-9_-]{11})$/
            ];
            for (const pattern of patterns) {
                const match = input.match(pattern);
                if (match) {
                    videoId = match[1];
                    break;
                }
            }
            return {
                embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`,
                isValid: videoId.length === 11
            };
        },
        twitch: (input) => {
            let channel = input;
            const patterns = [
                /(?:twitch\.tv\/)([a-zA-Z0-9_]+)/,
                /^([a-zA-Z0-9_]+)$/
            ];
            for (const pattern of patterns) {
                const match = input.match(pattern);
                if (match) {
                    channel = match[1];
                    break;
                }
            }
            return {
                embedUrl: `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&autoplay=true`,
                isValid: channel.length > 0
            };
        },
        kick: (input) => {
            let channel = input;
            const patterns = [
                /(?:kick\.com\/)([a-zA-Z0-9_]+)/,
                /^([a-zA-Z0-9_]+)$/
            ];
            for (const pattern of patterns) {
                const match = input.match(pattern);
                if (match) {
                    channel = match[1];
                    break;
                }
            }
            return {
                embedUrl: `https://player.kick.com/${channel}?autoplay=true&parent=${window.location.hostname}`,
                altEmbedUrl: `https://kick.com/embed/${channel}?autoplay=1`,
                isValid: channel.length > 0
            };
        }
    };

    // Поиск контейнера ChannelButtons
    function findChannelButtonsContainer() {
        const container = document.querySelector('.ChannelButtons_root_ONage');
        if (container) return container;

        const altSelectors = [
            '[class*="ChannelButtons_root"]',
            '[class*="ChannelButtons"]',
            '.video_action_buttons',
            '.video-actions',
            '.VideoActions'
        ];

        for (const selector of altSelectors) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        return null;
    }

    // Создание кнопки смены плеера
    function createSwitchButton() {
        const button = document.createElement('button');
        button.id = CONFIG.buttonId;
        button.innerHTML = `
            <span style="display: flex; align-items: center; gap: 6px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
                   <path d="M21 16l-4 4-4-4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
                   <path d="M17 20V4" stroke="currentColor" stroke-linecap="round"/>
                   <path d="M3 8l4-4 4 4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
                   <path d="M7 4v16" stroke="currentColor" stroke-linecap="round"/>
                </svg>
                <span>Сменить плеер</span>
            </span>
        `;
        button.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 8px 16px;
            background: #4a76a8;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            transition: all 0.2s ease;
            margin-left: 8px;
        `;
        button.onmouseenter = () => {
            button.style.background = '#5a86b8';
            button.style.transform = 'translateY(-1px)';
        };
        button.onmouseleave = () => {
            button.style.background = '#4a76a8';
            button.style.transform = 'translateY(0)';
        };
        return button;
    }

    // Создание кнопки возврата
    function createRestoreButton() {
        const button = document.createElement('button');
        button.id = CONFIG.restoreButtonId;
        button.innerHTML = `
            <span style="display: flex; align-items: center; gap: 6px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 12L6 9L3 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M6 9H18V18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M12 15L15 12L12 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>Вернуть VK</span>
            </span>
        `;
        button.style.cssText = `
            display: none;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 8px 16px;
            background: #e64646;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            transition: all 0.2s ease;
            margin-left: 8px;
        `;
        button.onmouseenter = () => {
            button.style.background = '#f65656';
            button.style.transform = 'translateY(-1px)';
        };
        button.onmouseleave = () => {
            button.style.background = '#e64646';
            button.style.transform = 'translateY(0)';
        };
        button.onclick = () => {
            localStorage.removeItem(CONFIG.storageKey);
            location.reload();
        };
        return button;
    }

    // Удаление старых кнопок
    function removeOldButtons() {
        const oldSwitchBtn = document.getElementById(CONFIG.buttonId);
        const oldRestoreBtn = document.getElementById(CONFIG.restoreButtonId);
        if (oldSwitchBtn) oldSwitchBtn.remove();
        if (oldRestoreBtn) oldRestoreBtn.remove();
    }

    // Вставка кнопок в контейнер
    function insertButtons() {
        const container = findChannelButtonsContainer();
        if (!container) return false;

        // Удаляем старые кнопки
        removeOldButtons();

        const switchBtn = createSwitchButton();
        const restoreBtn = createRestoreButton();

        switchBtn.onclick = openModal;

        container.appendChild(switchBtn);
        container.appendChild(restoreBtn);

        console.log('Кнопки успешно вставлены');
        return true;
    }

    // Создание уведомления
    function createNotice(message, color) {
        const notice = document.createElement('div');
        notice.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 20px;
            z-index: 10001;
            background: ${color};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-family: monospace;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease, fadeOut 3s forwards 2.7s;
        `;
        notice.textContent = message;
        return notice;
    }

    // Замена плеера
    function replacePlayer(platform, input) {
        const generator = embedGenerators[platform];
        if (!generator) {
            alert('Неподдерживаемая платформа');
            return;
        }

        const result = generator(input);
        if (!result.isValid) {
            alert('Неверный формат. Проверьте ссылку или ID канала.');
            return;
        }

        let embedUrl = result.embedUrl;
        if (platform === 'kick' && !embedUrl) {
            embedUrl = result.altEmbedUrl;
        }

        const container = findPlayerContainer();
        if (!container) {
            alert('Не удалось найти контейнер с плеером VK Live.');
            return;
        }

        // Сохраняем данные
        localStorage.setItem(CONFIG.storageKey, JSON.stringify({
            platform: platform,
            input: input,
            embedUrl: embedUrl,
            timestamp: Date.now(),
            url: window.location.href
        }));

        // Очищаем контейнер
        container.innerHTML = '';
        container.style.position = 'relative';
        container.style.background = '#000';

        // Создаем iframe
        const iframe = document.createElement('iframe');
        iframe.src = embedUrl;
        iframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            position: absolute;
            top: 0;
            left: 0;
            z-index: 5;
        `;
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        iframe.allowFullscreen = true;
        iframe.id = 'custom-player-iframe';

        // Overlay с информацией
        const overlay = document.createElement('div');
        overlay.id = 'custom-player-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            z-index: 10;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-family: monospace;
            pointer-events: none;
            backdrop-filter: blur(4px);
        `;
        overlay.textContent = `${platform.toUpperCase()} Live | ${input}`;

        container.appendChild(iframe);
        container.appendChild(overlay);

        console.log(`Плеер заменен на ${platform}: ${input}`);

        // Показываем кнопку возврата
        const restoreBtn = document.getElementById(CONFIG.restoreButtonId);
        if (restoreBtn) restoreBtn.style.display = 'inline-flex';

        // Уведомление
        const notice = createNotice(`Плеер ${platform.toUpperCase()} загружен!`,
            platform === 'youtube' ? '#FF0000' : platform === 'twitch' ? '#9146FF' : '#53FC18');
        document.body.appendChild(notice);
        setTimeout(() => notice.remove(), 3000);
    }

    // Поиск контейнера с плеером
    function findPlayerContainer() {
        const selectors = [
            '.root-container',
            '.videoplayer_ui',
            '.video_player_container',
            '.video-module',
            '[data-module="videoplayer"]',
            '.VideoBlock',
            '.video_layer'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.offsetHeight > 200) {
                return element;
            }
        }

        const videos = document.querySelectorAll('iframe, video');
        for (const video of videos) {
            const parent = video.closest('div[style*="position"], div.videoplayer_ui, div.root-container');
            if (parent && parent.offsetHeight > 200) {
                return parent;
            }
        }

        return null;
    }

    // Модальное окно
    function createModal() {
        const modal = document.createElement('div');
        modal.id = 'player-switcher-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: #2b2b2c;
            border-radius: 12px;
            padding: 24px;
            width: 400px;
            max-width: 90%;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        `;

        content.innerHTML = `
            <h3 style="margin: 0 0 20px 0; font-size: 20px;">Выберите платформу</h3>
            <div style="display: flex; gap: 12px; margin-bottom: 20px;">
                <button data-platform="youtube" style="flex:1; padding: 10px; background: #FF0000; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">YouTube</button>
                <button data-platform="twitch" style="flex:1; padding: 10px; background: #9146FF; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Twitch</button>
                <button data-platform="kick" style="flex:1; padding: 10px; background: #53FC18; color: black; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Kick</button>
            </div>
            <div id="platform-input-container" style="margin-top: 20px;"></div>
            <div id="kick-warning" style="display: none; margin-top: 12px; padding: 8px; background: #fff3cd; border-radius: 6px; font-size: 12px; color: #856404;">
                ⚠️ Для Kick: введите точное имя канала. Канал должен существовать и быть активным.
            </div>
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button id="modal-cancel" style="flex:1; padding: 10px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">Отмена</button>
            </div>
        `;

        modal.appendChild(content);
        return modal;
    }

    function createInputField(platform) {
        const container = document.getElementById('platform-input-container');
        const warningDiv = document.getElementById('kick-warning');
        const platformNames = {
            youtube: 'YouTube',
            twitch: 'Twitch',
            kick: 'Kick'
        };

        if (platform === 'kick') {
            if (warningDiv) warningDiv.style.display = 'block';
        } else {
            if (warningDiv) warningDiv.style.display = 'none';
        }

        container.innerHTML = `
            <label style="display: block; margin-bottom: 8px; font-weight: bold;">Введите ник или ссылку на трансляцию ${platformNames[platform]}:</label>
            <input type="text" id="player-input" placeholder="Пример: ${platform === 'youtube' ? 'https://youtube.com/watch?v=... или ID' : platform === 'twitch' ? 'username или twitch.tv/username' : 'username или kick.com/username'}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
            <button id="submit-player" style="margin-top: 12px; width: 100%; padding: 10px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Подтвердить</button>
        `;

        const input = document.getElementById('player-input');
        const submitBtn = document.getElementById('submit-player');

        submitBtn.onclick = () => {
            const value = input.value.trim();
            if (value) {
                replacePlayer(platform, value);
                closeModal();
            } else {
                input.style.borderColor = 'red';
                setTimeout(() => input.style.borderColor = '#ddd', 2000);
            }
        };

        input.onkeypress = (e) => {
            if (e.key === 'Enter') submitBtn.click();
        };
    }

    let currentModal = null;
    function openModal() {
        if (currentModal) closeModal();

        currentModal = createModal();
        document.body.appendChild(currentModal);

        const platformButtons = currentModal.querySelectorAll('[data-platform]');
        platformButtons.forEach(btn => {
            btn.onclick = () => {
                const platform = btn.dataset.platform;
                createInputField(platform);
            };
        });

        const cancelBtn = currentModal.querySelector('#modal-cancel');
        cancelBtn.onclick = () => closeModal();

        currentModal.onclick = (e) => {
            if (e.target === currentModal) closeModal();
        };
    }

    function closeModal() {
        if (currentModal) {
            currentModal.remove();
            currentModal = null;
        }
    }

    // CSS анимации
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes fadeOut {
                0% { opacity: 1; }
                70% { opacity: 1; }
                100% { opacity: 0; visibility: hidden; }
            }
        `;
        document.head.appendChild(style);
    }

    // Главный наблюдатель за изменениями на странице
    function initObserver() {
        // Флаг, чтобы не дублировать вставку
        let isInserting = false;

        // Наблюдатель за изменениями в DOM
        const observer = new MutationObserver(() => {
            if (isInserting) return;

            const container = findChannelButtonsContainer();
            const existingButtons = document.getElementById(CONFIG.buttonId);

            // Если контейнер есть, а кнопок нет - вставляем
            if (container && !existingButtons) {
                isInserting = true;
                setTimeout(() => {
                    insertButtons();
                    isInserting = false;
                }, 100);
            }
        });

        // Начинаем наблюдение за всей страницей
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });

        // Первоначальная вставка
        setTimeout(() => {
            insertButtons();
        }, 500);

        // Также следим за изменением URL (SPA навигация)
        let lastUrl = location.href;
        const urlObserver = new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                console.log('URL изменен, перевставляем кнопки');
                setTimeout(() => {
                    insertButtons();
                }, 500);
            }
        });
        urlObserver.observe(document.body, { subtree: true, childList: true });
    }

    // Инициализация
    function init() {
        addStyles();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initObserver);
        } else {
            initObserver();
        }
    }

    init();
})();
