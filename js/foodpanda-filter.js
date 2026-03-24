// ==UserScript==
// @name         Foodpanda Filter
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
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
    </div>
  `;
  document.body.appendChild(container);

  document.getElementById('fp-filter-toggle').addEventListener('click', () => {
    document.getElementById('fp-filter-panel').classList.toggle('show');
  });

  document.getElementById('fp-btn-run').addEventListener('click', runScript);
  document.getElementById('fp-btn-stop').addEventListener('click', stopScript);
  document.getElementById('fp-btn-sort').addEventListener('click', sortScript);

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
        // Skip discount filter if input is empty
        // if (scriptInputValue === '') {
        //   return;
        // }
        // if (vendor.querySelector('[data-testid=multi-tag__text]') === null) {
        //   vendor.remove();
        //   return;
        // }
        // const vendorTag = vendor.querySelector('[data-testid=multi-tag__text]').textContent;
        // if (!new RegExp(keepRules.join('|')).test(vendorTag)) {
        //   vendor.remove();
        //   return;
        // }
      });
    }, 1000);
  }

  function stopScript() {
    clearInterval(intervalId);
  }

  function sortScript() {
    let ulList = document.querySelector('ul.vendor-list-revamp');
    if (ulList !== null) {
      document.querySelectorAll('span.bds-c-rating__label-primary').forEach(function (e) {
        const ratingText = e.textContent.split('/')[0];
        const rating = parseFloat(ratingText);
        const productNode = e.closest('li');
        if (productNode) {
          productNode.setAttribute('rating', rating || 0);
        }
      });
      let categoryItemsArray = Array.from(document.querySelectorAll('[rating]'));
      let sorted = categoryItemsArray.sort(sorter);
      function sorter(a, b) {
        if (parseFloat(a.getAttribute('rating')) < parseFloat(b.getAttribute('rating'))) return 1;
        if (parseFloat(a.getAttribute('rating')) > parseFloat(b.getAttribute('rating'))) return -1;
        return 0;
      }
      sorted.forEach((e) => ulList.appendChild(e));
    } else {
      ulList = document.querySelector('ul.vendor-list');
      document.querySelectorAll('span.bds-c-rating__label-primary').forEach(function (e) {
        const ratingText = e.textContent.split('/')[0];
        const rating = parseFloat(ratingText);
        const productNode = e.closest('li');
        if (productNode) {
          productNode.setAttribute('rating', rating || 0);
        }
      });
      let categoryItemsArray = Array.from(document.querySelectorAll('[rating]'));
      let sorted = categoryItemsArray.sort(sorter);
      function sorter(a, b) {
        if (parseFloat(a.getAttribute('rating')) < parseFloat(b.getAttribute('rating'))) return 1;
        if (parseFloat(a.getAttribute('rating')) > parseFloat(b.getAttribute('rating'))) return -1;
        return 0;
      }
      sorted.forEach((e) => ulList.appendChild(e));
    }
  }
})();
