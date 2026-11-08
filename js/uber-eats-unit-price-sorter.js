// ==UserScript==
// @name         Uber Eats Unit Price Sorter
// @namespace    http://tampermonkey.net/
// @version      2026.11.8.1
// @description  On Uber Eats store pages, a floating button labels each product with its price per 100 g, per 100 ml or per piece, and sorts the page cheapest first. A second click restores the original order.
// @author       Jasonnor
// @match        https://www.ubereats.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ubereats.com
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function (global) {
  'use strict';

  const ITEM_SELECTOR = '[data-testid^="store-item-"]';
  const LABEL_SELECTOR = '[data-testid="item-thumbnail-label"]';
  const STORE_PATH = /^\/[a-z]{2}(-[a-z]{2})?\/store\//i;
  const BEST_PERCENTILE = 0.1;
  const GOOD_PERCENTILE = 0.33;

  const MASS_VOLUME = {
    kg: ['g', 1000], 公斤: ['g', 1000], g: ['g', 1], 克: ['g', 1], 公克: ['g', 1],
    l: ['ml', 1000], 公升: ['ml', 1000], 升: ['ml', 1000], ml: ['ml', 1], 毫升: ['ml', 1], cc: ['ml', 1],
  };
  const UNIT = '(kg|公斤|公克|ml|毫升|cc|g|克|公升|升|l)(?![a-wyz])';
  const COUNT = '(?:入|瓶|包|罐|支|袋|盒|粒|片|條|顆|個|杯|pcs?)';
  const NUM = '(\\d+(?:\\.\\d+)?)';
  const PACK_AFTER = new RegExp(`${NUM}\\s*${UNIT}\\s*[x*×]\\s*(\\d+)`, 'i');
  const PACK_BEFORE = new RegExp(`(\\d+)\\s*${COUNT}\\s*[x*×]\\s*${NUM}\\s*${UNIT}`, 'i');
  const SINGLE = new RegExp(`${NUM}\\s*${UNIT}`, 'i');
  const COUNT_ONLY = new RegExp(`(\\d+)\\s*${COUNT}`, 'i');

  // Uber Eats' own size label is the size of one unit in a pack ("0.2 L" for 200ml*6入),
  // so the product name is parsed first and the label is only a fallback.
  function parseSize(text) {
    const s = String(text || '').replace(/[＊]/g, '*').replace(/[ｘＸ]/g, 'x');
    let m = s.match(PACK_AFTER);
    if (m) return massVolume(parseFloat(m[1]) * parseInt(m[3], 10), m[2]);
    m = s.match(PACK_BEFORE);
    if (m) return massVolume(parseInt(m[1], 10) * parseFloat(m[2]), m[3]);
    m = s.match(SINGLE);
    if (m) return massVolume(parseFloat(m[1]), m[2]);
    return null;
  }

  function parseCount(text) {
    const m = String(text || '').match(COUNT_ONLY);
    const n = m ? parseInt(m[1], 10) : 0;
    return n > 0 ? { amount: n, unit: 'pc' } : null;
  }

  function massVolume(amount, rawUnit) {
    const [unit, factor] = MASS_VOLUME[rawUnit.toLowerCase()];
    return amount > 0 ? { amount: amount * factor, unit } : null;
  }

  function parsePrice(text) {
    const m = String(text || '').match(/\$\s*([\d,]+(?:\.\d+)?)/);
    return m ? parseFloat(m[1].replace(/,/g, '')) : null;
  }

  // Returns the price per 100 g, per 100 ml, or per piece.
  function unitPrice(price, name, sizeLabel) {
    const size = parseSize(name) || parseSize(sizeLabel) || parseCount(name);
    if (!price || !size) return null;
    const per = size.unit === 'pc' ? 1 : 100;
    return { value: (price / size.amount) * per, unit: size.unit, per, price, size };
  }

  // g and ml share one ordering; per-piece prices follow them, items without a size go last.
  function compareUnitPrice(a, b) {
    const rank = (u) => (!u ? 2 : u.unit === 'pc' ? 1 : 0);
    return rank(a) - rank(b) || (a && b ? a.value - b.value : 0);
  }

  function formatMoney(v) {
    const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
    return `NT$${v.toFixed(digits)}`;
  }

  function unitText(u) {
    return u.unit === 'pc' ? '/ pc' : `/ 100${u.unit}`;
  }

  function sizeText(size) {
    const v = Number.isInteger(size.amount) ? size.amount : size.amount.toFixed(1);
    return `${v} ${size.unit}`;
  }

  // ---------- Page ----------

  const state = {
    sorted: false,
    originalIndex: new WeakMap(),
    nextIndex: 0,
    observer: null,
    debounce: null,
    toastTimer: null,
  };

  function readItem(card) {
    const labels = Array.from(card.querySelectorAll(LABEL_SELECTOR)).map((el) => el.textContent.trim());
    const priceText = labels.find((t) => /^\$/.test(t)) || '';
    const sizeLabel = labels.find((t) => /^\d+(\.\d+)?\s*(kg|g|ml|l)$/i.test(t)) || '';
    const alt = card.querySelector('img[alt]')?.getAttribute('alt') || '';
    const name = alt || labels.filter((t) => t !== priceText && t !== sizeLabel).sort((a, b) => b.length - a.length)[0] || '';
    return unitPrice(parsePrice(priceText), name, sizeLabel);
  }

  function cardRows() {
    return Array.from(document.querySelectorAll(ITEM_SELECTOR))
      .map((card) => ({ card, row: card.closest('li') || card }))
      .filter(({ row }) => row.parentElement);
  }

  function tierOf(info, sortedByUnit) {
    const list = sortedByUnit[info.unit];
    const pos = list.indexOf(info.value);
    if (pos === 0) return 'best top';
    const pct = list.length > 1 ? pos / (list.length - 1) : 0;
    if (pct <= BEST_PERCENTILE) return 'best';
    if (pct <= GOOD_PERCENTILE) return 'good';
    return 'normal';
  }

  function renderBadge(card, info, tier) {
    card.querySelector('.ue-up-badge')?.remove();
    const badge = document.createElement('div');
    badge.className = `ue-up-badge ${info ? `ue-up-${tier.replace(' ', ' ue-up-')}` : 'ue-up-none'}`;
    if (info) {
      badge.innerHTML = `${tier.includes('top') ? '<span class="ue-up-crown">🏆</span>' : ''}<b>${formatMoney(info.value)}</b><span>${unitText(info)}</span>`;
      badge.title = `NT$${info.price} ÷ ${sizeText(info.size)}`;
    } else {
      badge.textContent = 'No size info';
      badge.title = 'No weight, volume or pack count found in the name';
    }
    const priceLabel = card.querySelector(LABEL_SELECTOR);
    (priceLabel ? priceLabel.parentElement : card).appendChild(badge);
  }

  function apply() {
    const rows = cardRows();
    rows.forEach(({ row }) => {
      if (!state.originalIndex.has(row)) state.originalIndex.set(row, state.nextIndex++);
    });
    const entries = rows.map((r) => ({ ...r, info: readItem(r.card) }));

    const sortedByUnit = {};
    entries.forEach(({ info }) => {
      if (info) (sortedByUnit[info.unit] = sortedByUnit[info.unit] || []).push(info.value);
    });
    Object.values(sortedByUnit).forEach((list) => list.sort((a, b) => a - b));
    entries.forEach(({ card, info }) => renderBadge(card, info, info ? tierOf(info, sortedByUnit) : ''));

    // Rows move only within their own parent, so React keeps finding them where it expects.
    const groups = new Map();
    entries.forEach((e) => {
      if (!groups.has(e.row.parentElement)) groups.set(e.row.parentElement, []);
      groups.get(e.row.parentElement).push(e);
    });
    groups.forEach((list, parent) => {
      list.sort((a, b) => compareUnitPrice(a.info, b.info) || state.originalIndex.get(a.row) - state.originalIndex.get(b.row));
      list.forEach(({ row }) => parent.appendChild(row));
    });
    return entries;
  }

  function restore() {
    const groups = new Map();
    cardRows().forEach(({ card, row }) => {
      card.querySelector('.ue-up-badge')?.remove();
      if (!groups.has(row.parentElement)) groups.set(row.parentElement, []);
      groups.get(row.parentElement).push(row);
    });
    groups.forEach((rows, parent) => {
      rows.sort((a, b) => (state.originalIndex.get(a) ?? Infinity) - (state.originalIndex.get(b) ?? Infinity));
      rows.forEach((row) => parent.appendChild(row));
    });
  }

  function withoutObserver(fn) {
    state.observer?.disconnect();
    try {
      return fn();
    } finally {
      state.observer?.observe(document.body, { childList: true, subtree: true });
    }
  }

  function toggle() {
    if (state.sorted) {
      withoutObserver(restore);
      state.sorted = false;
      updateButton();
      showToast('Original order restored');
      return;
    }
    const entries = withoutObserver(apply);
    if (entries.length === 0) {
      showToast('No products on this page yet. Scroll or search first.');
      return;
    }
    state.sorted = true;
    updateButton();
    const priced = entries.filter((e) => e.info);
    const cheapest = priced[0] && priced.reduce((a, b) => (compareUnitPrice(a.info, b.info) <= 0 ? a : b));
    showToast(
      `Sorted <b>${entries.length}</b> products` +
        (priced.length < entries.length ? ` · ${entries.length - priced.length} without size` : '') +
        (cheapest ? `<br><span class="ue-up-toast-sub">Cheapest: ${formatMoney(cheapest.info.value)} ${unitText(cheapest.info)}</span>` : ''),
    );
    cheapest?.row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Search results and infinite scroll add items after sorting; re-sort them in.
  function onMutation() {
    if (!state.sorted) return;
    clearTimeout(state.debounce);
    state.debounce = setTimeout(() => {
      if (!state.sorted) return;
      const unlabeled = cardRows().some(({ card }) => !card.querySelector('.ue-up-badge'));
      if (unlabeled) withoutObserver(apply);
    }, 400);
  }

  // ---------- UI ----------

  const CSS = `
    #ue-up-root {
      position: fixed; right: 24px; bottom: 24px; z-index: 2147483000;
      display: flex; flex-direction: column; align-items: flex-end; gap: 10px;
      font-family: UberMove, UberMoveText, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans TC', sans-serif;
    }
    #ue-up-root[hidden] { display: none; }
    #ue-up-fab {
      display: inline-flex; align-items: center; gap: 8px;
      height: 48px; padding: 0 20px 0 16px; border: none; border-radius: 999px;
      background: #000; color: #fff; font: inherit; font-size: 15px; font-weight: 600;
      box-shadow: 0 6px 20px rgba(0,0,0,.28); cursor: pointer;
      transition: transform .15s ease, box-shadow .15s ease, background .2s ease;
    }
    #ue-up-fab:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(0,0,0,.32); }
    #ue-up-fab:active { transform: translateY(0) scale(.97); }
    #ue-up-fab:focus-visible { outline: 3px solid #06c167; outline-offset: 3px; }
    #ue-up-fab.ue-up-active { background: #06c167; color: #fff; }
    #ue-up-fab .ue-up-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,.16); font-size: 14px;
    }
    #ue-up-toast {
      max-width: 280px; padding: 10px 14px; border-radius: 12px;
      background: rgba(20,20,20,.92); color: #fff; font-size: 13px; line-height: 1.45;
      box-shadow: 0 6px 20px rgba(0,0,0,.25);
      opacity: 0; transform: translateY(6px); pointer-events: none;
      transition: opacity .2s ease, transform .2s ease;
    }
    #ue-up-toast.ue-up-show { opacity: 1; transform: translateY(0); }
    #ue-up-toast b { color: #5ce59c; }
    .ue-up-toast-sub { color: #cfcfcf; }
    .ue-up-badge {
      display: inline-flex; align-items: baseline; gap: 3px; width: fit-content;
      margin: 4px 0 2px; padding: 2px 8px; border-radius: 6px;
      font-family: UberMoveText, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px; line-height: 18px; white-space: nowrap;
      background: #f3f3f3; color: #4b4b4b; cursor: help;
    }
    .ue-up-badge b { font-size: 13px; font-weight: 700; }
    .ue-up-badge span { opacity: .8; }
    .ue-up-badge b, .ue-up-badge span { color: inherit; }
    .ue-up-badge.ue-up-good { background: #e6f9ee; color: #05944f; }
    .ue-up-badge.ue-up-best { background: #06c167; color: #fff; }
    .ue-up-badge.ue-up-best span { opacity: .9; }
    .ue-up-badge.ue-up-top { box-shadow: 0 0 0 2px #ffc043 inset; }
    .ue-up-crown { margin-right: 2px; }
    .ue-up-badge.ue-up-none { background: transparent; color: #8a8a8a; padding-left: 0; font-style: italic; }
    @media (max-width: 600px) {
      #ue-up-root { right: 16px; bottom: 88px; }
      #ue-up-fab { height: 44px; font-size: 14px; }
    }
  `;

  let root;
  let fab;
  let toast;

  function buildUI() {
    document.head.appendChild(document.createElement('style')).textContent = CSS;
    root = document.createElement('div');
    root.id = 'ue-up-root';
    root.innerHTML = `
      <div id="ue-up-toast" role="status" aria-live="polite"></div>
      <button id="ue-up-fab" type="button"></button>
    `;
    document.body.appendChild(root);
    fab = root.querySelector('#ue-up-fab');
    toast = root.querySelector('#ue-up-toast');
    fab.addEventListener('click', toggle);
    updateButton();
  }

  function updateButton() {
    fab.classList.toggle('ue-up-active', state.sorted);
    fab.innerHTML = state.sorted
      ? '<span class="ue-up-icon">↺</span>Original order'
      : '<span class="ue-up-icon">⇅</span>Sort by unit price';
    fab.title = state.sorted ? 'Remove unit price labels and restore the original order' : 'Label each product with its unit price and sort cheapest first';
  }

  function showToast(html) {
    toast.innerHTML = html;
    toast.classList.add('ue-up-show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove('ue-up-show'), 3500);
  }

  // Uber Eats is a single-page app, so the button follows the path instead of the @match.
  let lastPath = '';
  function syncToRoute() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    state.sorted = false;
    state.originalIndex = new WeakMap();
    state.nextIndex = 0;
    root.hidden = !STORE_PATH.test(location.pathname);
    updateButton();
  }

  function init() {
    buildUI();
    syncToRoute();
    state.observer = new MutationObserver(() => {
      syncToRoute();
      onMutation();
    });
    state.observer.observe(document.body, { childList: true, subtree: true });
  }

  const api = { parseSize, parseCount, parsePrice, unitPrice, compareUnitPrice };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.__ueUnitPriceSorter = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
