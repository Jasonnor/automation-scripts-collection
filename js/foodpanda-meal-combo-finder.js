// ==UserScript==
// @name         Foodpanda Meal Combo Finder
// @namespace    http://tampermonkey.net/
// @version      2026-09-22
// @author       Jasonnor
// @description  Find menu combinations that meet a coupon minimum (default $260), accounting for the current cart subtotal.
// @match        *://www.foodpanda.com.tw/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=foodpanda.com.tw
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function (global) {
  'use strict';

  const CONFIG = {
    DEFAULT_TARGET: 260,
    DEFAULT_MAX_QTY: 1,
    RESULT_COUNT: 10,
    MAX_DISTINCT: 4,
    VOUCHER_CODE: '爽爽送',
    SELECTORS: {
      PRODUCT: '[data-testid="menu-product"]',
      NAME: '[data-testid="menu-product-name"]',
      PRICE: '[data-testid="menu-product-price"]',
      PRICE_BEFORE: '[data-testid="menu-product-price-before-discount"]',
      IMAGE: '[data-testid="menu-product-image"]',
      STEPPER: '[data-testid="menu-quantity-stepper"]',
      SUBTOTAL: '[data-testid="cartlib-subtotal"]',
    },
    UI: {
      ROOT_ID: 'fp-combo-root',
      FAB_ID: 'fp-combo-fab',
      PANEL_ID: 'fp-combo-panel',
      OVERLAY_ID: 'fp-combo-overlay',
      STYLES_ID: 'fp-combo-styles',
      LABEL: 'Combo Finder',
    },
    STYLES: {
      PRIMARY: '#D70F64',
      HOVER: '#B50D54',
    },
  };

  const state = {
    products: [],
    excluded: new Set(),
    skipped: 0,
    lastResults: [],
    searching: false,
    pendingResearch: false,
    subtotal: 0,
  };

  function parsePrice(text) {
    if (!text) return null;
    const m = String(text).match(/(\d[\d,]*)/);
    if (!m) return null;
    const n = Number(m[1].replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function remainingNeed(target, subtotal) {
    const t = Number(target);
    const s = Number(subtotal) || 0;
    if (!Number.isFinite(t) || t <= 0) return 0;
    return Math.max(0, t - s);
  }

  function parseShuangSongMov(text) {
    if (!text || !text.includes(CONFIG.VOUCHER_CODE)) return null;
    const escaped = CONFIG.VOUCHER_CODE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`"code":"${escaped}"[\\s\\S]{0,2000}?"minimumOrderValue":(\\d+)`);
    const m = String(text).match(re);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function formatMoney(n) {
    return `$${Number(n).toLocaleString('en-US')}`;
  }

  function isRestaurantPage() {
    return /\/restaurant\//i.test(location.pathname);
  }

  function extractProductId(card, name, price) {
    const stepper = card.querySelector(CONFIG.SELECTORS.STEPPER);
    const rawId = stepper?.id || '';
    const match = rawId.match(/quantity-stepper-(.+)/);
    if (match) return match[1];
    return `${name}:${price}`;
  }

  function scrapeSubtotal() {
    const nodes = document.querySelectorAll(CONFIG.SELECTORS.SUBTOTAL);
    for (const node of nodes) {
      const price = parsePrice(node.textContent);
      if (price != null) return price;
    }
    return 0;
  }

  function scrapeTargetFromPage() {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent;
      if (!text || !text.includes(CONFIG.VOUCHER_CODE)) continue;
      const value = parseShuangSongMov(text);
      if (value != null) return value;
    }
    return null;
  }

  function readCardPrice(card) {
    const priceEl = card.querySelector(CONFIG.SELECTORS.PRICE);
    if (!priceEl) return null;
    const clone = priceEl.cloneNode(true);
    clone.querySelector(CONFIG.SELECTORS.PRICE_BEFORE)?.remove();
    return parsePrice(clone.textContent);
  }

  function scrapeProducts() {
    const cards = [...document.querySelectorAll(CONFIG.SELECTORS.PRODUCT)];
    if (cards.length === 0) {
      return { products: [], skipped: 0, error: 'No menu products found on this page.' };
    }

    const products = [];
    let skipped = 0;
    const seen = new Set();

    for (const card of cards) {
      const nameEl = card.querySelector(CONFIG.SELECTORS.NAME);
      const name = nameEl?.textContent?.trim() || '';
      const price = readCardPrice(card);
      const image = card.querySelector(CONFIG.SELECTORS.IMAGE)?.getAttribute('src') || '';
      const id = extractProductId(card, name, price);

      if (!id || !name || price == null) {
        skipped += 1;
        continue;
      }
      const dupKey = `${name}|${price}`;
      if (seen.has(id) || seen.has(dupKey)) continue;
      seen.add(id);
      seen.add(dupKey);
      products.push({ id, name, price, image });
    }

    if (products.length === 0) {
      return {
        products: [],
        skipped,
        error: skipped
          ? `Could not parse any products (${skipped} skipped).`
          : 'No menu products found on this page.',
      };
    }

    return { products, skipped, error: null };
  }

  function compareCombos(a, b) {
    if (a.overage !== b.overage) return a.overage - b.overage;
    if (a.totalUnits !== b.totalUnits) return a.totalUnits - b.totalUnits;
    if (a.distinctCount !== b.distinctCount) return a.distinctCount - b.distinctCount;
    return a.total - b.total;
  }

  function comboKey(items) {
    return items
      .map((x) => `${x.id}:${x.qty}`)
      .sort()
      .join('|');
  }

  function findCombos(products, remaining, maxQty) {
    if (!Number.isFinite(remaining) || remaining <= 0) return [];
    const items = products
      .filter((p) => p && Number.isFinite(p.price) && p.price > 0)
      .slice()
      .sort((a, b) => a.price - b.price || String(a.id).localeCompare(String(b.id)));
    const n = items.length;
    if (n === 0) return [];

    const qtyLimit = Number.isInteger(maxQty) && maxQty >= 1 ? maxQty : 1;
    const suffixMax = new Array(n + 1).fill(0);
    const suffixMin = new Array(n + 1).fill(Infinity);
    for (let i = n - 1; i >= 0; i -= 1) {
      suffixMax[i] = suffixMax[i + 1] + items[i].price * qtyLimit;
      suffixMin[i] = Math.min(items[i].price, suffixMin[i + 1]);
    }

    const best = [];
    const seen = new Set();
    const qty = new Array(n).fill(0);

    function consider(total) {
      if (total < remaining) return;

      const picked = [];
      let totalUnits = 0;
      let distinctCount = 0;
      for (let i = 0; i < n; i += 1) {
        if (qty[i] <= 0) continue;
        picked.push({
          id: items[i].id,
          name: items[i].name,
          price: items[i].price,
          qty: qty[i],
        });
        totalUnits += qty[i];
        distinctCount += 1;
      }
      if (picked.length === 0) return;

      const key = comboKey(picked);
      if (seen.has(key)) return;

      const combo = {
        items: picked,
        total,
        overage: total - remaining,
        totalUnits,
        distinctCount,
      };

      if (best.length >= CONFIG.RESULT_COUNT && compareCombos(combo, best[best.length - 1]) > 0) {
        return;
      }

      seen.add(key);
      best.push(combo);
      best.sort(compareCombos);
      if (best.length > CONFIG.RESULT_COUNT) {
        const dropped = best.pop();
        seen.delete(comboKey(dropped.items));
      }
    }

    function dfs(index, sum, distinct) {
      if (sum >= remaining) {
        consider(sum);
        return;
      }
      if (index >= n) return;
      if (sum + suffixMax[index] < remaining) return;
      if (distinct >= CONFIG.MAX_DISTINCT) return;

      if (best.length >= CONFIG.RESULT_COUNT) {
        const need = remaining - sum;
        const minPrice = suffixMin[index];
        const minOverage = minPrice >= need ? minPrice - need : 0;
        if (minOverage > best[best.length - 1].overage) return;
      }

      const price = items[index].price;
      const maxQ = price >= remaining && sum > 0 ? 0 : qtyLimit;

      for (let q = maxQ; q >= 0; q -= 1) {
        if (q > 0 && distinct + 1 > CONFIG.MAX_DISTINCT) continue;
        qty[index] = q;
        dfs(index + 1, sum + price * q, distinct + (q > 0 ? 1 : 0));
        qty[index] = 0;
      }
    }

    dfs(0, 0, 0);
    best.sort(compareCombos);
    return best.slice(0, CONFIG.RESULT_COUNT);
  }

  function injectStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(CONFIG.UI.STYLES_ID)) return;
    const style = document.createElement('style');
    style.id = CONFIG.UI.STYLES_ID;
    style.textContent = `
      #${CONFIG.UI.ROOT_ID} {
        --fpc-primary: ${CONFIG.STYLES.PRIMARY};
        --fpc-hover: ${CONFIG.STYLES.HOVER};
        --fpc-bg: #ffffff;
        --fpc-text: #1a1a1a;
        --fpc-muted: #667085;
        --fpc-border: #e4e7ec;
        --fpc-soft: #f5f7f9;
        --fpc-danger: #b42318;
        font-family: "Segoe UI", "IBM Plex Sans", sans-serif;
        font-size: 13px;
        color: var(--fpc-text);
        box-sizing: border-box;
      }
      #${CONFIG.UI.ROOT_ID} *, #${CONFIG.UI.ROOT_ID} *::before, #${CONFIG.UI.ROOT_ID} *::after {
        box-sizing: border-box;
      }
      #${CONFIG.UI.OVERLAY_ID} {
        position: fixed;
        inset: 0;
        background: rgba(16, 24, 40, 0.28);
        z-index: 999990;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }
      #${CONFIG.UI.ROOT_ID}.open #${CONFIG.UI.OVERLAY_ID} {
        opacity: 1;
        pointer-events: auto;
      }
      #${CONFIG.UI.PANEL_ID} {
        position: fixed;
        top: 0;
        right: 0;
        width: min(400px, 100vw);
        height: 100vh;
        background: var(--fpc-bg);
        z-index: 999991;
        box-shadow: -8px 0 24px rgba(16, 24, 40, 0.12);
        transform: translateX(100%);
        transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1);
        display: flex;
        flex-direction: column;
      }
      #${CONFIG.UI.ROOT_ID}.open #${CONFIG.UI.PANEL_ID} {
        transform: translateX(0);
      }
      #${CONFIG.UI.PANEL_ID} .fpc-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 16px 12px;
        border-bottom: 1px solid var(--fpc-border);
        flex-shrink: 0;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-header h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 650;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-close {
        border: none;
        background: transparent;
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
        color: var(--fpc-muted);
        padding: 4px 8px;
        border-radius: 8px;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-close:hover { background: var(--fpc-soft); color: var(--fpc-text); }
      #${CONFIG.UI.PANEL_ID} .fpc-body {
        overflow: auto;
        flex: 1;
        padding: 12px 16px 24px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-section-title {
        margin: 0 0 8px;
        font-size: 12px;
        font-weight: 650;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--fpc-muted);
      }
      #${CONFIG.UI.PANEL_ID} .fpc-controls {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      #${CONFIG.UI.PANEL_ID} label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12px;
        color: var(--fpc-muted);
      }
      #${CONFIG.UI.PANEL_ID} input[type="number"] {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid var(--fpc-border);
        border-radius: 8px;
        font-size: 14px;
        color: var(--fpc-text);
      }
      #${CONFIG.UI.PANEL_ID} input[type="number"]:focus {
        outline: 2px solid rgba(215, 15, 100, 0.35);
        border-color: var(--fpc-primary);
      }
      #${CONFIG.UI.PANEL_ID} .fpc-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-btn {
        border: none;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease, opacity 0.15s ease;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-btn-primary {
        background: var(--fpc-primary);
        color: #fff;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-btn-primary:hover:not(:disabled) { background: var(--fpc-hover); }
      #${CONFIG.UI.PANEL_ID} .fpc-btn-secondary {
        background: var(--fpc-soft);
        color: var(--fpc-text);
        border: 1px solid var(--fpc-border);
      }
      #${CONFIG.UI.PANEL_ID} .fpc-btn-secondary:hover:not(:disabled) { background: #eef1f4; }
      #${CONFIG.UI.PANEL_ID} .fpc-status {
        font-size: 12px;
        color: var(--fpc-muted);
        min-height: 1.2em;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-status.error { color: var(--fpc-danger); }
      #${CONFIG.UI.PANEL_ID} .fpc-product-tools {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-product-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 240px;
        overflow: auto;
        padding-right: 2px;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-product {
        display: grid;
        grid-template-columns: 40px 1fr auto;
        gap: 8px;
        align-items: center;
        padding: 8px;
        border: 1px solid var(--fpc-border);
        border-radius: 10px;
        background: #fff;
        transition: opacity 0.15s ease, background 0.15s ease;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-product.excluded {
        opacity: 0.45;
        background: var(--fpc-soft);
      }
      #${CONFIG.UI.PANEL_ID} .fpc-product img {
        width: 40px;
        height: 40px;
        object-fit: cover;
        border-radius: 6px;
        background: var(--fpc-soft);
      }
      #${CONFIG.UI.PANEL_ID} .fpc-product-meta { min-width: 0; }
      #${CONFIG.UI.PANEL_ID} .fpc-name-row {
        display: flex;
        align-items: center;
        gap: 2px;
        min-width: 0;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-jump {
        appearance: none;
        border: none;
        background: transparent;
        padding: 0;
        margin: 0;
        font: inherit;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-jump:hover {
        color: var(--fpc-primary);
        text-decoration: underline;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-product-name {
        font-size: 12px;
        font-weight: 560;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
        max-width: 100%;
        flex: 0 1 auto;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-remove {
        flex-shrink: 0;
        border: none;
        background: transparent;
        color: var(--fpc-muted);
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 0 4px;
        border-radius: 4px;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-remove:hover {
        color: var(--fpc-danger);
        background: #fdecec;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-product-price {
        font-size: 12px;
        color: var(--fpc-muted);
        margin-top: 2px;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-toggle {
        appearance: none;
        width: 40px;
        height: 22px;
        border-radius: 999px;
        background: #d0d5dd;
        position: relative;
        cursor: pointer;
        border: none;
        flex-shrink: 0;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-toggle::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #fff;
        transition: transform 0.15s ease;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
      }
      #${CONFIG.UI.PANEL_ID} .fpc-toggle.on { background: var(--fpc-primary); }
      #${CONFIG.UI.PANEL_ID} .fpc-toggle.on::after { transform: translateX(18px); }
      #${CONFIG.UI.PANEL_ID} .fpc-results {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-card {
        border: 1px solid var(--fpc-border);
        border-radius: 12px;
        padding: 12px;
        background: #fff;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-card-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 8px;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-rank { font-weight: 700; font-size: 13px; }
      #${CONFIG.UI.PANEL_ID} .fpc-totals { text-align: right; }
      #${CONFIG.UI.PANEL_ID} .fpc-total { font-weight: 700; font-size: 13px; }
      #${CONFIG.UI.PANEL_ID} .fpc-excess {
        font-size: 12px;
        color: var(--fpc-primary);
        font-weight: 650;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-lines {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-lines li {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px;
        font-size: 12px;
        color: var(--fpc-text);
        line-height: 1.35;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-lines .qty {
        font-weight: 700;
        color: var(--fpc-muted);
      }
      #${CONFIG.UI.FAB_ID} {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999992;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        overflow: hidden;
        height: 56px;
        min-width: 56px;
        width: auto;
        border-radius: 16px;
        padding: 0 16px;
        background: ${CONFIG.STYLES.PRIMARY};
        box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3);
        border: none;
        color: #ffffff;
        font-family: "Segoe UI", "IBM Plex Sans", sans-serif;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
        opacity: 0.6;
        white-space: nowrap;
        letter-spacing: 0.1px;
      }
      #${CONFIG.UI.ROOT_ID}.open #${CONFIG.UI.FAB_ID} { opacity: 1; }
      .fpc-jump-target {
        box-shadow: 0 0 0 3px ${CONFIG.STYLES.PRIMARY} !important;
        border-radius: 12px;
      }
    `;
    document.head.appendChild(style);
  }

  function createSvgIcon() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('height', '24px');
    svg.setAttribute('viewBox', '0 -960 960 960');
    svg.setAttribute('width', '24px');
    svg.setAttribute('fill', '#FFFFFF');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute(
      'd',
      'M280-80q-33 0-56.5-23.5T200-160q0-33 23.5-56.5T280-240q33 0 56.5 23.5T360-160q0 33-23.5 56.5T280-80Zm400 0q-33 0-56.5-23.5T600-160q0-33 23.5-56.5T680-240q33 0 56.5 23.5T760-160q0 33-23.5 56.5T680-80ZM208-820l70 152h430l78-152H208Zm46 600q-40 0-68.5-29.5T160-320l52-240h536l52 240q3 41-25.5 70.5T706-220H254Zm-46-520h600l-74 144H282l-74-144Z',
    );
    svg.appendChild(path);
    return svg;
  }

  function setOpen(open) {
    const root = document.getElementById(CONFIG.UI.ROOT_ID);
    if (!root) return;
    root.classList.toggle('open', open);
    if (open) refreshProducts();
  }

  function isOpen() {
    return document.getElementById(CONFIG.UI.ROOT_ID)?.classList.contains('open');
  }

  let highlightedCard = null;
  let highlightTimer = 0;

  function locateProductCard(product) {
    const stepper = document.getElementById(`quantity-stepper-${product.id}`);
    const byId = stepper?.closest?.(CONFIG.SELECTORS.PRODUCT);
    if (byId) return byId;

    const cards = document.querySelectorAll(CONFIG.SELECTORS.PRODUCT);
    let nameMatch = null;
    for (const card of cards) {
      const name = card.querySelector(CONFIG.SELECTORS.NAME)?.textContent?.trim();
      if (name !== product.name) continue;
      if (readCardPrice(card) === product.price) return card;
      if (!nameMatch) nameMatch = card;
    }
    return nameMatch;
  }

  function jumpToProduct(product) {
    const card = locateProductCard(product);
    if (!card) {
      setStatus(`Could not find ${product.name} on the menu.`, true);
      return;
    }
    if (highlightedCard && highlightedCard !== card) {
      highlightedCard.classList.remove('fpc-jump-target');
    }
    highlightedCard = card;
    card.classList.add('fpc-jump-target');
    setOpen(false);
    document.getElementById(CONFIG.UI.FAB_ID)?.dispatchEvent(new Event('mouseleave'));
    card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    window.clearTimeout(highlightTimer);
    highlightTimer = window.setTimeout(() => {
      card.classList.remove('fpc-jump-target');
      if (highlightedCard === card) highlightedCard = null;
    }, 2200);
  }

  function removeFromAllowed(id) {
    state.excluded.add(id);
    renderProducts();
    if (!state.lastResults.length) {
      const status = productStatusMessage(null);
      setStatus(status.msg, status.isError);
      return;
    }
    if (state.searching) {
      state.pendingResearch = true;
      return;
    }
    runSearch();
  }

  function makeJumpButton(product, className = 'fpc-jump') {
    const name = document.createElement('button');
    name.type = 'button';
    name.className = className;
    name.title = product.name;
    name.textContent = product.name;
    name.setAttribute('aria-label', `Show ${product.name} on the menu`);
    name.addEventListener('click', () => jumpToProduct(product));
    return name;
  }

  function makeRemoveButton(product) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fpc-remove';
    btn.title = 'Remove from allowed combos';
    btn.setAttribute('aria-label', `Remove ${product.name} from allowed combos`);
    btn.textContent = '×';
    btn.addEventListener('click', () => removeFromAllowed(product.id));
    return btn;
  }

  function setStatus(msg, isError = false) {
    const el = document.getElementById('fpc-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('error', Boolean(isError && msg));
  }

  function currentTarget() {
    const targetInput = document.getElementById('fpc-target');
    const n = Number(targetInput?.value);
    return Number.isFinite(n) && n > 0 ? n : CONFIG.DEFAULT_TARGET;
  }

  function renderSummary() {
    const el = document.getElementById('fpc-summary');
    if (!el) return;
    const target = currentTarget();
    const remaining = remainingNeed(target, state.subtotal);
    el.textContent = `小計 ${formatMoney(state.subtotal)} · remaining ${formatMoney(remaining)} to ${formatMoney(target)}`;
  }

  function renderProducts() {
    const list = document.getElementById('fpc-product-list');
    if (!list) return;
    list.replaceChildren();

    for (const p of state.products) {
      const excluded = state.excluded.has(p.id);
      const row = document.createElement('div');
      row.className = `fpc-product${excluded ? ' excluded' : ''}`;
      row.dataset.id = p.id;

      const img = document.createElement('img');
      img.alt = '';
      img.src = p.image || '';
      img.referrerPolicy = 'no-referrer';

      const meta = document.createElement('div');
      meta.className = 'fpc-product-meta';
      const nameRow = document.createElement('div');
      nameRow.className = 'fpc-name-row';
      nameRow.appendChild(makeJumpButton(p, 'fpc-jump fpc-product-name'));
      if (!excluded) nameRow.appendChild(makeRemoveButton(p));
      const price = document.createElement('div');
      price.className = 'fpc-product-price';
      price.textContent = formatMoney(p.price);
      meta.append(nameRow, price);

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = `fpc-toggle${excluded ? '' : ' on'}`;
      toggle.title = excluded ? 'Excluded — click to include' : 'Included — click to exclude';
      toggle.setAttribute('aria-pressed', excluded ? 'false' : 'true');
      toggle.addEventListener('click', () => {
        if (state.excluded.has(p.id)) state.excluded.delete(p.id);
        else state.excluded.add(p.id);
        renderProducts();
      });

      row.append(img, meta, toggle);
      list.appendChild(row);
    }
  }

  function renderResults(results) {
    const wrap = document.getElementById('fpc-results');
    if (!wrap) return;
    wrap.replaceChildren();
    state.lastResults = results;

    if (!results.length) {
      const empty = document.createElement('div');
      empty.className = 'fpc-status';
      empty.textContent = 'No combinations reach the remaining amount with the current settings.';
      wrap.appendChild(empty);
      return;
    }

    results.forEach((combo, idx) => {
      const card = document.createElement('div');
      card.className = 'fpc-card';

      const head = document.createElement('div');
      head.className = 'fpc-card-head';
      const rank = document.createElement('div');
      rank.className = 'fpc-rank';
      rank.textContent = `#${idx + 1}`;
      const totals = document.createElement('div');
      totals.className = 'fpc-totals';
      const total = document.createElement('div');
      total.className = 'fpc-total';
      total.textContent = formatMoney(combo.total);
      const gap = document.createElement('div');
      gap.className = 'fpc-excess';
      gap.textContent =
        combo.overage === 0
          ? 'Exact match'
          : `${combo.overage.toLocaleString('en-US')} over threshold`;
      totals.append(total, gap);
      head.append(rank, totals);

      const lines = document.createElement('ul');
      lines.className = 'fpc-lines';
      for (const line of combo.items) {
        const li = document.createElement('li');
        const qty = document.createElement('span');
        qty.className = 'qty';
        qty.textContent = `×${line.qty} ·`;
        const price = document.createElement('span');
        price.textContent = `· ${formatMoney(line.price)}`;
        li.append(qty, makeJumpButton(line), makeRemoveButton(line), price);
        lines.appendChild(li);
      }

      card.append(head, lines);
      wrap.appendChild(card);
    });
  }

  function productStatusMessage(error) {
    if (error) return { msg: error, isError: true };
    const excludedCount = [...state.excluded].filter((id) => state.products.some((p) => p.id === id)).length;
    const included = state.products.length - excludedCount;
    const skipNote = state.skipped ? ` · ${state.skipped} skipped` : '';
    return {
      msg: `${state.products.length} products · ${included} included${skipNote}`,
      isError: false,
    };
  }

  function refreshProducts() {
    const { products, skipped, error } = scrapeProducts();
    const nextIds = new Set(products.map((p) => p.id));
    for (const id of [...state.excluded]) {
      if (!nextIds.has(id)) state.excluded.delete(id);
    }
    state.products = products;
    state.skipped = skipped;
    state.subtotal = scrapeSubtotal();
    renderProducts();
    renderSummary();

    const status = productStatusMessage(error);
    setStatus(status.msg, status.isError);
  }

  function runSearch() {
    if (state.searching) return;

    const targetInput = document.getElementById('fpc-target');
    const maxQtyInput = document.getElementById('fpc-max-qty');
    const target = Number(targetInput?.value);
    const maxQty = Number(maxQtyInput?.value);

    if (!Number.isFinite(target) || target <= 0) {
      setStatus('Target must be a number greater than 0.', true);
      return;
    }
    if (!Number.isFinite(maxQty) || maxQty < 1 || !Number.isInteger(maxQty)) {
      setStatus('Max qty/item must be an integer ≥ 1.', true);
      return;
    }

    refreshProducts();
    const remaining = remainingNeed(target, state.subtotal);
    renderSummary();

    if (remaining === 0) {
      renderResults([]);
      setStatus(`Cart subtotal ${formatMoney(state.subtotal)} already meets ${formatMoney(target)}.`);
      return;
    }

    const included = state.products.filter((p) => !state.excluded.has(p.id));
    if (!included.length) {
      setStatus('No included products. Include at least one item.', true);
      renderResults([]);
      return;
    }

    const findBtn = document.getElementById('fpc-find');
    state.searching = true;
    if (findBtn) findBtn.disabled = true;
    setStatus(`Searching for ≥ ${formatMoney(remaining)}…`);

    requestAnimationFrame(() => {
      try {
        const current = state.products.filter((p) => !state.excluded.has(p.id));
        const results = current.length ? findCombos(current, remaining, maxQty) : [];
        renderResults(results);
        if (!current.length) {
          setStatus('No included products. Include at least one item.', true);
        } else {
          setStatus(
            results.length
              ? `Found ${results.length} combination${results.length === 1 ? '' : 's'} (≥ ${formatMoney(remaining)}).`
              : 'No combinations reach the remaining amount with the current settings.',
            results.length === 0,
          );
        }
      } catch (err) {
        console.error('[Foodpanda Combo Finder]', err);
        setStatus(`Search failed: ${err.message || err}`, true);
      } finally {
        state.searching = false;
        if (findBtn) findBtn.disabled = false;
        if (state.pendingResearch) {
          state.pendingResearch = false;
          runSearch();
        }
      }
    });
  }

  function buildPanel(root) {
    const overlay = document.createElement('div');
    overlay.id = CONFIG.UI.OVERLAY_ID;
    overlay.addEventListener('click', () => setOpen(false));

    const panel = document.createElement('div');
    panel.id = CONFIG.UI.PANEL_ID;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Foodpanda Combo Finder');

    const header = document.createElement('div');
    header.className = 'fpc-header';
    const title = document.createElement('h2');
    title.textContent = 'Combo Finder';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'fpc-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', () => setOpen(false));
    header.append(title, close);

    const body = document.createElement('div');
    body.className = 'fpc-body';

    const controlsWrap = document.createElement('div');
    const controlsTitle = document.createElement('div');
    controlsTitle.className = 'fpc-section-title';
    controlsTitle.textContent = 'Settings';
    const controls = document.createElement('div');
    controls.className = 'fpc-controls';

    const scraped = scrapeTargetFromPage();
    const initialTarget = scraped != null ? scraped : CONFIG.DEFAULT_TARGET;

    const targetLabel = document.createElement('label');
    targetLabel.textContent = 'Target amount';
    const targetInput = document.createElement('input');
    targetInput.id = 'fpc-target';
    targetInput.type = 'number';
    targetInput.min = '1';
    targetInput.step = '1';
    targetInput.value = String(initialTarget);
    targetInput.addEventListener('input', renderSummary);
    targetLabel.appendChild(targetInput);

    const maxLabel = document.createElement('label');
    maxLabel.textContent = 'Max qty / item';
    const maxInput = document.createElement('input');
    maxInput.id = 'fpc-max-qty';
    maxInput.type = 'number';
    maxInput.min = '1';
    maxInput.step = '1';
    maxInput.value = String(CONFIG.DEFAULT_MAX_QTY);
    maxLabel.appendChild(maxInput);

    controls.append(targetLabel, maxLabel);
    const summary = document.createElement('div');
    summary.id = 'fpc-summary';
    summary.className = 'fpc-status';
    controlsWrap.append(controlsTitle, controls, summary);

    const actions = document.createElement('div');
    actions.className = 'fpc-actions';
    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'fpc-btn fpc-btn-secondary';
    refreshBtn.textContent = 'Refresh';
    refreshBtn.addEventListener('click', () => refreshProducts());
    const findBtn = document.createElement('button');
    findBtn.type = 'button';
    findBtn.id = 'fpc-find';
    findBtn.className = 'fpc-btn fpc-btn-primary';
    findBtn.textContent = 'Find Combos';
    findBtn.addEventListener('click', () => runSearch());
    actions.append(refreshBtn, findBtn);

    const status = document.createElement('div');
    status.id = 'fpc-status';
    status.className = 'fpc-status';

    const productsWrap = document.createElement('div');
    const productsTitle = document.createElement('div');
    productsTitle.className = 'fpc-section-title';
    productsTitle.textContent = 'Menu';
    const productTools = document.createElement('div');
    productTools.className = 'fpc-product-tools';
    const includeAll = document.createElement('button');
    includeAll.type = 'button';
    includeAll.className = 'fpc-btn fpc-btn-secondary';
    includeAll.textContent = 'Include all';
    includeAll.addEventListener('click', () => {
      state.excluded.clear();
      renderProducts();
      setStatus(`${state.products.length} products · ${state.products.length} included`);
    });
    const excludeAll = document.createElement('button');
    excludeAll.type = 'button';
    excludeAll.className = 'fpc-btn fpc-btn-secondary';
    excludeAll.textContent = 'Exclude all';
    excludeAll.addEventListener('click', () => {
      state.products.forEach((p) => state.excluded.add(p.id));
      renderProducts();
      setStatus(`${state.products.length} products · 0 included`);
    });
    productTools.append(includeAll, excludeAll);
    const productList = document.createElement('div');
    productList.id = 'fpc-product-list';
    productList.className = 'fpc-product-list';
    productsWrap.append(productsTitle, productTools, productList);

    const resultsWrap = document.createElement('div');
    const resultsTitle = document.createElement('div');
    resultsTitle.className = 'fpc-section-title';
    resultsTitle.textContent = 'Top combinations';
    const results = document.createElement('div');
    results.id = 'fpc-results';
    results.className = 'fpc-results';
    resultsWrap.append(resultsTitle, results);

    body.append(controlsWrap, actions, status, productsWrap, resultsWrap);
    panel.append(header, body);
    root.append(overlay, panel);
  }

  function createFab(root) {
    if (document.getElementById(CONFIG.UI.FAB_ID)) return;

    const btn = document.createElement('button');
    btn.id = CONFIG.UI.FAB_ID;
    btn.type = 'button';
    btn.setAttribute('aria-label', CONFIG.UI.LABEL);

    const iconContainer = document.createElement('div');
    Object.assign(iconContainer.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '24px',
      height: '24px',
      marginRight: '0px',
      transition: 'margin-right 0.2s ease',
      flexShrink: '0',
    });
    try {
      iconContainer.appendChild(createSvgIcon());
    } catch (e) {
      iconContainer.textContent = '🛒';
    }

    const labelSpan = document.createElement('span');
    labelSpan.innerText = CONFIG.UI.LABEL;
    Object.assign(labelSpan.style, {
      maxWidth: '0',
      opacity: '0',
      transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
      overflow: 'hidden',
      display: 'inline-block',
    });

    btn.append(iconContainer, labelSpan);

    const expand = () => {
      btn.style.opacity = '1';
      btn.style.minWidth = '168px';
      btn.style.background = CONFIG.STYLES.HOVER;
      btn.style.boxShadow = '0 6px 10px 4px rgba(0, 0, 0, 0.15), 0 2px 3px rgba(0, 0, 0, 0.3)';
      iconContainer.style.marginRight = '12px';
      labelSpan.style.maxWidth = '120px';
      labelSpan.style.opacity = '1';
    };

    const collapse = () => {
      if (isOpen()) {
        btn.style.opacity = '1';
        return;
      }
      btn.style.opacity = '0.6';
      btn.style.minWidth = '56px';
      btn.style.background = CONFIG.STYLES.PRIMARY;
      btn.style.boxShadow = '0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3)';
      iconContainer.style.marginRight = '0px';
      labelSpan.style.maxWidth = '0';
      labelSpan.style.opacity = '0';
    };

    btn.addEventListener('mouseenter', expand);
    btn.addEventListener('mouseleave', collapse);
    btn.addEventListener('click', () => {
      setOpen(!isOpen());
      if (isOpen()) expand();
      else collapse();
    });

    root.appendChild(btn);
  }

  function mountUi() {
    if (document.getElementById(CONFIG.UI.ROOT_ID)) return;
    injectStyles();
    const root = document.createElement('div');
    root.id = CONFIG.UI.ROOT_ID;
    buildPanel(root);
    createFab(root);
    document.body.appendChild(root);
  }

  function unmountUi() {
    document.getElementById(CONFIG.UI.ROOT_ID)?.remove();
    document.getElementById(CONFIG.UI.STYLES_ID)?.remove();
  }

  function syncToRoute() {
    if (isRestaurantPage()) mountUi();
    else unmountUi();
  }

  function watchSpaNavigation() {
    let lastUrl = location.href;
    const check = () => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      syncToRoute();
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
    syncToRoute();
    watchSpaNavigation();
  }

  const api = { parsePrice, remainingNeed, parseShuangSongMov, findCombos, CONFIG };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.__fpMealComboFinder = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
