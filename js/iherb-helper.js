// ==UserScript==
// @name         iHerb Helper
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  try to take over the world!
// @author       Jasonnor
// @match        *://*.iherb.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=iherb.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const scriptBody = document.createElement('div');
    scriptBody.id = 'ih-helper';
    document.body.append(scriptBody);

    // Toggle button (the “🐳” bubble)
    const scriptDisplay = document.createElement('div');
    scriptDisplay.id = 'ih-display';
    scriptDisplay.innerText = '🐳';
    scriptDisplay.onclick = () => scriptBody.classList.toggle('active');
    scriptBody.append(scriptDisplay);

    // Hidden form panel
    const scriptForm = document.createElement('div');
    scriptForm.id = 'ih-form';
    scriptBody.append(scriptForm);

    // Action button
    const scriptButton = document.createElement('button');
    scriptButton.id = 'ih-btn';
    scriptButton.innerText = 'Copy Markdown';
    scriptButton.onclick = () => {
        scriptButton.disabled = true;
        scriptButton.innerText = 'Running…';
        runScript().finally(() => {
            scriptButton.disabled = false;
            scriptButton.innerText = 'Copy Markdown';
        });
    };
    scriptForm.append(scriptButton);

    // Injected CSS
    const css = `
    /* Container */
    #ih-helper {
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 999999;
      font-family: "Segoe UI", sans-serif;
    }

    /* Bubble trigger */
    #ih-display {
      width: 40px;
      height: 40px;
      background: #007acc;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transition: background 0.2s;
    }
    #ih-display:hover {
      background: #005fa3;
    }

    /* Hidden panel */
    #ih-form {
      display: none;
      margin-top: 8px;
      padding: 12px;
      background: #fff;
      border-radius: 6px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
      min-width: 160px;
    }

    /* Show when active */
    #ih-helper.active #ih-form {
      display: block;
    }

    /* Button inside panel */
    #ih-btn {
      width: 100%;
      padding: 8px;
      font-size: 0.9em;
      background: #28a745;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s;
    }
    #ih-btn:disabled {
      background: #94d3a2;
      cursor: not-allowed;
    }
    #ih-btn:hover:not(:disabled) {
      background: #218838;
    }
  `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);

    async function getUSDToTWDRate() {
        try {
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            const data = await response.json();
            return data.rates.TWD;
        } catch (error) {
            console.error('Error fetching exchange rate:', error);
            return 30; // Fallback exchange rate if API fails
        }
    }

    async function runScript() {
        const nameEl = document.querySelector('#name');
        const name = nameEl ? nameEl.textContent.trim() : '';
        const url = window.location.href;
        const priceText = document.querySelector('.price-per-unit')?.textContent || '';
        const priceMatch = priceText.match(/[\d.,]+/);
        const unit_price = priceMatch ? priceMatch[0] : '';
        const unitEl = document.querySelector('div > table > tbody > tr:nth-child(2) > td');
        let unit = '';
        if (unitEl) {
            const txt = unitEl.textContent.trim();
            const idx = txt.indexOf('：');
            unit = idx >= 0 ? txt.slice(idx + 1).trim() : txt;
        }

        // Get exchange rate and convert USD to TWD
        let md = '';
        if (unit_price) {
            const exchangeRate = await getUSDToTWDRate();
            const twdPrice = (parseFloat(unit_price) * exchangeRate).toFixed(2);
            md = `\n- [${name}](${url})\n    - NT$ ${twdPrice} / ${unit}`;
        } else {
            md = `\n- [${name}](${url})\n    - Price not available / ${unit}`;
        }

        // Copy to clipboard (with fallback)
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(md)
                .then(() => console.log('Copied to clipboard:\n' + md))
                .catch(err => console.error('Clipboard write failed', err));
        } else {
            const ta = document.createElement('textarea');
            ta.value = md;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            console.log('Copied to clipboard:\n' + md);
        }
    }
})();
