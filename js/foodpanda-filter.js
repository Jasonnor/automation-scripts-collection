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
  const scriptBody = document.createElement('div');
  scriptBody.id = 'script-body';
  scriptBody.style.zIndex = '999999';
  scriptBody.style.position = 'fixed';
  scriptBody.style.top = '60px';
  scriptBody.style.right = 0;
  scriptBody.style.padding = '2px';
  scriptBody.style.margin = '2px';
  scriptBody.style.fontSize = '1em';
  scriptBody.style.textAlign = 'right';

  const scriptDisplay = document.createElement('div');
  scriptDisplay.id = 'script-display';
  scriptDisplay.onclick = toggleScriptMenuDisplay;
  scriptDisplay.style.cursor = 'pointer';
  scriptDisplay.style.display = 'block';
  scriptDisplay.innerText = '🐳';
  scriptBody.append(scriptDisplay);

  const scriptForm = document.createElement('div');
  scriptForm.id = 'script-form';
  scriptForm.style.display = 'none';
  scriptBody.append(scriptForm);

  const scriptInputLabel = document.createElement('label');
  scriptInputLabel.setAttribute('for', 'script-input');
  scriptInputLabel.innerText = 'Discount Keywords (separated by commas)';
  scriptForm.append(scriptInputLabel);
  const scriptInput = document.createElement('input');
  scriptInput.id = 'script-input';
  scriptInput.type = 'text';
  scriptInput.defaultValue = '';
  scriptForm.append(scriptInput);

  const scriptRatingCountInputLabel = document.createElement('label');
  scriptRatingCountInputLabel.setAttribute('for', 'script-rating-count-input');
  scriptRatingCountInputLabel.innerText = 'Minimum rating count';
  scriptForm.append(scriptRatingCountInputLabel);
  const scriptRatingCountInput = document.createElement('input');
  scriptRatingCountInput.id = 'script-rating-count-input';
  scriptRatingCountInput.type = 'text';
  scriptRatingCountInput.defaultValue = '0';
  scriptForm.append(scriptRatingCountInput);

  const scriptTypeInputLabel = document.createElement('label');
  scriptTypeInputLabel.setAttribute('for', 'script-type-input');
  scriptTypeInputLabel.innerText = 'Filtered Food Types (separated by commas)';
  scriptForm.append(scriptTypeInputLabel);
  const scriptTypeInput = document.createElement('input');
  scriptTypeInput.id = 'script-type-input';
  scriptTypeInput.type = 'text';
  scriptTypeInput.defaultValue = '飲料,甜點,咖啡';
  scriptForm.append(scriptTypeInput);

  const scriptButton = document.createElement('button');
  scriptButton.onclick = runScript;
  scriptButton.innerText = 'Run';
  scriptForm.append(scriptButton);

  const scriptStopButton = document.createElement('button');
  scriptStopButton.onclick = stopScript;
  scriptStopButton.innerText = 'Stop';
  scriptForm.append(scriptStopButton);

  const scriptSortButton = document.createElement('button');
  scriptSortButton.onclick = sortScript;
  scriptSortButton.innerText = 'Sort';
  scriptForm.append(scriptSortButton);

  document.body.append(scriptBody);

  const addCSS = (s) => (document.head.appendChild(document.createElement('style')).innerHTML = s);
  addCSS('#script-form > * { margin: 5px; display: block; }');

  function toggleScriptMenuDisplay() {
    const targetElement = document.getElementById('script-form');
    targetElement.style.display = targetElement.style.display === 'block' ? 'none' : 'block';
  }

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
          vendor.querySelector('span.bds-c-rating__label-secondary').innerHTML.replace(/[-+()\s]/g, '')
        );
        if (ratingCount < scriptRatingCountInputValue) {
          vendor.remove();
          return;
        }
        const categories = Array.apply(
          null,
          vendor.querySelectorAll('div.vendor-tile-new-info > div:nth-child(2) > div:nth-child(5) > div')
        );
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
        const rating = parseFloat(e.textContent.split('/')[0]);
        const productNode = e.parentNode.parentNode.parentNode.parentNode.parentNode;
        productNode.setAttribute('rating', rating);
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
        const rating = parseFloat(e.textContent.split('/')[0]);
        //const productNode = e.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode;
        const productNode = e.parentNode.parentNode.parentNode.parentNode.parentNode;
        productNode.setAttribute('rating', rating);
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
