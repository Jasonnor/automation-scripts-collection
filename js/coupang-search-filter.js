// ==UserScript==
// @name         Coupang Search Filter
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Filter and sort Coupang search results by unit price, reviews, and discounts
// @author       You
// @match        *://www.tw.coupang.com/search*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tw.coupang.com
// @grant        none
// ==/UserScript==

(function () {
  "use strict";
  function init() {
    if (document.getElementById("cp-filter-container")) return;

    const addCSS = (s) => {
      const style = document.createElement("style");
      style.innerHTML = s;
      if (document.head) document.head.appendChild(style);
      else document.documentElement.appendChild(style);
    };

    addCSS(`
    #cp-filter-container {
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 999999;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    #cp-filter-toggle {
      width: 48px;
      height: 48px;
      background: #CB1400;
      color: white;
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
    #cp-filter-toggle:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    }
    #cp-filter-panel {
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
    #cp-filter-panel.show {
      display: flex;
      animation: cpFadeIn 0.3s ease;
    }
    @keyframes cpFadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .cp-filter-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      text-align: left;
    }
    .cp-filter-group label {
      font-size: 13px;
      font-weight: 600;
      color: #333;
    }
    .cp-button-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .cp-button {
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
    .cp-button-primary {
      background: #CB1400; /* Coupang red */
      color: white;
    }
    .cp-button-primary:hover {
      background: #e61700;
      transform: translateY(-1px);
    }
    .cp-button-secondary {
      background: #fff;
      color: #333;
      border: 1px solid #ddd;
    }
    .cp-button-secondary:hover {
      background: #f5f5f5;
    }
    .cp-button-active {
      background: #e6f7ff;
      border-color: #91d5ff;
      color: #096dd9;
    }
  `);

    const container = document.createElement("div");
    container.id = "cp-filter-container";
    container.innerHTML = `
    <div id="cp-filter-toggle" title="Coupang Filter">🛍️</div>
    <div id="cp-filter-panel">
      <div class="cp-button-group">
        <button id="cp-btn-discount" class="cp-button cp-button-secondary">🎟️ Only Show Discounted (折扣) items</button>
      </div>
      <div class="cp-filter-group">
        <label>Sort By</label>
        <div class="cp-button-group">
          <button id="cp-btn-sort-unit-price" class="cp-button cp-button-secondary">💲 Unit Price (Low to High)</button>
          <button id="cp-btn-sort-reviews" class="cp-button cp-button-secondary">⭐ Review Count (High to Low)</button>
        </div>
      </div>
    </div>
  `;
    if (document.body) {
      document.body.appendChild(container);
    } else {
      document.documentElement.appendChild(container);
    }

    document
      .getElementById("cp-filter-toggle")
      .addEventListener("click", () => {
        document.getElementById("cp-filter-panel").classList.toggle("show");
      });

    // State
    let onlyDiscountInterval = null;
    let isDiscountFilterActive = false;

    const btnDiscount = document.getElementById("cp-btn-discount");
    const btnSortUnitPrice = document.getElementById("cp-btn-sort-unit-price");
    const btnSortReviews = document.getElementById("cp-btn-sort-reviews");

    // Helper functions
    function getProductList() {
      return (
        document.querySelector("ul#product-list") ||
        document.querySelector('ul[class*="ProductList"]')
      );
    }

    function getProducts() {
      return Array.from(
        document.querySelectorAll('li[class*="ProductUnit_productUnit"]'),
      );
    }

    function parseUnitPrice(product) {
      const text = product.innerText;
      // Match structure like: ($14.79/10g) or ($106.67/100g)
      const match = text.match(
        /\(\s*\$?([\d,]+(?:\.\d+)?)\s*\/\s*(\d+)(g|kg|ml|l)\s*\)/i,
      );
      if (match) {
        let price = parseFloat(match[1].replace(/,/g, ""));
        let amount = parseFloat(match[2]);
        let unit = match[3].toLowerCase();

        if (unit === "kg" || unit === "l") {
          amount *= 1000;
        }

        // Normalize to per 10 unit (10g / 10ml)
        return price / (amount / 10);
      }
      return Infinity; // fallback
    }

    function parseReviewCount(product) {
      const reviewElements = Array.from(
        product.querySelectorAll('div[class*="ProductRating"]'),
      );
      let maxCount = 0;

      // Look for text like "(230)" or "(80,866)", Coupang often puts this in next to stars
      const textContext =
        reviewElements.length > 0
          ? reviewElements[0].innerText
          : product.innerText;

      // Usually formatted as (123) or (1,234)
      const regex = /\([\s\n]*([\d,]+)[\s\n]*\)/g;
      let match;
      while ((match = regex.exec(textContext)) !== null) {
        // Skip obvious price matches like ($14.79/10g) handled earlier
        const count = parseInt(match[1].replace(/,/g, ""), 10);
        if (count > maxCount) {
          maxCount = count;
        }
      }
      return maxCount;
    }

    function hasDiscount(product) {
      return product.innerText.includes("折扣");
    }

    // Event Listeners
    btnDiscount.addEventListener("click", () => {
      isDiscountFilterActive = !isDiscountFilterActive;

      if (isDiscountFilterActive) {
        btnDiscount.classList.add("cp-button-active");
        btnDiscount.innerText = "🎟️ Stop filtering discounted items";

        // Initial sweep
        filterDiscounts();
        // Keep sweeping for infinite scroll / pagination
        onlyDiscountInterval = setInterval(filterDiscounts, 1000);
      } else {
        btnDiscount.classList.remove("cp-button-active");
        btnDiscount.innerText = "🎟️ Only Show Discounted (折扣) items";
        clearInterval(onlyDiscountInterval);

        // We cannot easily un-remove nodes unless we hid them.
        // It's better to hide them instead of removing them.
        getProducts().forEach((p) => {
          p.style.display = "";
        });
      }
    });

    function filterDiscounts() {
      getProducts().forEach((product) => {
        if (!hasDiscount(product)) {
          product.style.display = "none";
        } else {
          product.style.display = "";
        }
      });
    }

    btnSortUnitPrice.addEventListener("click", () => {
      const list = getProductList();
      if (!list) return;

      const products = getProducts();
      products.forEach((p) => {
        p.setAttribute("data-cp-unit-price", parseUnitPrice(p));
      });

      products.sort((a, b) => {
        const pA = parseFloat(a.getAttribute("data-cp-unit-price"));
        const pB = parseFloat(b.getAttribute("data-cp-unit-price"));
        return pA - pB; // Low to High
      });

      products.forEach((p) => list.appendChild(p));
    });

    btnSortReviews.addEventListener("click", () => {
      const list = getProductList();
      if (!list) return;

      const products = getProducts();
      products.forEach((p) => {
        p.setAttribute("data-cp-review-count", parseReviewCount(p));
      });

      products.sort((a, b) => {
        const cA = parseInt(a.getAttribute("data-cp-review-count"));
        const cB = parseInt(b.getAttribute("data-cp-review-count"));
        return cB - cA; // High to Low
      });

      products.forEach((p) => list.appendChild(p));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
