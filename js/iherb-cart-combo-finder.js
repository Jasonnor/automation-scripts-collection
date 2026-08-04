// ==UserScript==
// @name         iHerb Cart Combo Finder
// @namespace    http://tampermonkey.net/
// @version      2026-08-04
// @author       Jasonnor
// @description  Find My List combinations with the highest totals that stay under a target amount on the iHerb cart page, with exclude UI and optional add-to-cart.
// @match        https://checkout8.iherb.com/cart*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=iherb.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*  ***************************************************************
 *  iHerb Cart Combo Finder
 *  --------------------------------------------------------------
 *  1. Floats a "Combo Finder" button in the bottom-right.
 *  2. Scrapes My List products; lets you exclude items.
 *  3. Finds top combinations with max total that does not exceed a target.
 *  4. Optional one-click add-to-cart per combination.
 *  ***************************************************************/

(function () {
  'use strict';

  const CONFIG = {
    DEFAULT_TARGET: 2667,
    DEFAULT_MAX_QTY: 2,
    RESULT_COUNT: 10,
    ADD_CLICK_DELAY_MS: 300,
    SELECTORS: {
      MY_LIST_TAB: '[data-qa-element="tab-content-myList"]',
      PRODUCT: '[data-qa-element^="wishlist-product-"]',
      NAME: '[data-qa-element="product-item-name"]',
      PRICE: '[data-qa-element="product-item-price"]',
      ADD_BTN: '[data-qa-element="btn-add-to-cart"]',
      IMAGE: 'img',
    },
    UI: {
      ROOT_ID: 'ih-combo-root',
      FAB_ID: 'ih-combo-fab',
      PANEL_ID: 'ih-combo-panel',
      OVERLAY_ID: 'ih-combo-overlay',
      LABEL: 'Combo Finder',
    },
    STYLES: {
      PRIMARY: '#0D8945',
      HOVER: '#0A6B36',
      ACCENT: '#0D8945',
    },
  };

  const state = {
    products: [],
    excluded: new Set(),
    skipped: 0,
    lastResults: [],
    adding: false,
    searching: false,
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function isCartPage() {
    return /\/cart/i.test(location.pathname);
  }

  function parsePrice(text) {
    if (!text) return null;
    const cleaned = String(text).replace(/[^\d.]/g, '');
    if (!cleaned) return null;
    const n = Math.round(Number(cleaned));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function formatMoney(n) {
    return `NT$${Number(n).toLocaleString('en-US')}`;
  }

  function extractProductId(card) {
    const keyEl = card.closest('[data-key]') || card.parentElement?.closest('[data-key]');
    const rawKey = keyEl?.getAttribute('data-key') || '';
    const keyMatch = rawKey.match(/wishlist-product-(\d+)/);
    if (keyMatch) return keyMatch[1];

    const href =
      card.querySelector('a[href*="/pr/"]')?.getAttribute('href') ||
      card.querySelector(CONFIG.SELECTORS.NAME)?.getAttribute('href') ||
      '';
    const hrefMatch = href.match(/\/(\d+)(?:\?|$)/);
    return hrefMatch ? hrefMatch[1] : null;
  }

  function scrapeProducts() {
    const tab = document.querySelector(CONFIG.SELECTORS.MY_LIST_TAB);
    if (!tab) {
      return { products: [], skipped: 0, error: 'My List tab not found on this page.' };
    }

    const cards = [...tab.querySelectorAll(CONFIG.SELECTORS.PRODUCT)];
    if (cards.length === 0) {
      return { products: [], skipped: 0, error: 'My List is empty. Add products, then Refresh.' };
    }

    const products = [];
    let skipped = 0;
    const seen = new Set();

    for (const card of cards) {
      const id = extractProductId(card);
      const nameEl = card.querySelector(CONFIG.SELECTORS.NAME);
      const name =
        nameEl?.getAttribute('title') ||
        nameEl?.getAttribute('aria-label') ||
        nameEl?.textContent?.trim() ||
        '';
      const price = parsePrice(card.querySelector(CONFIG.SELECTORS.PRICE)?.textContent);
      const image = card.querySelector(CONFIG.SELECTORS.IMAGE)?.getAttribute('src') || '';

      if (!id || !name || price == null) {
        skipped += 1;
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);

      products.push({ id, name, price, image });
    }

    if (products.length === 0) {
      return {
        products: [],
        skipped,
        error: skipped
          ? `Could not parse any products (${skipped} skipped).`
          : 'My List is empty. Add products, then Refresh.',
      };
    }

    return { products, skipped, error: null };
  }

  function findAddButton(productId) {
    const tab = document.querySelector(CONFIG.SELECTORS.MY_LIST_TAB);
    if (!tab) return null;

    const byKey = tab.querySelector(`[data-key="wishlist-product-${productId}"]`);
    if (byKey) {
      const btn = byKey.querySelector(CONFIG.SELECTORS.ADD_BTN);
      if (btn) return btn;
    }

    for (const card of tab.querySelectorAll(CONFIG.SELECTORS.PRODUCT)) {
      if (extractProductId(card) === productId) {
        return card.querySelector(CONFIG.SELECTORS.ADD_BTN);
      }
    }
    return null;
  }

  function compareCombos(a, b) {
    if (a.shortfall !== b.shortfall) return a.shortfall - b.shortfall;
    if (a.totalUnits !== b.totalUnits) return a.totalUnits - b.totalUnits;
    if (a.distinctCount !== b.distinctCount) return a.distinctCount - b.distinctCount;
    return b.total - a.total;
  }

  function comboKey(items) {
    return items
      .map((x) => `${x.id}:${x.qty}`)
      .sort()
      .join('|');
  }

  /**
   * Find top RESULT_COUNT combinations with total <= target, closest first.
   * @param {{id:string,name:string,price:number}[]} products
   * @param {number} target
   * @param {number} maxQty
   */
  function findCombos(products, target, maxQty) {
    const items = products.slice().sort((a, b) => b.price - a.price || a.id.localeCompare(b.id));
    const n = items.length;
    const suffixMax = new Array(n + 1).fill(0);
    for (let i = n - 1; i >= 0; i -= 1) {
      suffixMax[i] = suffixMax[i + 1] + items[i].price * maxQty;
    }

    const best = [];
    const seen = new Set();
    const qty = new Array(n).fill(0);

    function consider(total) {
      if (total <= 0 || total > target) return;

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
        shortfall: target - total,
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

    function dfs(index, sum) {
      if (index >= n) {
        consider(sum);
        return;
      }

      if (best.length >= CONFIG.RESULT_COUNT) {
        const maxReach = Math.min(target, sum + suffixMax[index]);
        if (target - maxReach > best[best.length - 1].shortfall) return;
      }

      // Larger qty first so strong candidates fill the top-10 early and prune harder.
      for (let q = maxQty; q >= 0; q -= 1) {
        const add = items[index].price * q;
        if (sum + add > target) continue;
        qty[index] = q;
        dfs(index + 1, sum + add);
        qty[index] = 0;
      }
    }

    dfs(0, 0);
    best.sort(compareCombos);
    return best.slice(0, CONFIG.RESULT_COUNT);
  }

  function injectStyles() {
    if (document.getElementById('ih-combo-styles')) return;
    const style = document.createElement('style');
    style.id = 'ih-combo-styles';
    style.textContent = `
      #${CONFIG.UI.ROOT_ID} {
        --ihc-primary: ${CONFIG.STYLES.PRIMARY};
        --ihc-hover: ${CONFIG.STYLES.HOVER};
        --ihc-bg: #ffffff;
        --ihc-text: #1a1a1a;
        --ihc-muted: #667085;
        --ihc-border: #e4e7ec;
        --ihc-soft: #f5f7f9;
        --ihc-danger: #b42318;
        font-family: "Segoe UI", "IBM Plex Sans", sans-serif;
        font-size: 13px;
        color: var(--ihc-text);
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
        background: var(--ihc-bg);
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
      #${CONFIG.UI.PANEL_ID} .ihc-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 16px 12px;
        border-bottom: 1px solid var(--ihc-border);
        flex-shrink: 0;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-header h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 650;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-close {
        border: none;
        background: transparent;
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
        color: var(--ihc-muted);
        padding: 4px 8px;
        border-radius: 8px;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-close:hover { background: var(--ihc-soft); color: var(--ihc-text); }
      #${CONFIG.UI.PANEL_ID} .ihc-body {
        overflow: auto;
        flex: 1;
        padding: 12px 16px 24px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-section-title {
        margin: 0 0 8px;
        font-size: 12px;
        font-weight: 650;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ihc-muted);
      }
      #${CONFIG.UI.PANEL_ID} .ihc-controls {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      #${CONFIG.UI.PANEL_ID} label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12px;
        color: var(--ihc-muted);
      }
      #${CONFIG.UI.PANEL_ID} input[type="number"] {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid var(--ihc-border);
        border-radius: 8px;
        font-size: 14px;
        color: var(--ihc-text);
      }
      #${CONFIG.UI.PANEL_ID} input[type="number"]:focus {
        outline: 2px solid rgba(13, 137, 69, 0.35);
        border-color: var(--ihc-primary);
      }
      #${CONFIG.UI.PANEL_ID} .ihc-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-btn {
        border: none;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease, opacity 0.15s ease;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-btn-primary {
        background: var(--ihc-primary);
        color: #fff;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-btn-primary:hover:not(:disabled) { background: var(--ihc-hover); }
      #${CONFIG.UI.PANEL_ID} .ihc-btn-secondary {
        background: var(--ihc-soft);
        color: var(--ihc-text);
        border: 1px solid var(--ihc-border);
      }
      #${CONFIG.UI.PANEL_ID} .ihc-btn-secondary:hover:not(:disabled) { background: #eef1f4; }
      #${CONFIG.UI.PANEL_ID} .ihc-status {
        font-size: 12px;
        color: var(--ihc-muted);
        min-height: 1.2em;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-status.error { color: var(--ihc-danger); }
      #${CONFIG.UI.PANEL_ID} .ihc-product-tools {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-product-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 240px;
        overflow: auto;
        padding-right: 2px;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-product {
        display: grid;
        grid-template-columns: 40px 1fr auto;
        gap: 8px;
        align-items: center;
        padding: 8px;
        border: 1px solid var(--ihc-border);
        border-radius: 10px;
        background: #fff;
        transition: opacity 0.15s ease, background 0.15s ease;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-product.excluded {
        opacity: 0.45;
        background: var(--ihc-soft);
      }
      #${CONFIG.UI.PANEL_ID} .ihc-product img {
        width: 40px;
        height: 40px;
        object-fit: contain;
        border-radius: 6px;
        background: var(--ihc-soft);
      }
      #${CONFIG.UI.PANEL_ID} .ihc-product-meta { min-width: 0; }
      #${CONFIG.UI.PANEL_ID} .ihc-product-name {
        font-size: 12px;
        font-weight: 560;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-product-price {
        font-size: 12px;
        color: var(--ihc-muted);
        margin-top: 2px;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-toggle {
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
      #${CONFIG.UI.PANEL_ID} .ihc-toggle::after {
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
      #${CONFIG.UI.PANEL_ID} .ihc-toggle.on { background: var(--ihc-primary); }
      #${CONFIG.UI.PANEL_ID} .ihc-toggle.on::after { transform: translateX(18px); }
      #${CONFIG.UI.PANEL_ID} .ihc-results {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-card {
        border: 1px solid var(--ihc-border);
        border-radius: 12px;
        padding: 12px;
        background: #fff;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-card-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 8px;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-rank { font-weight: 700; font-size: 13px; }
      #${CONFIG.UI.PANEL_ID} .ihc-totals { text-align: right; }
      #${CONFIG.UI.PANEL_ID} .ihc-total { font-weight: 700; font-size: 13px; }
      #${CONFIG.UI.PANEL_ID} .ihc-excess {
        font-size: 12px;
        color: var(--ihc-primary);
        font-weight: 650;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-lines {
        list-style: none;
        margin: 0 0 10px;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-lines li {
        font-size: 12px;
        color: var(--ihc-text);
        line-height: 1.35;
      }
      #${CONFIG.UI.PANEL_ID} .ihc-lines .qty {
        font-weight: 700;
        color: var(--ihc-muted);
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

  function setStatus(msg, isError = false) {
    const el = document.getElementById('ihc-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('error', Boolean(isError && msg));
  }

  function renderProducts() {
    const list = document.getElementById('ihc-product-list');
    if (!list) return;
    list.replaceChildren();

    for (const p of state.products) {
      const excluded = state.excluded.has(p.id);
      const row = document.createElement('div');
      row.className = `ihc-product${excluded ? ' excluded' : ''}`;
      row.dataset.id = p.id;

      const img = document.createElement('img');
      img.alt = '';
      img.src = p.image || '';
      img.referrerPolicy = 'no-referrer';

      const meta = document.createElement('div');
      meta.className = 'ihc-product-meta';
      const name = document.createElement('div');
      name.className = 'ihc-product-name';
      name.title = p.name;
      name.textContent = p.name;
      const price = document.createElement('div');
      price.className = 'ihc-product-price';
      price.textContent = formatMoney(p.price);
      meta.append(name, price);

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = `ihc-toggle${excluded ? '' : ' on'}`;
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
    const wrap = document.getElementById('ihc-results');
    if (!wrap) return;
    wrap.replaceChildren();
    state.lastResults = results;

    if (!results.length) {
      const empty = document.createElement('div');
      empty.className = 'ihc-status';
      empty.textContent = 'No combinations fit under the target with the current settings.';
      wrap.appendChild(empty);
      return;
    }

    results.forEach((combo, idx) => {
      const card = document.createElement('div');
      card.className = 'ihc-card';

      const head = document.createElement('div');
      head.className = 'ihc-card-head';
      const rank = document.createElement('div');
      rank.className = 'ihc-rank';
      rank.textContent = `#${idx + 1}`;
      const totals = document.createElement('div');
      totals.className = 'ihc-totals';
      const total = document.createElement('div');
      total.className = 'ihc-total';
      total.textContent = formatMoney(combo.total);
      const gap = document.createElement('div');
      gap.className = 'ihc-excess';
      gap.textContent =
        combo.shortfall === 0
          ? 'Exact match'
          : `${combo.shortfall.toLocaleString('en-US')} under target`;
      totals.append(total, gap);
      head.append(rank, totals);

      const lines = document.createElement('ul');
      lines.className = 'ihc-lines';
      for (const line of combo.items) {
        const li = document.createElement('li');
        const qty = document.createElement('span');
        qty.className = 'qty';
        qty.textContent = `×${line.qty}`;
        li.append(qty, document.createTextNode(` · ${line.name} · ${formatMoney(line.price)}`));
        lines.appendChild(li);
      }

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'ihc-btn ihc-btn-primary';
      addBtn.textContent = 'Add to cart';
      addBtn.addEventListener('click', () => addComboToCart(combo, addBtn));

      card.append(head, lines, addBtn);
      wrap.appendChild(card);
    });
  }

  function refreshProducts() {
    const { products, skipped, error } = scrapeProducts();
    const nextIds = new Set(products.map((p) => p.id));
    for (const id of [...state.excluded]) {
      if (!nextIds.has(id)) state.excluded.delete(id);
    }
    state.products = products;
    state.skipped = skipped;
    renderProducts();

    if (error) {
      setStatus(error, true);
      return;
    }

    const excludedCount = [...state.excluded].filter((id) => nextIds.has(id)).length;
    const included = products.length - excludedCount;
    const skipNote = skipped ? ` · ${skipped} skipped` : '';
    setStatus(`${products.length} products · ${included} included${skipNote}`);
  }

  function runSearch() {
    if (state.adding || state.searching) return;

    const targetInput = document.getElementById('ihc-target');
    const maxQtyInput = document.getElementById('ihc-max-qty');
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
    const included = state.products.filter((p) => !state.excluded.has(p.id));
    if (!included.length) {
      setStatus('No included products. Include at least one item.', true);
      renderResults([]);
      return;
    }

    const findBtn = document.getElementById('ihc-find');
    state.searching = true;
    if (findBtn) findBtn.disabled = true;
    setStatus('Searching…');

    requestAnimationFrame(() => {
      try {
        const results = findCombos(included, target, maxQty);
        renderResults(results);
        setStatus(
          results.length
            ? `Found ${results.length} combination${results.length === 1 ? '' : 's'} (≤ ${formatMoney(target)}).`
            : 'No combinations fit under the target with the current settings.',
          results.length === 0,
        );
      } catch (err) {
        console.error('[iHerb Combo Finder]', err);
        setStatus(`Search failed: ${err.message || err}`, true);
      } finally {
        state.searching = false;
        if (findBtn) findBtn.disabled = state.adding;
      }
    });
  }

  async function addComboToCart(combo, button) {
    if (state.adding) return;
    state.adding = true;
    const findBtn = document.getElementById('ihc-find');
    if (findBtn) findBtn.disabled = true;

    const clicks = combo.items.reduce((n, x) => n + x.qty, 0);
    let done = 0;
    let failed = 0;
    const original = button.textContent;
    button.disabled = true;

    try {
      for (const line of combo.items) {
        for (let i = 0; i < line.qty; i += 1) {
          const live = findAddButton(line.id);
          if (!live) failed += 1;
          else live.click();
          done += 1;
          button.textContent = `Adding ${done}/${clicks}…`;
          await sleep(CONFIG.ADD_CLICK_DELAY_MS);
        }
      }
      button.textContent = failed ? `Done (${failed} failed)` : 'Added';
      setStatus(
        failed
          ? `Add finished with ${failed} failed click${failed === 1 ? '' : 's'}.`
          : `Added ${clicks} item${clicks === 1 ? '' : 's'} to cart.`,
        failed > 0,
      );
      await sleep(1200);
    } catch (err) {
      console.error('[iHerb Combo Finder] add-to-cart', err);
      button.textContent = 'Failed';
      setStatus(`Add to cart failed: ${err.message || err}`, true);
      await sleep(1200);
    } finally {
      button.textContent = original;
      button.disabled = false;
      state.adding = false;
      if (findBtn) findBtn.disabled = state.searching;
    }
  }

  function buildPanel(root) {
    const overlay = document.createElement('div');
    overlay.id = CONFIG.UI.OVERLAY_ID;
    overlay.addEventListener('click', () => setOpen(false));

    const panel = document.createElement('div');
    panel.id = CONFIG.UI.PANEL_ID;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'iHerb Combo Finder');

    const header = document.createElement('div');
    header.className = 'ihc-header';
    const title = document.createElement('h2');
    title.textContent = 'Combo Finder';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ihc-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', () => setOpen(false));
    header.append(title, close);

    const body = document.createElement('div');
    body.className = 'ihc-body';

    const controlsWrap = document.createElement('div');
    const controlsTitle = document.createElement('div');
    controlsTitle.className = 'ihc-section-title';
    controlsTitle.textContent = 'Settings';
    const controls = document.createElement('div');
    controls.className = 'ihc-controls';

    const targetLabel = document.createElement('label');
    targetLabel.textContent = 'Target amount';
    const targetInput = document.createElement('input');
    targetInput.id = 'ihc-target';
    targetInput.type = 'number';
    targetInput.min = '1';
    targetInput.step = '1';
    targetInput.value = String(CONFIG.DEFAULT_TARGET);
    targetLabel.appendChild(targetInput);

    const maxLabel = document.createElement('label');
    maxLabel.textContent = 'Max qty / item';
    const maxInput = document.createElement('input');
    maxInput.id = 'ihc-max-qty';
    maxInput.type = 'number';
    maxInput.min = '1';
    maxInput.step = '1';
    maxInput.value = String(CONFIG.DEFAULT_MAX_QTY);
    maxLabel.appendChild(maxInput);

    controls.append(targetLabel, maxLabel);
    controlsWrap.append(controlsTitle, controls);

    const actions = document.createElement('div');
    actions.className = 'ihc-actions';
    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'ihc-btn ihc-btn-secondary';
    refreshBtn.textContent = 'Refresh';
    refreshBtn.addEventListener('click', () => refreshProducts());
    const findBtn = document.createElement('button');
    findBtn.type = 'button';
    findBtn.id = 'ihc-find';
    findBtn.className = 'ihc-btn ihc-btn-primary';
    findBtn.textContent = 'Find Combos';
    findBtn.addEventListener('click', () => runSearch());
    actions.append(refreshBtn, findBtn);

    const status = document.createElement('div');
    status.id = 'ihc-status';
    status.className = 'ihc-status';

    const productsWrap = document.createElement('div');
    const productsTitle = document.createElement('div');
    productsTitle.className = 'ihc-section-title';
    productsTitle.textContent = 'My List';
    const productTools = document.createElement('div');
    productTools.className = 'ihc-product-tools';
    const includeAll = document.createElement('button');
    includeAll.type = 'button';
    includeAll.className = 'ihc-btn ihc-btn-secondary';
    includeAll.textContent = 'Include all';
    includeAll.addEventListener('click', () => {
      state.excluded.clear();
      renderProducts();
      setStatus(`${state.products.length} products · ${state.products.length} included`);
    });
    const excludeAll = document.createElement('button');
    excludeAll.type = 'button';
    excludeAll.className = 'ihc-btn ihc-btn-secondary';
    excludeAll.textContent = 'Exclude all';
    excludeAll.addEventListener('click', () => {
      state.products.forEach((p) => state.excluded.add(p.id));
      renderProducts();
      setStatus(`${state.products.length} products · 0 included`);
    });
    productTools.append(includeAll, excludeAll);
    const productList = document.createElement('div');
    productList.id = 'ihc-product-list';
    productList.className = 'ihc-product-list';
    productsWrap.append(productsTitle, productTools, productList);

    const resultsWrap = document.createElement('div');
    const resultsTitle = document.createElement('div');
    resultsTitle.className = 'ihc-section-title';
    resultsTitle.textContent = 'Top combinations';
    const results = document.createElement('div');
    results.id = 'ihc-results';
    results.className = 'ihc-results';
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
    document.getElementById('ih-combo-styles')?.remove();
  }

  function syncToRoute() {
    if (isCartPage()) mountUi();
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

  window.__ihComboFinder = { findCombos, parsePrice, scrapeProducts, CONFIG };

  function init() {
    syncToRoute();
    watchSpaNavigation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
