// ==UserScript==
// @name         PTTWeb Auto-Visited
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Automatically background-open and close scrolled-past PTTWeb posts to native-mark them as visited.
// @author       Jasonnor
// @match        https://www.pttweb.cc/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=pttweb.cc
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const queue = [];
  let isProcessing = false;
  
  // Timings for background tab handling
  const TAB_WAIT_MS = 1000;    // Wait time after opening the tab before closing it
  const TAB_THROTTLE_MS = 500; // Delay before opening the next queued tab

  async function processQueue() {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;

    while (queue.length > 0) {
      const url = queue.shift();
      try {
        // Open the URL in background to trigger browser history recording.
        // insert: false prevents disrupting the user's immediate active tab order
        const tab = GM_openInTab(url, { active: false, insert: false });

        // Let the browser have enough time to request and register URL history
        await new Promise((resolve) => setTimeout(resolve, TAB_WAIT_MS));

        if (tab && typeof tab.close === 'function') {
          tab.close();
        }
      } catch (e) {
        console.error('[PTTWeb Auto-Visited] Error handling tab:', e);
      }

      // Small throttling delay to avoid overwhelming the browser
      if (queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, TAB_THROTTLE_MS));
      }
    }

    isProcessing = false;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        // If element is completely out of the viewport
        if (!entry.isIntersecting) {
          const el = entry.target;
          const bounding = entry.boundingClientRect;

          // If bounds are negative, it has left via the top of the viewport (user scrolled past it)
          if (bounding.top < 0 && !el.dataset.pttwebVisited) {
            el.dataset.pttwebVisited = 'true';
            queue.push(el.href);
            processQueue();
          }
        }
      }
    },
    { threshold: 0 } // Trigger as soon as visibility drops to 0%
  );

  function observeNewArticles() {
    // Select unobserved post links
    const posts = document.querySelectorAll('a.e7-article-default:not([data-pttweb-observed])');
    for (const post of posts) {
      post.dataset.pttwebObserved = '1';
      observer.observe(post);
    }
  }

  // Handle items injected by infinite scroll
  const mutationObserver = new MutationObserver(() => {
    observeNewArticles();
  });

  function start() {
    observeNewArticles();
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    start();
  } else {
    globalThis.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
