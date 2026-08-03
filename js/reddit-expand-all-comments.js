// ==UserScript==
// @name         Reddit Expand All Comments
// @namespace    http://tampermonkey.net/
// @version      2026-08-03
// @author       Jasonnor
// @description  Adds a bottom-right button that expands collapsed comments and loads more replies/comments on Reddit threads.
// @match        https://www.reddit.com/*/comments/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*  ***************************************************************
 *  Reddit Expand All Comments
 *  --------------------------------------------------------------
 *  1. Floats an "Expand All" button in the bottom-right.
 *  2. Uncollapses closed comment details.
 *  3. Clicks in-place "more replies" and "View more comments".
 *  ***************************************************************/

(function () {
  'use strict';

  const CONFIG = {
    TIMEOUTS: {
      ROUND_DELAY: 400,
      IDLE_ROUNDS: 4,
      MAX_CLICKS: 500,
    },
    UI: {
      BUTTON_ID: 'reddit-expand-all-comments-btn',
      LABEL: 'Expand All',
      MSG_STARTING: '[Reddit Expand All] Starting ...',
      MSG_FINISHED: (clicks, uncollapsed) =>
        `✅ Expanded comments (clicks: ${clicks}, uncollapsed: ${uncollapsed}).`,
      MSG_ABORTED: (msg) => `❌ Expand aborted: ${msg}`,
    },
    STYLES: {
      PRIMARY: '#FF4500',
      HOVER: '#D93A00',
      RUNNING: '#1C1B1F',
    },
    VIEW_MORE_TEXT: [/檢視更多留言/i, /view more comments/i],
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function isVisible(el) {
    if (!el || el.getAttribute('aria-hidden') === 'true') return false;
    if (el.disabled) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isCommentPage() {
    return /\/comments\//.test(location.pathname);
  }

  function uncollapseComments() {
    let count = 0;
    document.querySelectorAll('shreddit-comment details:not([open])').forEach((details) => {
      const summary = details.querySelector('summary');
      if (summary) {
        summary.click();
      } else {
        details.open = true;
      }
      if (details.open) count += 1;
    });
    return count;
  }

  function collectMoreReplyButtons() {
    const buttons = [];
    document
      .querySelectorAll(
        'faceplate-partial[src*="/svc/shreddit/more-comments/"] button[type="button"]',
      )
      .forEach((btn) => {
        if (btn.closest('[slot="loading"]')) return;
        if (btn.getAttribute('aria-label') === 'Loading') return;
        if (!isVisible(btn)) return;
        buttons.push(btn);
      });
    return buttons;
  }

  function matchesViewMoreText(text) {
    const normalized = (text || '').replace(/\s+/g, ' ').trim();
    return CONFIG.VIEW_MORE_TEXT.some((re) => re.test(normalized));
  }

  function collectViewMoreButtons() {
    const buttons = [];
    const seen = new Set();

    document.querySelectorAll('button, [role="button"]').forEach((el) => {
      if (!isVisible(el)) return;
      if (!matchesViewMoreText(el.textContent)) return;
      if (seen.has(el)) return;
      seen.add(el);
      buttons.push(el);
    });

    document.querySelectorAll('#top-level-more-comments-partial button[type="button"]').forEach((btn) => {
      if (btn.closest('[slot="loading"]')) return;
      if (!isVisible(btn)) return;
      if (seen.has(btn)) return;
      seen.add(btn);
      buttons.push(btn);
    });

    return buttons;
  }

  function nudgeTopLevelLoader() {
    const partial = document.querySelector(
      '#top-level-more-comments-partial, faceplate-partial.top-level[src*="/svc/shreddit/more-comments/"]',
    );
    if (!partial) return false;
    partial.scrollIntoView({ block: 'center', behavior: 'auto' });
    return true;
  }

  async function expandAll(btn, labelSpan) {
    console.log(CONFIG.UI.MSG_STARTING);
    const originalLabel = labelSpan.innerText;
    btn.dataset.running = 'true';
    btn.style.background = CONFIG.STYLES.RUNNING;
    btn.style.cursor = 'wait';
    btn.style.minWidth = '170px';
    labelSpan.innerText = 'Expanding...';
    labelSpan.style.opacity = '1';
    labelSpan.style.maxWidth = '200px';

    let clicks = 0;
    let uncollapsed = 0;
    let idleRounds = 0;

    try {
      while (clicks < CONFIG.TIMEOUTS.MAX_CLICKS) {
        const opened = uncollapseComments();
        uncollapsed += opened;

        const targets = [...collectMoreReplyButtons(), ...collectViewMoreButtons()];
        let clickedThisRound = 0;

        for (const target of targets) {
          if (!isVisible(target)) continue;
          target.click();
          clicks += 1;
          clickedThisRound += 1;
          labelSpan.innerText = `Expanding... (${clicks})`;
          if (clicks >= CONFIG.TIMEOUTS.MAX_CLICKS) break;
        }

        if (clickedThisRound === 0) nudgeTopLevelLoader();
        if (opened === 0 && clickedThisRound === 0) {
          idleRounds += 1;
        } else {
          idleRounds = 0;
        }

        if (idleRounds >= CONFIG.TIMEOUTS.IDLE_ROUNDS) break;
        await sleep(CONFIG.TIMEOUTS.ROUND_DELAY);
      }

      const finishMsg = CONFIG.UI.MSG_FINISHED(clicks, uncollapsed);
      console.log(finishMsg);
      labelSpan.innerText = `Done (${clicks})`;
      await sleep(1200);
    } catch (err) {
      const errorMsg = CONFIG.UI.MSG_ABORTED(err.message || String(err));
      console.error(errorMsg, err);
      alert(errorMsg);
    } finally {
      delete btn.dataset.running;
      btn.style.background = CONFIG.STYLES.PRIMARY;
      btn.style.cursor = 'pointer';
      btn.style.minWidth = '56px';
      labelSpan.innerText = originalLabel;
      btn.dispatchEvent(new Event('mouseleave'));
    }
  }

  function createFloatingButton() {
    if (document.getElementById(CONFIG.UI.BUTTON_ID)) return;
    if (!isCommentPage()) return;

    const btn = document.createElement('button');
    btn.id = CONFIG.UI.BUTTON_ID;
    btn.type = 'button';

    const createSvgIcon = () => {
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('height', '24px');
      svg.setAttribute('viewBox', '0 -960 960 960');
      svg.setAttribute('width', '24px');
      svg.setAttribute('fill', '#FFFFFF');

      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute(
        'd',
        'M480-120 300-300l58-58 122 122 122-122 58 58-180 180ZM358-602l-58-58 180-180 180 180-58 58-122-122-122 122Z',
      );
      svg.appendChild(path);
      return svg;
    };

    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: '999999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      overflow: 'hidden',
      height: '56px',
      minWidth: '56px',
      width: 'auto',
      borderRadius: '16px',
      padding: '0 16px',
      background: CONFIG.STYLES.PRIMARY,
      boxShadow: '0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3)',
      border: 'none',
      color: '#ffffff',
      fontFamily: 'IBM Plex Sans, Segoe UI, sans-serif',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.2, 0.0, 0, 1.0)',
      opacity: '0.6',
      whiteSpace: 'nowrap',
      letterSpacing: '0.1px',
    });

    const iconContainer = document.createElement('div');
    try {
      iconContainer.appendChild(createSvgIcon());
    } catch (e) {
      console.error('Failed to create SVG icon', e);
      iconContainer.textContent = '⇅';
    }
    Object.assign(iconContainer.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '24px',
      height: '24px',
      marginRight: '0px',
      transition: 'margin-right 0.2s ease',
    });

    const labelSpan = document.createElement('span');
    labelSpan.innerText = CONFIG.UI.LABEL;
    Object.assign(labelSpan.style, {
      maxWidth: '0',
      opacity: '0',
      transition: 'all 0.3s cubic-bezier(0.2, 0.0, 0, 1.0)',
      overflow: 'hidden',
      display: 'inline-block',
    });

    btn.appendChild(iconContainer);
    btn.appendChild(labelSpan);

    btn.addEventListener('mouseenter', () => {
      if (btn.dataset.running) return;
      btn.style.opacity = '1';
      btn.style.minWidth = '148px';
      btn.style.background = CONFIG.STYLES.HOVER;
      btn.style.boxShadow = '0 6px 10px 4px rgba(0, 0, 0, 0.15), 0 2px 3px rgba(0, 0, 0, 0.3)';
      iconContainer.style.marginRight = '12px';
      labelSpan.style.maxWidth = '100px';
      labelSpan.style.opacity = '1';
    });

    btn.addEventListener('mouseleave', () => {
      if (btn.dataset.running) return;
      btn.style.opacity = '0.6';
      btn.style.minWidth = '56px';
      btn.style.background = CONFIG.STYLES.PRIMARY;
      btn.style.boxShadow = '0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3)';
      iconContainer.style.marginRight = '0px';
      labelSpan.style.maxWidth = '0';
      labelSpan.style.opacity = '0';
    });

    btn.addEventListener('click', async () => {
      if (btn.dataset.running) return;
      await expandAll(btn, labelSpan);
    });

    document.body.appendChild(btn);
  }

  function removeFloatingButton() {
    document.getElementById(CONFIG.UI.BUTTON_ID)?.remove();
  }

  function syncButtonToRoute() {
    if (isCommentPage()) {
      createFloatingButton();
    } else {
      removeFloatingButton();
    }
  }

  function watchSpaNavigation() {
    let lastUrl = location.href;
    const check = () => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      syncButtonToRoute();
    };

    const wrapHistory = (method) => {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        check();
        return result;
      };
    };

    wrapHistory('pushState');
    wrapHistory('replaceState');
    window.addEventListener('popstate', check);
    setInterval(check, 1000);
  }

  function init() {
    syncButtonToRoute();
    watchSpaNavigation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
