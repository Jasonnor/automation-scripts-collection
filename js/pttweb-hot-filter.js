// ==UserScript==
// @name         PTTWeb Post Filter
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Auto-hide post from boards by keywords on PTTWeb hot page.
// @author       Jasonnor
// @match        https://www.pttweb.cc/hot/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=pttweb.cc
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // Keywords to filter out (case-insensitive)
  const filterList = ['car', 'watch', 'CarShop', 'facelift', 'Jewelry'];
  const filterLower = filterList.map((s) => s.toLowerCase());

  // Debug logging
  const DEBUG = true; // set false to disable logs
  const LOG_PREFIX = '[PTTWeb Hot Filter]';

  // Logging helpers
  function logDebug(...args) {
    if (DEBUG) console.debug(LOG_PREFIX, ...args);
  }
  function logInfo(...args) {
    if (DEBUG) console.info(LOG_PREFIX, ...args);
  }

  function getAncestor(el, level) {
    let node = el;
    for (let i = 0; i < level && node; i++) {
      node = node.parentNode;
    }
    return node || null;
  }

  function applyFilter() {
    const spans = document.querySelectorAll('a.e7-boardName > span:not([data-pttweb-checked])');
    const total = spans ? spans.length : 0;
    if (!spans || total === 0) {
      return;
    }

    let matchedCount = 0;
    let removedCount = 0;

    for (const span of spans) {
      span.dataset.pttwebChecked = '1';
      const text = (span.textContent || '').toLowerCase();
      const matched = filterLower.some((k) => text.includes(k));
      if (!matched) continue;
      matchedCount++;

      const target = getAncestor(span, 5); // parentNode x5 (expected to be the wrapping div)
      if (target && target.nodeType === 1) {
        // Avoid double work by marking
        if (!target.dataset?.pttwebFiltered) {
          target.dataset.pttwebFiltered = '1';
          target.remove();
          removedCount++;
          logDebug('Removed an item for board:', (span.textContent || '').trim());
        }
      }
    }

    logDebug(`Scanned: ${total}, Matched: ${matchedCount}, Removed: ${removedCount}`);
  }

  function start() {
    logInfo('Starting filter at', new Date().toLocaleString());
    applyFilter();
    // Loop every 100ms
    setInterval(() => {
      applyFilter();
    }, 100);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(start, 2000);
  } else {
    globalThis.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
