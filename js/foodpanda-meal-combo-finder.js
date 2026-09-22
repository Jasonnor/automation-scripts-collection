// ==UserScript==
// @name         Foodpanda Meal Combo Finder
// @namespace    http://tampermonkey.net/
// @version      2026-09-22
// @author       Jasonnor
// @description  Find menu combinations that meet a coupon minimum (default $260), accounting for the current cart subtotal. Exclusions can sync to a GitHub App installed on one private repository.
// @match        *://www.foodpanda.com.tw/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=foodpanda.com.tw
// @connect      github.com
// @connect      api.github.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

(function (global) {
  'use strict';

  const CONFIG = {
    DEFAULT_TARGET: 260,
    DEFAULT_MAX_QTY: 1,
    RESULT_COUNT: 10,
    MAX_DISTINCT: 4,
    SEARCH_DEBOUNCE_MS: 300,
    VOUCHER_CODE: '爽爽送',
    // Public client id from the GitHub App settings page. Empty until that app exists.
    GITHUB_CLIENT_ID: 'Iv23liSV5Q2tMc3RyHAq',
    LIST_PATH: 'foodpanda-combo-lists.json',
    STORAGE_TOKEN: 'fp-combo-sync-token',
    STORAGE_REPO: 'fp-combo-sync-repo',
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
    restaurantCode: '',
    savedIds: [],
    token: '',
    connectedRepo: null,
    canSave: true,
    listLoading: false,
    loadGeneration: 0,
    connectGeneration: 0,
    pendingSyncStatus: null,
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

  function restaurantCode(pathname) {
    const parts = String(pathname || '').split('/').filter(Boolean);
    const index = parts.findIndex((part) => part.toLowerCase() === 'restaurant');
    if (index === -1 || !parts[index + 1]) return '';
    return parts[index + 1];
  }

  function nextStoredIds(storedIds, products, excludedIds) {
    const excluded = new Set(excludedIds);
    const onPage = new Map(products.map((product) => [product.id, product]));
    const next = new Set();
    for (const id of storedIds) {
      const product = onPage.get(id);
      if (!product) next.add(id);
      else if (excluded.has(id) && product.stableId) next.add(id);
    }
    for (const product of products) {
      if (product.stableId && excluded.has(product.id)) next.add(product.id);
    }
    return [...next].sort();
  }

  function visibleExclusions(excludedIds, productIds, keepMissing) {
    if (keepMissing) return [...excludedIds];
    const onPage = new Set(productIds);
    return [...excludedIds].filter((id) => onPage.has(id));
  }

  function invalidLists() {
    const err = new Error('invalid lists file');
    err.code = 'invalid';
    return err;
  }

  function parseLists(text) {
    if (!text || !String(text).trim()) return { stores: {} };
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw invalidLists();
    }
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      !data.stores ||
      typeof data.stores !== 'object' ||
      Array.isArray(data.stores)
    ) {
      throw invalidLists();
    }
    for (const value of Object.values(data.stores)) {
      if (!Array.isArray(value) || value.some((id) => typeof id !== 'string')) throw invalidLists();
    }
    return { stores: data.stores };
  }

  function fileWithStore(doc, code, ids) {
    const stores = { ...doc.stores };
    const unique = [...new Set(ids)].filter((id) => typeof id === 'string').sort();
    if (unique.length) stores[code] = unique;
    else delete stores[code];
    const ordered = {};
    for (const key of Object.keys(stores).sort()) ordered[key] = [...stores[key]].sort();
    return { stores: ordered };
  }

  async function saveStoreFile({ read, write, code, ids }) {
    let current = await read();
    let doc = parseLists(current.text);
    let next = fileWithStore(doc, code, ids);
    const bodyFor = (document, sha) => ({
      text: `${JSON.stringify(document, null, 2)}\n`,
      sha,
    });
    try {
      await write(bodyFor(next, current.sha));
    } catch (err) {
      if (err.code !== 'conflict') throw err;
      current = await read();
      doc = parseLists(current.text);
      next = fileWithStore(doc, code, ids);
      await write(bodyFor(next, current.sha));
    }
  }

  function reposFromInstallations(pages) {
    let count = 0;
    const repos = [];
    for (const page of pages) {
      const listed = page.repositories || [];
      const reported = Number(page.total_count);
      count += Number.isFinite(reported) ? reported : listed.length;
      for (const repo of listed) repos.push({ owner: repo.owner.login, name: repo.name });
    }
    return { count, repos };
  }

  function soleRepository(count, repos) {
    if (count !== 1 || repos.length !== 1) return null;
    return repos[0];
  }

  function createSaveSequencer(run) {
    let running = false;
    let pending = null;
    let chain = Promise.resolve();
    return (payload) => {
      pending = payload;
      if (running) return chain;
      running = true;
      chain = (async () => {
        try {
          while (pending) {
            const current = pending;
            pending = null;
            try {
              await run(current);
            } catch (err) {
              if (!pending) throw err;
            }
          }
        } finally {
          running = false;
        }
      })();
      return chain;
    };
  }

  function encodeBase64Utf8(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function decodeBase64Utf8(content) {
    const binary = atob(String(content).replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function isRestaurantPage() {
    return /\/restaurant\//i.test(location.pathname);
  }

  function extractProductId(card, name, price) {
    const stepper = card.querySelector(CONFIG.SELECTORS.STEPPER);
    const rawId = stepper?.id || '';
    const match = rawId.match(/quantity-stepper-(.+)/);
    if (match) return { id: match[1], stableId: true };
    return { id: `${name}:${price}`, stableId: false };
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
      const { id, stableId } = extractProductId(card, name, price);

      if (!id || !name || price == null) {
        skipped += 1;
        continue;
      }
      const dupKey = `${name}|${price}`;
      if (seen.has(id) || seen.has(dupKey)) continue;
      seen.add(id);
      seen.add(dupKey);
      products.push({ id, name, price, image, stableId });
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
      #${CONFIG.UI.PANEL_ID} .fpc-sync {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      #${CONFIG.UI.PANEL_ID} .fpc-sync .fpc-status { flex: 1; }
      #${CONFIG.UI.PANEL_ID} .fpc-sync .fpc-btn { flex-shrink: 0; }
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

  let searchTimer = 0;

  function requestSearch() {
    if (state.searching) {
      state.pendingResearch = true;
      return;
    }
    runSearch();
  }

  function requestSearchSoon() {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(requestSearch, CONFIG.SEARCH_DEBOUNCE_MS);
  }

  function changeExcluded(mutate) {
    if (state.listLoading) return;
    mutate();
    renderProducts();
    requestSearch();
    scheduleSave();
  }

  function removeFromAllowed(id) {
    changeExcluded(() => {
      state.excluded.add(id);
    });
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
        changeExcluded(() => {
          if (state.excluded.has(p.id)) state.excluded.delete(p.id);
          else state.excluded.add(p.id);
        });
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
    state.excluded = new Set(
      visibleExclusions(
        [...state.excluded],
        products.map((p) => p.id),
        Boolean(state.token),
      ),
    );
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

    const syncRow = document.createElement('div');
    syncRow.className = 'fpc-sync';
    const syncStatus = document.createElement('div');
    syncStatus.id = 'fpc-sync-status';
    syncStatus.className = 'fpc-status';
    const syncButton = document.createElement('button');
    syncButton.type = 'button';
    syncButton.id = 'fpc-sync-toggle';
    syncButton.className = 'fpc-btn fpc-btn-secondary';
    syncButton.textContent = state.token ? 'Disconnect' : 'Connect';
    syncButton.addEventListener('click', () => {
      if (state.token) disconnect();
      else void startConnect();
    });
    syncRow.append(syncStatus, syncButton);

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
    targetInput.addEventListener('input', () => {
      renderSummary();
      requestSearchSoon();
    });
    targetLabel.appendChild(targetInput);

    const maxLabel = document.createElement('label');
    maxLabel.textContent = 'Max qty / item';
    const maxInput = document.createElement('input');
    maxInput.id = 'fpc-max-qty';
    maxInput.type = 'number';
    maxInput.min = '1';
    maxInput.step = '1';
    maxInput.value = String(CONFIG.DEFAULT_MAX_QTY);
    maxInput.addEventListener('input', requestSearchSoon);
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
    refreshBtn.addEventListener('click', () => requestSearch());
    const findBtn = document.createElement('button');
    findBtn.type = 'button';
    findBtn.id = 'fpc-find';
    findBtn.className = 'fpc-btn fpc-btn-primary';
    findBtn.textContent = 'Find Combos';
    findBtn.addEventListener('click', () => requestSearch());
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
      changeExcluded(() => {
        state.excluded.clear();
      });
    });
    const excludeAll = document.createElement('button');
    excludeAll.type = 'button';
    excludeAll.className = 'fpc-btn fpc-btn-secondary';
    excludeAll.textContent = 'Exclude all';
    excludeAll.addEventListener('click', () => {
      changeExcluded(() => {
        state.products.forEach((p) => state.excluded.add(p.id));
      });
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

    body.append(syncRow, controlsWrap, actions, status, productsWrap, resultsWrap);
    panel.append(header, body);
    root.append(overlay, panel);
    renderSyncStatus();
    updateSyncButton(false);
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

  function storageGet(key, fallback) {
    if (typeof GM_getValue !== 'function') return fallback;
    const value = GM_getValue(key, fallback);
    return value == null ? fallback : value;
  }

  function storageSet(key, value) {
    if (typeof GM_setValue === 'function') GM_setValue(key, value);
  }

  function setSyncStatus(msg, isError = false) {
    state.pendingSyncStatus = { msg, isError: Boolean(isError) };
    renderSyncStatus();
  }

  function renderSyncStatus() {
    const pending = state.pendingSyncStatus;
    const el = document.getElementById('fpc-sync-status');
    if (!pending || !el) return;
    el.textContent = pending.msg || '';
    el.classList.toggle('error', Boolean(pending.isError && pending.msg));
  }

  function updateSyncButton(busy) {
    const button = document.getElementById('fpc-sync-toggle');
    if (!button) return;
    button.disabled = Boolean(busy);
    button.textContent = state.token ? 'Disconnect' : 'Connect';
  }

  function connectedMessage() {
    const repo = state.connectedRepo;
    return repo ? `Syncing to ${repo.owner}/${repo.name}` : 'Not connected';
  }

  function installRejectionMessage(count) {
    if (count === 0) return 'Install the GitHub App on one private repository, then connect again.';
    return `The GitHub App can see ${count} repositories. Install it on one private repository, then connect again.`;
  }

  function forgetCredentials() {
    state.token = '';
    state.connectedRepo = null;
    state.canSave = true;
    state.listLoading = false;
    storageSet(CONFIG.STORAGE_TOKEN, '');
    storageSet(CONFIG.STORAGE_REPO, null);
  }

  function gmRequest(details) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== 'function') {
        const err = new Error('network');
        err.code = 'network';
        reject(err);
        return;
      }
      GM_xmlhttpRequest({
        method: details.method,
        url: details.url,
        headers: details.headers,
        data: details.data,
        onload: (response) => resolve({ status: response.status, text: response.responseText || '' }),
        onerror: () => {
          const err = new Error('network');
          err.code = 'network';
          reject(err);
        },
        ontimeout: () => {
          const err = new Error('network');
          err.code = 'network';
          reject(err);
        },
      });
    });
  }

  function parseResponseBody(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async function githubRequest(path, { method = 'GET', token, body } = {}) {
    const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'foodpanda-meal-combo-finder',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await gmRequest({
      method,
      url: `https://api.github.com${path}`,
      headers,
      data: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 401) {
      const err = new Error('unauthorized');
      err.status = 401;
      throw err;
    }
    return { status: response.status, body: parseResponseBody(response.text) };
  }

  async function readListFile() {
    const repo = state.connectedRepo;
    const response = await githubRequest(
      `/repos/${repo.owner}/${repo.name}/contents/${CONFIG.LIST_PATH}`,
      { token: state.token },
    );
    if (response.status === 404) return { text: '', sha: null };
    if (response.status !== 200 || !response.body) {
      const err = new Error('read failed');
      err.status = response.status;
      throw err;
    }
    return {
      text: decodeBase64Utf8(response.body.content || ''),
      sha: response.body.sha,
    };
  }

  async function writeListFile({ text, sha }) {
    const repo = state.connectedRepo;
    const body = {
      message: 'Update combo exclusions',
      content: encodeBase64Utf8(text),
    };
    if (sha) body.sha = sha;
    const response = await githubRequest(
      `/repos/${repo.owner}/${repo.name}/contents/${CONFIG.LIST_PATH}`,
      { method: 'PUT', token: state.token, body },
    );
    if (response.status === 409) {
      const err = new Error('conflict');
      err.code = 'conflict';
      throw err;
    }
    if (response.status !== 200 && response.status !== 201) {
      const err = new Error('write failed');
      err.status = response.status;
      throw err;
    }
  }

  async function listAccessibleRepos() {
    const response = await githubRequest('/user/installations', { token: state.token });
    if (response.status !== 200) {
      const err = new Error('installations failed');
      err.status = response.status;
      throw err;
    }
    const pages = [];
    for (const installation of response.body?.installations || []) {
      const repos = await githubRequest(
        `/user/installations/${installation.id}/repositories?per_page=100`,
        { token: state.token },
      );
      if (repos.status !== 200 || !repos.body) {
        const err = new Error('repositories failed');
        err.status = repos.status;
        throw err;
      }
      pages.push(repos.body);
    }
    return reposFromInstallations(pages);
  }

  function rejectBroadInstall(count) {
    forgetCredentials();
    setSyncStatus(installRejectionMessage(count), true);
    updateSyncButton(false);
  }

  async function loadExclusions(code, generation) {
    if (!state.token || !state.connectedRepo) return;
    state.listLoading = true;
    setSyncStatus('Loading exclusions…');
    try {
      const file = await readListFile();
      if (generation !== state.loadGeneration || code !== state.restaurantCode || !state.token) return;
      const doc = parseLists(file.text);
      const ids = [...(doc.stores[code] || [])];
      state.savedIds = ids;
      state.excluded = new Set(ids);
      state.canSave = true;
      state.listLoading = false;
      setSyncStatus(connectedMessage());
      if (isOpen()) refreshProducts();
    } catch (err) {
      if (generation !== state.loadGeneration || code !== state.restaurantCode) return;
      state.listLoading = false;
      if (err.status === 401) {
        forgetCredentials();
        setSyncStatus('GitHub rejected the token. Connect again.', true);
        updateSyncButton(false);
        return;
      }
      state.canSave = false;
      if (err.code === 'invalid') {
        setSyncStatus('The lists file on GitHub is not valid. It was left unchanged.', true);
        return;
      }
      setSyncStatus('Could not load exclusions.', true);
    }
  }

  const enqueueSave = createSaveSequencer(async (payload) => {
    await saveStoreFile({
      read: readListFile,
      write: writeListFile,
      code: payload.code,
      ids: payload.ids,
    });
    if (state.restaurantCode === payload.code) state.savedIds = payload.ids;
    setSyncStatus(connectedMessage());
  });

  function scheduleSave() {
    if (!state.canSave || !state.token || !state.connectedRepo || !state.restaurantCode) return;
    const ids = nextStoredIds(state.savedIds, state.products, [...state.excluded]);
    void enqueueSave({ code: state.restaurantCode, ids }).catch((err) => {
      if (err.status === 401) {
        forgetCredentials();
        setSyncStatus('GitHub rejected the token. Connect again.', true);
        updateSyncButton(false);
        return;
      }
      if (err.code === 'invalid') {
        setSyncStatus('The lists file on GitHub is not valid. It was left unchanged.', true);
        return;
      }
      setSyncStatus('Could not save exclusions.', true);
    });
  }

  function switchRestaurant(code) {
    if (code === state.restaurantCode) return;
    state.restaurantCode = code;
    state.excluded = new Set();
    state.savedIds = [];
    state.loadGeneration += 1;
    if (state.token) {
      state.canSave = false;
      state.listLoading = true;
      void loadExclusions(code, state.loadGeneration);
    } else {
      state.canSave = true;
      state.listLoading = false;
    }
    if (isOpen()) refreshProducts();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function oauthRequest(url, body) {
    const response = await gmRequest({
      method: 'POST',
      url,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'foodpanda-meal-combo-finder',
      },
      data: JSON.stringify(body),
    });
    return { status: response.status, body: parseResponseBody(response.text) || {} };
  }

  async function startConnect() {
    if (!CONFIG.GITHUB_CLIENT_ID) {
      setSyncStatus('Add the GitHub App client id to the script before connecting.', true);
      return;
    }
    const generation = ++state.connectGeneration;
    updateSyncButton(true);
    try {
      const started = await oauthRequest('https://github.com/login/device/code', {
        client_id: CONFIG.GITHUB_CLIENT_ID,
      });
      if (generation !== state.connectGeneration) return;
      const deviceCode = started.body.device_code;
      const userCode = started.body.user_code;
      if (!deviceCode || !userCode) {
        setSyncStatus('GitHub did not start a login.', true);
        return;
      }
      const verification = started.body.verification_uri || 'https://github.com/login/device';
      setSyncStatus(`Enter ${userCode} at ${verification}`);
      const interval = Math.max(5, Number(started.body.interval) || 5);
      const deadline = Date.now() + (Number(started.body.expires_in) || 900) * 1000;
      let wait = interval;
      let token = '';
      while (Date.now() < deadline) {
        await sleep(wait * 1000);
        if (generation !== state.connectGeneration) return;
        const polled = await oauthRequest('https://github.com/login/oauth/access_token', {
          client_id: CONFIG.GITHUB_CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        });
        if (generation !== state.connectGeneration) return;
        if (polled.body.access_token) {
          token = polled.body.access_token;
          break;
        }
        if (polled.body.error === 'authorization_pending') {
          wait = interval;
          continue;
        }
        if (polled.body.error === 'slow_down') {
          wait = Number(polled.body.interval) || wait + 5;
          continue;
        }
        setSyncStatus('GitHub login was not approved.', true);
        return;
      }
      if (!token) {
        setSyncStatus('GitHub login expired. Connect again.', true);
        return;
      }
      state.token = token;
      const listed = await listAccessibleRepos();
      if (generation !== state.connectGeneration) {
        const storedToken = storageGet(CONFIG.STORAGE_TOKEN, '');
        const storedRepo = storageGet(CONFIG.STORAGE_REPO, null);
        state.token = storedToken || '';
        state.connectedRepo = storedRepo && storedRepo.owner && storedRepo.name ? storedRepo : null;
        return;
      }
      const sole = soleRepository(listed.count, listed.repos);
      if (!sole) {
        rejectBroadInstall(listed.count);
        return;
      }
      storageSet(CONFIG.STORAGE_TOKEN, token);
      storageSet(CONFIG.STORAGE_REPO, sole);
      state.connectedRepo = sole;
      state.canSave = false;
      setSyncStatus(connectedMessage());
      if (state.restaurantCode) await loadExclusions(state.restaurantCode, state.loadGeneration);
    } catch (err) {
      if (generation !== state.connectGeneration) return;
      const storedToken = storageGet(CONFIG.STORAGE_TOKEN, '');
      const storedRepo = storageGet(CONFIG.STORAGE_REPO, null);
      state.token = storedToken || '';
      state.connectedRepo = storedRepo && storedRepo.owner && storedRepo.name ? storedRepo : null;
      if (!state.token) state.canSave = true;
      setSyncStatus(err.status === 401 ? 'GitHub rejected the login.' : 'Could not reach GitHub.', true);
    } finally {
      if (generation === state.connectGeneration) updateSyncButton(false);
    }
  }

  function disconnect() {
    state.connectGeneration += 1;
    forgetCredentials();
    setSyncStatus('Not connected');
    updateSyncButton(false);
  }

  async function restoreSync() {
    const token = storageGet(CONFIG.STORAGE_TOKEN, '');
    const repo = storageGet(CONFIG.STORAGE_REPO, null);
    if (!token || !repo || !repo.owner || !repo.name) {
      setSyncStatus('Not connected');
      updateSyncButton(false);
      return;
    }
    state.token = token;
    state.connectedRepo = repo;
    state.canSave = false;
    state.listLoading = true;
    updateSyncButton(false);
    setSyncStatus(connectedMessage());
    try {
      const listed = await listAccessibleRepos();
      const sole = soleRepository(listed.count, listed.repos);
      if (!sole) {
        rejectBroadInstall(listed.count);
        return;
      }
      state.connectedRepo = sole;
      storageSet(CONFIG.STORAGE_REPO, sole);
      setSyncStatus(connectedMessage());
    } catch (err) {
      if (err.status === 401) {
        forgetCredentials();
        setSyncStatus('GitHub rejected the token. Connect again.', true);
        updateSyncButton(false);
        return;
      }
    }
    if (state.token && state.restaurantCode) {
      await loadExclusions(state.restaurantCode, state.loadGeneration);
    } else {
      state.listLoading = false;
    }
  }

  function syncToRoute() {
    if (!isRestaurantPage()) {
      unmountUi();
      return;
    }
    mountUi();
    switchRestaurant(restaurantCode(location.pathname));
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
    void restoreSync();
  }

  const api = {
    parsePrice,
    remainingNeed,
    parseShuangSongMov,
    findCombos,
    restaurantCode,
    nextStoredIds,
    visibleExclusions,
    fileWithStore,
    saveStoreFile,
    reposFromInstallations,
    soleRepository,
    createSaveSequencer,
    encodeBase64Utf8,
    decodeBase64Utf8,
    CONFIG,
  };
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
