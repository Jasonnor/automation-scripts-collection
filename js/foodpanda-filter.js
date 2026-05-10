// ==UserScript==
// @name         Foodpanda Filter
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Filter vendors by rating and keywords, display unit price for products, and sort by unit price.
// @author       Jasonnor
// @match        *://www.foodpanda.com.tw/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=foodpanda.com.tw
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  const addCSS = (s) => (document.head.appendChild(document.createElement('style')).innerHTML = s);

  addCSS(`
    #fp-filter-container {
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 999999;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    #fp-filter-toggle {
      width: 48px;
      height: 48px;
      background: white;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      user-select: none;
      margin-left: auto;
    }
    #fp-filter-toggle:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    }
    #fp-filter-panel {
      margin-top: 12px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      width: 320px;
      display: none;
      flex-direction: column;
      gap: 16px;
    }
    #fp-filter-panel.show {
      display: flex;
      animation: fpFadeIn 0.3s ease;
    }
    @keyframes fpFadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .fp-filter-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      text-align: left;
    }
    .fp-filter-group label {
      font-size: 13px;
      font-weight: 600;
      color: #333;
    }
    .fp-filter-group input {
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      background: #fafafa;
      box-sizing: border-box;
      width: 100%;
    }
    .fp-filter-group input:focus {
      border-color: #d70f64;
      box-shadow: 0 0 0 3px rgba(215, 15, 100, 0.1);
      background: white;
    }
    .fp-button-group {
      display: flex;
      gap: 10px;
      margin-top: 8px;
    }
    .fp-button {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .fp-button-primary {
      background: #d70f64;
      color: white;
    }
    .fp-button-primary:hover {
      background: #e21b70;
      transform: translateY(-1px);
    }
    .fp-button-danger {
      background: #fff;
      color: #e02b27;
      border: 1px solid #ffcccc;
    }
    .fp-button-danger:hover {
      background: #fff5f5;
      border-color: #e02b27;
    }
    .fp-button-secondary {
      background: #fff;
      color: #333;
      border: 1px solid #ddd;
    }
    .fp-button-secondary:hover {
      background: #f5f5f5;
    }
    .fp-unit-price {
      font-size: 12px;
      color: #d70f64;
      font-weight: bold;
      margin-top: 4px;
      display: block;
    }
  `);

  const container = document.createElement('div');
  container.id = 'fp-filter-container';
  container.innerHTML = `
    <div id="fp-filter-toggle" title="Foodpanda Filter">🐳</div>
    <div id="fp-filter-panel">
      <div class="fp-filter-group">
        <label for="script-input">Discount Keywords (separated by commas)</label>
        <input id="script-input" type="text" value="" placeholder="e.g. 滿百折五十, 免運" />
      </div>
      <div class="fp-filter-group">
        <label for="script-rating-count-input">Minimum rating count</label>
        <input id="script-rating-count-input" type="number" value="0" />
      </div>
      <div class="fp-filter-group">
        <label for="script-type-input">Filtered Food Types (separated by commas)</label>
        <input id="script-type-input" type="text" value="飲料,甜點,咖啡" placeholder="e.g. 飲料,甜點,咖啡" />
      </div>
      <div class="fp-button-group">
        <button id="fp-btn-run" class="fp-button fp-button-primary">▶ Run</button>
        <button id="fp-btn-stop" class="fp-button fp-button-danger">⏹ Stop</button>
      </div>
      <div class="fp-button-group">
        <button id="fp-btn-sort" class="fp-button fp-button-secondary">⇅ Sort by Rating</button>
      </div>
      <div class="fp-button-group">
        <button id="fp-btn-unit-price" class="fp-button fp-button-secondary">💰 Unit Price</button>
        <button id="fp-btn-sort-unit-price" class="fp-button fp-button-secondary">⇅ Sort Unit Price</button>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  document.getElementById('fp-filter-toggle').addEventListener('click', () => {
    document.getElementById('fp-filter-panel').classList.toggle('show');
  });

  document.getElementById('fp-btn-run').addEventListener('click', runScript);
  document.getElementById('fp-btn-stop').addEventListener('click', stopScript);
  document.getElementById('fp-btn-sort').addEventListener('click', sortScript);
  document.getElementById('fp-btn-unit-price').addEventListener('click', displayUnitPrice);
  document.getElementById('fp-btn-sort-unit-price').addEventListener('click', sortByUnitPrice);

  let intervalId = null;

  function runScript() {
    const scriptInputValue = document.getElementById('script-input').value;
    const scriptTypeInputValue = document.getElementById('script-type-input').value;
    const scriptRatingCountInputValue = parseInt(document.getElementById('script-rating-count-input').value);
    const keepRules = scriptInputValue.split(',');
    const filteredFoodTypes = scriptTypeInputValue.split(',');
    intervalId = window.setInterval(function () {
      document.querySelectorAll('.vendor-list-revamp>li').forEach(function (vendor) {
        if (vendor.querySelector('span.bds-c-rating__label-secondary') === null) {
          vendor.remove();
          return;
        }
        const ratingCount = parseInt(
          vendor.querySelector('span.bds-c-rating__label-secondary').innerHTML.replace(/[-+()\s]/g, ''),
        );
        if (ratingCount < scriptRatingCountInputValue) {
          vendor.remove();
          return;
        }
        const categories = Array.from(vendor.querySelectorAll('.sanitized-row-text, .vendor-info-row-text'));
        const containFilteredFoodTypes = categories.some((span) => filteredFoodTypes.includes(span.textContent));
        if (containFilteredFoodTypes) {
          vendor.remove();
          return;
        }
        // Skip discount filter if needed
        /*
        if (scriptInputValue === '') return;
        if (vendor.querySelector('[data-testid=multi-tag__text]') === null) {
          vendor.remove();
          return;
        }
        const vendorTag = vendor.querySelector('[data-testid=multi-tag__text]').textContent;
        if (!new RegExp(keepRules.join('|')).test(vendorTag)) {
          vendor.remove();
          return;
        }
        */
      });
    }, 1000);
  }

  function stopScript() {
    clearInterval(intervalId);
  }

  function sortScript() {
    const ulList = document.querySelector('ul.vendor-list-revamp') || document.querySelector('ul.vendor-list');
    if (!ulList) return;

    // Assign ratings to items within this list
    ulList.querySelectorAll('li').forEach((li) => {
      const ratingLabel = li.querySelector('span.bds-c-rating__label-primary');
      if (ratingLabel) {
        const ratingText = ratingLabel.textContent.split('/')[0];
        li.setAttribute('rating', parseFloat(ratingText) || 0);
      }
    });

    // De-duplicate items by store link
    const itemsArray = Array.from(ulList.children).filter((el) => el.hasAttribute('rating'));
    const seenHrefs = new Set();
    const uniqueItems = [];

    itemsArray.forEach((item) => {
      const link = item.querySelector('a')?.getAttribute('href');
      if (link) {
        if (seenHrefs.has(link)) {
          item.remove(); // Remove duplicate from DOM
        } else {
          seenHrefs.add(link);
          uniqueItems.push(item);
        }
      } else {
        uniqueItems.push(item);
      }
    });

    // Sort by rating descending
    uniqueItems.sort((a, b) => {
      const rA = parseFloat(a.getAttribute('rating')) || 0;
      const rB = parseFloat(b.getAttribute('rating')) || 0;
      return rB - rA;
    });

    // Re-append sorted items
    uniqueItems.forEach((e) => ulList.appendChild(e));
  }

  function parseUnit(name) {
    const multRegex = /(\d+)\s*(?:入|pcs?|個|支)?\s*[x*]\s*(\d+(?:\.\d+)?)\s*(g|克|kg|公斤|ml|毫升|l|升|L)/i;
    const multMatch = name.match(multRegex);

    let val, unit;

    if (multMatch) {
      val = parseFloat(multMatch[1]) * parseFloat(multMatch[2]);
      unit = multMatch[3].toLowerCase();
    } else {
      const unitRegex = /(\d+(?:\.\d+)?)\s*(g|克|kg|公斤|ml|毫升|l|升|L|入|pc|pcs|片|袋|包|支|個|個裝)/i;
      const match = name.match(unitRegex);
      if (!match) return null;
      val = parseFloat(match[1]);
      unit = match[2].toLowerCase();
    }

    // Normalize to base units
    if (['kg', '公斤', 'l', '升', 'l'].includes(unit)) {
      val *= 1000;
      unit = (unit === 'l' || unit === '升' || unit === 'l') ? 'ml' : 'g';
    } else if (['g', '克'].includes(unit)) {
      unit = 'g';
    } else if (['ml', '毫升'].includes(unit)) {
      unit = 'ml';
    } else {
      unit = 'unit';
    }
    return { val, unit };
  }

  function displayUnitPrice() {
    const selectors = [
      '[data-testid="product-card"]',
      '[data-testid="inventory-item"]',
      '.product-card-container',
      'li[data-product-id]',
      'article[data-testid="inventory-item"]',
      '.groceries-product-card',
      '[data-testid*="groceries-product-card-"]',
    ];

    const products = document.querySelectorAll(selectors.join(','));
    products.forEach((p) => {
      const nameNode = p.querySelector(
        '[data-testid*="product-card-name"], .product-card-name, h3, .name'
      );
      const priceNode = p.querySelector(
        '[data-testid*="product-card-price"], .product-card-price, .price'
      );

      if (!nameNode || !priceNode) return;

      const name = nameNode.textContent;
      const price = parseFloat(priceNode.textContent.replace(/[^\d.]/g, ''));

      const unitData = parseUnit(name);
      if (unitData && price) {
        const unitPrice = price / unitData.val;
        p.setAttribute('data-unit-price', unitPrice);

        const oldLabel = p.querySelector('.fp-unit-price');
        if (oldLabel) oldLabel.remove();

        const label = document.createElement('div');
        label.className = 'fp-unit-price';
        label.textContent = `💰 NT$ ${unitPrice.toFixed(2)} / ${unitData.unit}`;
        nameNode.after(label);
      }
    });
  }

  function sortByUnitPrice() {
    displayUnitPrice();

    const productsWithPrice = Array.from(document.querySelectorAll('[data-unit-price]'));
    if (productsWithPrice.length === 0) {
      alert('No unit prices found to sort by. Make sure units (g, ml, etc.) are in product names.');
      return;
    }

    // Ensure unique elements
    const itemsToSort = Array.from(new Set(productsWithPrice.map((p) => p.closest('li') || p)));
    const container = itemsToSort[0].parentElement;

    // De-duplicate products by name
    const seenKeys = new Set();
    const uniqueItems = [];
    itemsToSort.forEach((item) => {
      const name =
        item.querySelector('[data-testid*="product-card-name"], .product-card-name, h3, .name')?.textContent || '';
      const unitPrice =
        item.getAttribute('data-unit-price') || item.querySelector('[data-unit-price]')?.getAttribute('data-unit-price');
      const key = `${name}-${unitPrice}`;

      if (seenKeys.has(key)) {
        item.remove();
      } else {
        seenKeys.add(key);
        uniqueItems.push(item);
      }
    });

    const sorted = uniqueItems.sort((a, b) => {
      const getVal = (el) => {
        const unitPriceEl = el.hasAttribute('data-unit-price') ? el : el.querySelector('[data-unit-price]');
        return parseFloat(unitPriceEl?.getAttribute('data-unit-price') || 999999);
      };
      return getVal(a) - getVal(b);
    });

    sorted.forEach((item) => container.appendChild(item));
  }
})();
