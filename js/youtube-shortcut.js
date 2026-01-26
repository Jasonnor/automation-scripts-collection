// ==UserScript==
// @name         YouTube Shortcut
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Press "p" to hide/display video control panel
// @author       Jasonnor
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=www.youtube.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const SHORTCUT_KEY = 'p';
  const TOGGLE_CLASS = 'yt-controls-hidden';
  const SELECTORS = [
    '.ytp-chrome-bottom',
    '.ytp-gradient-top',
    '.ytp-chrome-top',
    '.ytp-gradient-bottom',
    '.ytp-overlays-container',
    '.ytp-fullscreen-grid',
    '.annotation',
    '.ytp-bezel-container',
    '.ytp-bezel',
    '.ytp-doubletap-ui-container',
    '.ytp-bezel-text-wrapper'
  ];

  // Inject CSS for performance and to handle dynamic elements
  const style = document.createElement('style');
  style.textContent = `
    body.${TOGGLE_CLASS} ${SELECTORS.join(`, body.${TOGGLE_CLASS} `)} {
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  function isTyping(event) {
    const { tagName } = event.target;
    return (
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      event.target.isContentEditable
    );
  }

  document.addEventListener('keydown', (event) => {
    // Prevent trigger when typing in input fields
    if (isTyping(event)) return;

    if (event.key === SHORTCUT_KEY) {
      const isHidden = document.body.classList.toggle(TOGGLE_CLASS);
      console.info(isHidden ? 'Hide video controls.' : 'Display video controls.');
    }
  }, false);
})();
