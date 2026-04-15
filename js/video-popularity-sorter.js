// ==UserScript==
// @name         Video Popularity Sorter (YouTube & Bilibili)
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Sort YouTube/Bilibili channel videos by popularity rating: Score = Views / √(Days + 7). Balances viral new content and enduring classic content.
// @author       Jasonnor
// @match        *://www.youtube.com/@*
// @match        *://www.youtube.com/channel/*
// @match        *://www.youtube.com/c/*
// @match        *://space.bilibili.com/*/upload/video*
// @match        *://space.bilibili.com/*/video*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ── Platform Detection ─────────────────────────────────────────────────────
  const PLATFORM = (() => {
    const h = location.hostname;
    if (h.includes('youtube.com')) return 'youtube';
    if (h.includes('bilibili.com')) return 'bilibili';
    return null;
  })();

  if (!PLATFORM) return;

  // ── Score Formula: Score = V / sqrt(T + 7) ────────────────────────────────
  // V = total views, T = age in days
  // sqrt growth model: 4x-older content only needs 2x more views to keep the same score.
  // The +7 smoothing constant prevents inflation when T is still near zero.
  function calcScore(views, days) {
    return views / Math.sqrt(days + 7);
  }

  function fmtScore(score) {
    if (score >= 1e9) return (score / 1e9).toFixed(1) + 'B';
    if (score >= 1e6) return (score / 1e6).toFixed(1) + 'M';
    if (score >= 1e3) return (score / 1e3).toFixed(1) + 'K';
    return Math.round(score).toString();
  }

  // ── YouTube Parsing ────────────────────────────────────────────────────────
  function parseYTViews(text) {
    if (!text) return 0;
    // "95,627 views" | "95K views" | "1.3M views" | "No views"
    text = text.replace(/,/g, '').replace(/\s*views?/i, '').trim();
    const m = text.match(/([\d.]+)\s*([KMBkmb])?/);
    if (!m) return 0;
    let val = parseFloat(m[1]);
    const suf = (m[2] || '').toUpperCase();
    if (suf === 'K') val *= 1e3;
    else if (suf === 'M') val *= 1e6;
    else if (suf === 'B') val *= 1e9;
    return Math.round(val);
  }

  function parseYTDays(text) {
    if (!text) return 0;
    // "5 days ago" | "2 weeks ago" | "3 months ago" | "1 year ago"
    const m = text.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);
    if (!m) return 0;
    const n = parseInt(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === 'second' || unit === 'minute' || unit === 'hour') return 0;
    if (unit === 'day') return n;
    if (unit === 'week') return n * 7;
    if (unit === 'month') return n * 30;
    if (unit === 'year') return n * 365;
    return 0;
  }

  // ── Bilibili Parsing ───────────────────────────────────────────────────────
  function parseBiliViews(text) {
    if (!text) return 0;
    text = text.trim().replace(/播放/g, '');
    // "4.8万" | "1234" | "1.2亿"
    const wanM = text.match(/([\d.]+)\s*万/);
    if (wanM) return Math.round(parseFloat(wanM[1]) * 1e4);
    const yiM = text.match(/([\d.]+)\s*亿/);
    if (yiM) return Math.round(parseFloat(yiM[1]) * 1e8);
    return Math.round(parseFloat(text.replace(/,/g, '')) || 0);
  }

  function parseBiliDays(text) {
    if (!text) return 0;
    text = text.replace(/^\s*[·•·]\s*/, '').trim();

    // Relative time
    if (text === '昨天') return 1;
    let m = text.match(/(\d+)\s*天前/);
    if (m) return parseInt(m[1]);
    m = text.match(/(\d+)\s*周前/);
    if (m) return parseInt(m[1]) * 7;
    m = text.match(/(\d+)\s*月前/);
    if (m) return parseInt(m[1]) * 30;
    if (/(\d+)\s*(小时|分钟|秒)前/.test(text)) return 0;

    // Absolute dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    m = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
      return Math.max(0, Math.floor((today - d) / 86400000));
    }
    // "MM-DD" (assume current year; roll back if future date)
    m = text.match(/^(\d{1,2})-(\d{2})$/);
    if (m) {
      let year = today.getFullYear();
      const d = new Date(year, parseInt(m[1]) - 1, parseInt(m[2]));
      if (d > today) d.setFullYear(year - 1);
      return Math.max(0, Math.floor((today - d) / 86400000));
    }
    return 0;
  }

  // ── Platform Adapters ──────────────────────────────────────────────────────
  const adapters = {
    youtube: {
      accentColor: '#FF0000',
      accentColorDark: '#CC0000',

      isActivePage() {
        return /\/videos(\?|$|#|\/)/i.test(location.pathname + location.search);
      },

      getContainer() {
        return (
          document.querySelector('ytd-rich-grid-renderer #contents') ||
          document.querySelector('#contents[class*="ytd-rich-grid-renderer"]')
        );
      },

      getItems() {
        // Filter out section header rows which are also ytd-rich-item-renderer
        return Array.from(document.querySelectorAll('ytd-rich-item-renderer')).filter(
          el => el.querySelector('#video-title, #video-title-link, a#thumbnail')
        );
      },

      getItemData(item) {
        // First span = views ("95K views"), second span = time ("5 days ago")
        const spans = item.querySelectorAll(
          '#metadata-line span.inline-metadata-item, #metadata-line span[class*="metadata-item"]'
        );
        console.log('[VPS] getItemData: spans found=', spans.length,
          spans[0]?.textContent?.trim(), '|', spans[1]?.textContent?.trim());
        if (spans.length < 2) return null;
        const views = parseYTViews(spans[0].textContent);
        const days = parseYTDays(spans[1].textContent);
        return {views, days};
      },

      // Append the badge directly to the item (ytd-rich-item-renderer) to avoid Shadow DOM issues.
      // The badge (position:absolute top:5px left:5px) will appear over the thumbnail area.
      getBadgeContainer(item) {
        return null; // triggers item-level append in renderBadge
      },
    },

    bilibili: {
      accentColor: '#FB7299',
      accentColorDark: '#E85D87',

      isActivePage() {
        return true; // match patterns already restrict to the video list page
      },

      getContainer() {
        // Actual container class confirmed from DOM: .video-list (may also have .grid-mode)
        return (
          document.querySelector('.video-list') ||
          document.querySelector('[class*="video-list"]')
        );
      },

      getItems() {
        // Outer sortable wrapper is .upload-video-card
        const items = Array.from(document.querySelectorAll('.upload-video-card'));
        if (items.length > 0) return items;
        // Fallback for other Bilibili layouts
        return Array.from(document.querySelectorAll('.list-video-item'));
      },

      getItemData(item) {
        // View count: the FIRST .bili-cover-card__stat contains the play-count icon + span
        // Structure: .bili-cover-card__stats > .bili-cover-card__stat > <i icon> + <span>count</span>
        const playStatSpan = item.querySelector(
          '.sic-BDC-playdata_square_line + span, .bili-cover-card__stat:first-child span'
        );
        const views = parseBiliViews(playStatSpan ? playStatSpan.textContent : '');

        // Date: .bili-video-card__subtitle > span contains "2小时前", "昨天", "04-13", etc.
        const dateSpan = item.querySelector('.bili-video-card__subtitle span');
        const days = parseBiliDays(dateSpan ? dateSpan.textContent : '');

        return {views, days};
      },

      // Append badge inside the cover anchor (already positioned relative to its thumbnail)
      getBadgeContainer(item) {
        return (
          item.querySelector('a.bili-cover-card') ||
          item.querySelector('a[href*="/video/"]')
        );
      },
    },
  };

  const adapter = adapters[PLATFORM];

  // ── State ──────────────────────────────────────────────────────────────────
  let originalOrder = [];
  let isSorted = false;
  let scoresVisible = false;
  let autoLoadActive = false;
  let autoLoadTimer = null;
  let statusClearTimer = null;

  // ── Score Badge ────────────────────────────────────────────────────────────
  function renderBadge(item, score) {
    let badge = item.querySelector('.vps-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'vps-badge';
      const container = adapter.getBadgeContainer(item);
      if (container) {
        const pos = getComputedStyle(container).position;
        if (pos === 'static') container.style.position = 'relative';
        container.appendChild(badge);
      } else {
        // Append directly to the item element.
        // For YouTube's ytd-rich-item-renderer the badge sits at top-left,
        // overlapping the thumbnail area. Force a stacking context so it shows.
        item.style.setProperty('position', 'relative', 'important');
        item.style.setProperty('z-index', '0', 'important');
        item.appendChild(badge);
      }
    }
    badge.textContent = '\u2605 ' + fmtScore(score);
    badge.title = 'Score = Views / sqrt(Days+7) ~= ' + fmtScore(score);
    badge.style.display = scoresVisible ? '' : 'none';
    badge.dataset.score = score;
  }

  function syncBadgesVisibility() {
    document.querySelectorAll('.vps-badge').forEach(b => {
      b.style.display = scoresVisible ? '' : 'none';
    });
  }

  // Color each badge by percentile rank: red (hot/top) → yellow → blue (cold/bottom)
  function applyPercentileColors() {
    const items = adapter.getItems().filter(el => el.dataset.vpsScore !== undefined);
    if (items.length < 2) return;

    const scores = items.map(el => parseFloat(el.dataset.vpsScore));
    const sorted = [...scores].sort((a, b) => a - b);
    const n = sorted.length;

    items.forEach((el, i) => {
      const badge = el.querySelector('.vps-badge');
      if (!badge) return;
      // Count how many scores are strictly below this one → rank from 0 to n-1
      const rank = sorted.filter(s => s < scores[i]).length;
      const pct = n > 1 ? rank / (n - 1) : 0.5; // 0 = coldest, 1 = hottest
      // HSL hue: 0° red (hot) … 60° yellow … 120° green … 240° blue (cold)
      const hue = Math.round((1 - pct) * 240);
      const lightness = pct > 0.75 ? 38 : pct > 0.25 ? 42 : 46;
      badge.style.background = `hsl(${hue}, 82%, ${lightness}%)`;
      badge.style.color = 'white';
    });
  }

  // ── Sort & Reset ───────────────────────────────────────────────────────────
  function sortByPopularity() {
    const container = adapter.getContainer();
    const items = adapter.getItems();

    if (!container || items.length === 0) {
      showStatus('No videos found — wait for the page to fully load.', 'warn');
      return;
    }

    if (!isSorted) {
      originalOrder = items.slice();
    }

    const scored = items.map(item => {
      let score = parseFloat(item.dataset.vpsScore);
      if (!Number.isFinite(score) || score < 0) {
        const data = adapter.getItemData(item);
        score = data ? calcScore(data.views, data.days) : 0;
        item.dataset.vpsScore = score;
        if (data) {
          item.dataset.vpsViews = data.views;
          item.dataset.vpsDays = data.days;
        }
      }
      renderBadge(item, score);
      return {item, score};
    });

    scored.sort((a, b) => b.score - a.score);
    scored.forEach(({item}) => container.appendChild(item));

    isSorted = true;
    updateSortBtn();
    if (scoresVisible) applyPercentileColors();
    showStatus(`Sorted ${items.length} videos by popularity rating.`, 'ok');
  }

  function resetOrder() {
    if (!isSorted || originalOrder.length === 0) {
      showStatus('Already in original order.', 'warn');
      return;
    }
    const container = adapter.getContainer();
    if (container) originalOrder.forEach(el => container.appendChild(el));
    isSorted = false;
    updateSortBtn();
    showStatus('Original order restored.', 'ok');
  }

  // ── Auto Load More (YouTube only) ──────────────────────────────────────────
  function toggleAutoLoad() {
    autoLoadActive = !autoLoadActive;
    const btn = document.getElementById('vps-btn-load');
    if (!btn) return;

    if (autoLoadActive) {
      btn.classList.add('vps-btn-active');
      btn.textContent = '⏹ Stop Loading';
      scrollLoadMore();
    } else {
      btn.classList.remove('vps-btn-active');
      btn.textContent = '⬇ Load More Videos';
      clearTimeout(autoLoadTimer);
    }
  }

  function scrollLoadMore() {
    if (!autoLoadActive) return;
    const before = adapter.getItems().length;
    window.scrollTo({top: document.documentElement.scrollHeight, behavior: 'smooth'});

    autoLoadTimer = setTimeout(() => {
      const after = adapter.getItems().length;
      if (after > before) {
        showStatus(`Loading… ${after} videos so far.`, 'ok');
        scrollLoadMore();
      } else {
        autoLoadActive = false;
        const btn = document.getElementById('vps-btn-load');
        if (btn) {
          btn.classList.remove('vps-btn-active');
          btn.textContent = '⬇ Load More Videos';
        }
        showStatus(`All ${after} videos loaded.`, 'ok');
      }
    }, 2000);
  }

  // ── UI Helpers ─────────────────────────────────────────────────────────────
  function showStatus(msg, type = 'ok') {
    const el = document.getElementById('vps-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = type === 'warn' ? '#b45309' : '#374151';
    el.style.opacity = '1';
    clearTimeout(statusClearTimer);
    statusClearTimer = setTimeout(() => {
      el.style.opacity = '0';
    }, 4000);
  }

  function updateSortBtn() {
    const btn = document.getElementById('vps-btn-sort');
    if (!btn) return;
    if (isSorted) {
      btn.classList.add('vps-btn-active');
      btn.textContent = '✔ Sorted by Popularity';
    } else {
      btn.classList.remove('vps-btn-active');
      btn.textContent = '⬇ Sort by Popularity';
    }
  }

  // Show/hide the button when the user navigates between YouTube tabs
  function updateContainerVisibility() {
    const el = document.getElementById('vps-container');
    if (!el) return;
    el.style.setProperty('display', adapter.isActivePage() ? 'block' : 'none', 'important');
  }

  // ── Create UI (once per session) ───────────────────────────────────────────
  let _watchdogTimer = null;

  function ensureUI() {
    if (!document.getElementById('vps-container')) {
      try {
        createUI();
      } catch (e) {
        console.error('[VPS] createUI error:', e);
      }
    }
    updateContainerVisibility();
    startWatchdog();
  }

  // Persistent watchdog — re-injects the container if YouTube removes it
  function startWatchdog() {
    if (_watchdogTimer) return;
    _watchdogTimer = setInterval(() => {
      if (!document.getElementById('vps-container')) {
        console.log('[VPS] watchdog: container missing, re-injecting');
        try {
          createUI();
        } catch (e) {
          console.error('[VPS] watchdog createUI error:', e);
        }
        updateContainerVisibility();
      }
    }, 1500);
  }

  function buildCSS(acc, accDark) {
    return `
      #vps-container {
        position: fixed !important;
        top: 80px !important;
        right: 20px !important;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif !important;
        pointer-events: auto !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      #vps-toggle {
        width: 48px !important;
        height: 48px !important;
        background: ${acc} !important;
        color: white !important;
        border-radius: 50% !important;
        box-shadow: 0 4px 14px rgba(0,0,0,0.25) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 22px !important;
        cursor: pointer !important;
        transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
        user-select: none !important;
        margin-left: auto !important;
        border: none !important;
        outline: none !important;
      }
      #vps-toggle:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 18px rgba(0,0,0,0.3);
        background: ${accDark};
      }
      #vps-panel {
        margin-top: 10px;
        background: rgba(255,255,255,0.97);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid rgba(0,0,0,0.09);
        border-radius: 16px;
        padding: 18px;
        box-shadow: 0 10px 36px rgba(0,0,0,0.15);
        width: 270px;
        display: none;
        flex-direction: column;
        gap: 10px;
      }
      #vps-panel.show {
        display: flex;
        animation: vpsFadeIn 0.25s ease;
      }
      @keyframes vpsFadeIn {
        from { opacity: 0; transform: translateY(-8px); }
        to   { opacity: 1; transform: translateY(0);    }
      }
      #vps-header {
        font-size: 13px;
        font-weight: 700;
        color: #111;
        padding-bottom: 8px;
        border-bottom: 2px solid ${acc};
      }
      #vps-formula {
        font-size: 11px;
        color: #555;
        background: #f6f6f6;
        border-radius: 7px;
        padding: 7px 10px;
        font-family: 'Courier New', monospace;
        line-height: 1.6;
      }
      #vps-formula strong { color: #222; }
      .vps-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        padding: 9px 12px;
        border: 1.5px solid #ddd;
        border-radius: 9px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        background: #fff;
        color: #333;
        transition: all 0.18s;
        box-sizing: border-box;
        font-family: inherit;
        text-align: left;
      }
      .vps-btn:hover { background: #f5f5f5; border-color: #bbb; }
      .vps-btn-primary { background: ${acc}; color: #fff; border-color: ${acc}; }
      .vps-btn-primary:hover { background: ${accDark}; border-color: ${accDark}; }
      .vps-btn-active { background: #eff6ff; border-color: #3b82f6; color: #1d4ed8; }
      #vps-status {
        font-size: 11.5px;
        min-height: 15px;
        text-align: center;
        transition: opacity 0.5s;
        opacity: 0;
      }
      .vps-badge {
        position: absolute;
        top: 5px;
        left: 5px;
        background: rgba(0,0,0,0.65); /* overridden by applyPercentileColors() */
        color: white;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 5px;
        pointer-events: none;
        z-index: 10;
        line-height: 18px;
        letter-spacing: 0.2px;
        white-space: nowrap;
        text-shadow: 0 1px 2px rgba(0,0,0,0.35);
      }
    `;
  }

  function createUI() {
    if (document.getElementById('vps-container')) return;

    const acc = adapter.accentColor;
    const accDark = adapter.accentColorDark;

    // Inject or refresh stylesheet
    if (!document.querySelector('style[data-vps]')) {
      const style = document.createElement('style');
      style.textContent = buildCSS(acc, accDark);
      style.setAttribute('data-vps', '1');
      (document.head || document.documentElement).appendChild(style);
      console.log('[VPS] style injected');
    }

    const container = document.createElement('div');
    container.id = 'vps-container';
    console.log('[VPS] container element created, id =', container.id);

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'vps-toggle';
    toggleBtn.title = 'Video Popularity Sorter';
    toggleBtn.textContent = '\u{1F4CA}'; // 📊
    container.appendChild(toggleBtn);

    const panel = document.createElement('div');
    panel.id = 'vps-panel';

    const header = document.createElement('div');
    header.id = 'vps-header';
    header.textContent = '\u{1F4CA} Popularity Sorter'; // 📊
    panel.appendChild(header);

    const formula = document.createElement('div');
    formula.id = 'vps-formula';
    const strong = document.createElement('strong');
    strong.textContent = 'Score = Views / sqrt(Days + 7)';
    formula.appendChild(strong);
    formula.appendChild(document.createTextNode('\n4x older content needs only 2x more\nviews to maintain the same score.'));
    panel.appendChild(formula);

    const sortBtn = document.createElement('button');
    sortBtn.id = 'vps-btn-sort';
    sortBtn.className = 'vps-btn vps-btn-primary';
    sortBtn.textContent = '\u2B07 Sort by Popularity'; // ⬇
    sortBtn.addEventListener('click', sortByPopularity);
    panel.appendChild(sortBtn);

    const resetBtn = document.createElement('button');
    resetBtn.id = 'vps-btn-reset';
    resetBtn.className = 'vps-btn';
    resetBtn.textContent = '\u21BA Reset Original Order'; // ↺
    resetBtn.addEventListener('click', resetOrder);
    panel.appendChild(resetBtn);

    const scoresBtn = document.createElement('button');
    scoresBtn.id = 'vps-btn-scores';
    scoresBtn.className = 'vps-btn';
    scoresBtn.textContent = '\uD83C\uDFF7 Show Scores on Cards'; // 🏷
    scoresBtn.addEventListener('click', () => {
      scoresVisible = !scoresVisible;
      if (scoresVisible) {
        scoresBtn.classList.add('vps-btn-active');
        scoresBtn.textContent = '\uD83C\uDFF7 Hide Scores'; // 🏷
        adapter.getItems().forEach(item => {
          if (!item.dataset.vpsScore) {
            const data = adapter.getItemData(item);
            const score = data ? calcScore(data.views, data.days) : 0;
            item.dataset.vpsScore = score;
            renderBadge(item, score);
          }
        });
      } else {
        scoresBtn.classList.remove('vps-btn-active');
        scoresBtn.textContent = '\uD83C\uDFF7 Show Scores on Cards'; // 🏷
      }
      syncBadgesVisibility();
      if (scoresVisible) applyPercentileColors();
    });
    panel.appendChild(scoresBtn);

    if (PLATFORM === 'youtube') {
      const loadBtn = document.createElement('button');
      loadBtn.id = 'vps-btn-load';
      loadBtn.className = 'vps-btn';
      loadBtn.textContent = '\u2B07 Load More Videos'; // ⬇
      loadBtn.title = 'Auto-scroll to load all videos before sorting';
      loadBtn.addEventListener('click', toggleAutoLoad);
      panel.appendChild(loadBtn);
    }

    const statusEl = document.createElement('div');
    statusEl.id = 'vps-status';
    panel.appendChild(statusEl);

    container.appendChild(panel);

    // Try appending to body first; fall back to documentElement
    const target = document.body || document.documentElement;
    target.appendChild(container);
    console.log('[VPS] container appended to', target.tagName,
      '| getElementById check:', !!document.getElementById('vps-container'));

    toggleBtn.addEventListener('click', () => panel.classList.toggle('show'));
  }

  // ── State Reset (called on page/tab navigation) ────────────────────────────
  function resetState() {
    originalOrder = [];
    isSorted = false;
    scoresVisible = false;
    autoLoadActive = false;
    clearTimeout(autoLoadTimer);

    document.querySelectorAll('.vps-badge').forEach(b => b.remove());
    // Also, clear cached score attributes so they're re-computed on next sort
    document.querySelectorAll('[data-vps-score]').forEach(el => {
      delete el.dataset.vpsScore;
      delete el.dataset.vpsViews;
      delete el.dataset.vpsDays;
    });

    const sortBtn = document.getElementById('vps-btn-sort');
    if (sortBtn) {
      sortBtn.classList.remove('vps-btn-active');
      sortBtn.textContent = '⬇ Sort by Popularity';
    }
    const scoresBtn = document.getElementById('vps-btn-scores');
    if (scoresBtn) {
      scoresBtn.classList.remove('vps-btn-active');
      scoresBtn.textContent = '🏷 Show Scores on Cards';
    }
    const loadBtn = document.getElementById('vps-btn-load');
    if (loadBtn) {
      loadBtn.classList.remove('vps-btn-active');
      loadBtn.textContent = '⬇ Load More Videos';
    }
    const statusEl = document.getElementById('vps-status');
    if (statusEl) statusEl.style.opacity = '0';

    // Close panel on navigation
    const panel = document.getElementById('vps-panel');
    if (panel) panel.classList.remove('show');
  }

  // ── SPA Navigation Handling ────────────────────────────────────────────────
  // YouTube fires yt-navigate-finish after every SPA tab/page change
  window.addEventListener('yt-navigate-finish', () => {
    console.log('[VPS] yt-navigate-finish', location.href);
    resetState();
    ensureUI();
  });

  // Bilibili / generic fallback via pushState interception
  let lastURL = location.href;
  const _push = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);
  history.pushState = function (...args) {
    _push(...args);
    onURLChange();
  };
  history.replaceState = function (...args) {
    _replace(...args);
    onURLChange();
  };
  window.addEventListener('popstate', onURLChange);

  function onURLChange() {
    if (location.href !== lastURL) {
      lastURL = location.href;
      resetState();
      ensureUI();
    }
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  function boot() {
    console.log('[VPS] boot() platform=', PLATFORM, 'readyState=', document.readyState, 'url=', location.href);
    ensureUI();
    // Additional retries to survive YouTube's Polymer hydration re-render
    if (PLATFORM === 'youtube') {
      setTimeout(ensureUI, 800);
      setTimeout(ensureUI, 2000);
      setTimeout(ensureUI, 5000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
