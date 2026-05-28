// ==UserScript==
// @name         YouTube Video Milliseconds Display & Copier
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Display YouTube video milliseconds and provide a copy button (format: [HH:]MM:SS[.milliseconds])
// @author       Jasonnor
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=www.youtube.com
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let isVisible = localStorage.getItem('yt-ms-visible') !== 'false';
    let cachedVideo = null;
    let cachedContainer = null;
    let lastTime = -1;
    let isLooping = false;
    let menuCommandId = null;

    function formatTime(timeInSeconds) {
        const hrs = Math.floor(timeInSeconds / 3600);
        const mins = Math.floor((timeInSeconds % 3600) / 60);
        const secs = Math.floor(timeInSeconds % 60);
        const ms = Math.floor((timeInSeconds % 1) * 1000);

        const msStr = String(ms).padStart(3, '0');
        const secsStr = String(secs).padStart(2, '0');
        const minsStr = String(mins).padStart(2, '0');

        if (hrs > 0) {
            const hrsStr = String(hrs).padStart(2, '0');
            return `${hrsStr}:${minsStr}:${secsStr}.${msStr}`;
        }
        return `${minsStr}:${secsStr}.${msStr}`;
    }

    function toggleVisibility() {
        isVisible = !isVisible;
        localStorage.setItem('yt-ms-visible', isVisible);
        updateVisibility();
        registerMenu();
    }

    function updateVisibility() {
        const container = document.getElementById('ytp-time-ms-container');
        if (container) {
            container.style.setProperty('display', isVisible ? 'inline-flex' : 'none', 'important');
        }
    }

    function registerMenu() {
        if (typeof GM_registerMenuCommand !== 'undefined') {
            try {
                if (menuCommandId !== null && typeof GM_unregisterMenuCommand !== 'undefined') {
                    GM_unregisterMenuCommand(menuCommandId);
                }
                const commandText = isVisible ? 'Hide Milliseconds' : 'Show Milliseconds';
                menuCommandId = GM_registerMenuCommand(commandText, toggleVisibility);
            } catch (e) {
                console.error('Failed to register menu command:', e);
            }
        }
    }

    function createSvgIcon(pathD, fill = 'currentColor', width = 14, height = 14) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', width.toString());
        svg.setAttribute('height', height.toString());
        svg.setAttribute('fill', fill);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD);
        svg.appendChild(path);
        return svg;
    }

    function createMsContainer(parent) {
        const container = document.createElement('span');
        container.id = 'ytp-time-ms-container';
        container.className = 'ytp-time-ms-container';
        container.style.cssText = 'display: inline-flex; align-items: center; margin-left: 8px; color: #ddd; font-family: "YouTube Noto", Roboto, Arial, sans-serif; font-size: 13px; vertical-align: top; user-select: none;';

        const divider = document.createElement('span');
        divider.className = 'ytp-time-ms-divider';
        divider.textContent = '|';
        divider.style.cssText = 'margin-right: 8px; color: #666; font-weight: normal;';
        container.appendChild(divider);

        const text = document.createElement('span');
        text.className = 'ytp-time-ms-text';
        text.textContent = '00:00.000';
        text.style.cssText = 'font-weight: 500; font-feature-settings: "tnum" 1; font-variant-numeric: tabular-nums;';
        container.appendChild(text);

        // Copy Button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'ytp-time-ms-copy';
        copyBtn.title = 'Copy current time ([HH:]MM:SS[.milliseconds])';
        copyBtn.style.cssText = 'background: none; border: none; color: #aaa; cursor: pointer; margin-left: 6px; padding: 2px 4px; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; transition: all 0.2s ease; outline: none;';

        copyBtn.onmouseenter = () => {
            copyBtn.style.color = '#fff';
            copyBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
        };
        copyBtn.onmouseleave = () => {
            copyBtn.style.color = '#aaa';
            copyBtn.style.backgroundColor = 'transparent';
        };

        const copyPath = 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z';
        const checkPath = 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z';
        const copyIcon = createSvgIcon(copyPath, 'currentColor', 14, 14);
        const checkIcon = createSvgIcon(checkPath, '#2ba640', 14, 14);
        copyBtn.appendChild(copyIcon);

        copyBtn.onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(text.textContent).then(() => {
                copyBtn.replaceChildren(checkIcon);
                setTimeout(() => {
                    copyBtn.replaceChildren(copyIcon);
                }, 1500);
            }).catch(err => console.error('Failed to copy:', err));
        };
        container.appendChild(copyBtn);

        // Close Button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'ytp-time-ms-close';
        closeBtn.title = 'Hide panel (re-enable from Tampermonkey menu)';
        closeBtn.style.cssText = 'background: none; border: none; color: #777; cursor: pointer; margin-left: 2px; padding: 2px 4px; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; transition: all 0.2s ease; outline: none;';

        const closePath = 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';
        const closeIcon = createSvgIcon(closePath, 'currentColor', 12, 12);
        closeBtn.appendChild(closeIcon);

        closeBtn.onmouseenter = () => {
            closeBtn.style.color = '#ff4d4f';
            closeBtn.style.backgroundColor = 'rgba(255, 0, 0, 0.15)';
        };
        closeBtn.onmouseleave = () => {
            closeBtn.style.color = '#777';
            closeBtn.style.backgroundColor = 'transparent';
        };

        closeBtn.onclick = (e) => {
            e.stopPropagation();
            toggleVisibility();
        };
        container.appendChild(closeBtn);

        const durationEl = parent.querySelector('.ytp-time-duration');
        if (durationEl) {
            durationEl.insertAdjacentElement('afterend', container);
        } else {
            parent.appendChild(container);
        }

        return container;
    }

    function updateDisplay() {
        if (!cachedVideo || !document.body.contains(cachedVideo)) {
            cachedVideo = document.querySelector('video');
        }
        if (!cachedVideo) return;

        if (!cachedContainer || !document.body.contains(cachedContainer)) {
            const timeDisplay = document.querySelector('.ytp-time-display');
            if (timeDisplay) {
                cachedContainer = createMsContainer(timeDisplay);
                updateVisibility();
            }
        }
        if (!cachedContainer) return;

        if (cachedVideo.currentTime !== lastTime) {
            lastTime = cachedVideo.currentTime;
            const textEl = cachedContainer.querySelector('.ytp-time-ms-text');
            if (textEl) {
                textEl.textContent = formatTime(lastTime);
            }
        }
    }

    function startLoop() {
        if (isLooping) return;
        isLooping = true;
        const loop = () => {
            if (!isLooping) return;
            updateDisplay();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    function stopLoop() {
        isLooping = false;
        updateDisplay();
    }

    function checkAndSetup() {
        const video = document.querySelector('video');
        const timeDisplay = document.querySelector('.ytp-time-display');

        if (video && timeDisplay) {
            if (!cachedContainer || !document.body.contains(cachedContainer)) {
                updateDisplay();
            }

            if (!video._msListenersAttached) {
                video.addEventListener('play', startLoop);
                video.addEventListener('pause', stopLoop);
                video.addEventListener('seeking', updateDisplay);
                video.addEventListener('seeked', updateDisplay);
                video.addEventListener('timeupdate', updateDisplay);
                video._msListenersAttached = true;

                if (!video.paused) {
                    startLoop();
                }
            }
        }
    }

    registerMenu();
    setInterval(checkAndSetup, 1000);
})();
