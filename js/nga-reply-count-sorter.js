// ==UserScript==
// @name         NGA Reply Count Sorter
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Click to sort article by reply count
// @author       Jasonnor
// @match        *://bbs.nga.cn/thread.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=https://bbs.nga.cn
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  const scriptBody = document.createElement('div');
  scriptBody.id = 'script-body';
  scriptBody.style.zIndex = '999999';
  scriptBody.style.position = 'fixed';
  scriptBody.style.top = 0;
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
  const scriptButton = document.createElement('button');
  scriptButton.onclick = runScript;
  scriptButton.innerText = 'Sort by Reply Count';
  scriptForm.append(scriptButton);
  document.body.append(scriptBody);

  const addCSS = (s) => (document.head.appendChild(document.createElement('style')).innerHTML = s);
  addCSS('#script-form > * { margin: 5px; display: block; }');

  function toggleScriptMenuDisplay() {
    const targetElement = document.getElementById('script-form');
    targetElement.style.display = targetElement.style.display === 'block' ? 'none' : 'block';
  }

  function runScript() {
    document.querySelectorAll('a.replies').forEach(function (e) {
      const count = parseInt(e.textContent);
      const productNode = e.parentNode.parentNode.parentNode;
      productNode.setAttribute('count', count);
    });
    let categoryItemsArray = Array.from(document.querySelectorAll('[count]'));
    let sorted = categoryItemsArray.sort(sorter);
    function sorter(a, b) {
      if (parseFloat(a.getAttribute('count')) < parseFloat(b.getAttribute('count'))) return 1;
      if (parseFloat(a.getAttribute('count')) > parseFloat(b.getAttribute('count'))) return -1;
      return 0;
    }
    sorted.forEach((e) => document.querySelector('#topicrows').appendChild(e));
    document.querySelectorAll('div.pagetual_pageBar').forEach((e) => e.remove());
    document.querySelectorAll('#separatorline').forEach((e) => e.remove());
    document.querySelectorAll('p.autopagerize_page_info').forEach((e) => e.remove());
    document.querySelectorAll('hr.autopagerize_page_separator').forEach((e) => e.remove());
    document.querySelectorAll('th').forEach(function (e) {
      if (e.id.includes('continuepage')) {
        e.parentNode.parentNode.remove();
      }
    });
  }
})();
