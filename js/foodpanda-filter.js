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

(function() {
    'use strict';
    const scriptBody = document.createElement('div')
    scriptBody.id = 'script-body'
    scriptBody.style.zIndex = '999999'
    scriptBody.style.position = 'fixed'
    scriptBody.style.top = '60px'
    scriptBody.style.right = 0
    scriptBody.style.padding = '2px'
    scriptBody.style.margin = '2px'
    scriptBody.style.fontSize = '1em'
    scriptBody.style.textAlign = 'right'
    const scriptDisplay = document.createElement('div')
    scriptDisplay.id = 'script-display'
    scriptDisplay.onclick = toggleScriptMenuDisplay
    scriptDisplay.style.cursor = 'pointer'
    scriptDisplay.style.display = 'block'
    scriptDisplay.innerText = '🐳'
    const scriptForm = document.createElement('div')
    scriptForm.id = 'script-form'
    scriptForm.style.display = 'none'
    const scriptInputLabel = document.createElement('label')
    scriptInputLabel.setAttribute('for', 'script-input')
    scriptInputLabel.innerText = 'Discount Keywords (separated by commas)'
    const scriptInput = document.createElement('input')
    scriptInput.id = 'script-input'
    scriptInput.type = 'text'
    scriptInput.defaultValue = '折,$50,買一送一'
    const scriptButton = document.createElement('button')
    scriptButton.onclick = runScript
    scriptButton.innerText = 'Run'
    const scriptStopButton = document.createElement('button')
    scriptStopButton.onclick = stopScript
    scriptStopButton.innerText = 'Stop'
    scriptForm.append(scriptInputLabel)
    scriptForm.append(scriptInput)
    scriptForm.append(scriptButton)
    scriptForm.append(scriptStopButton)
    scriptBody.append(scriptDisplay)
    scriptBody.append(scriptForm)
    document.body.append(scriptBody)

    const addCSS = s => (document.head.appendChild(document.createElement('style')).innerHTML = s)
    addCSS('#script-form > * { margin: 5px }')

    function toggleScriptMenuDisplay() {
        const targetElement = document.getElementById('script-form')
        targetElement.style.display = targetElement.style.display === 'block' ? 'none' : 'block'
    }

    let intervalId = null

    function runScript() {
        const scriptInputValue = document.getElementById('script-input').value
        intervalId = window.setInterval(function () {
            let keepRules = scriptInputValue.split(',')
            document.querySelectorAll('.vendor-list>li').forEach(function (vendor) {
                if (vendor.querySelector('[data-testid=multi-tag__text]') === null) {
                    vendor.remove();
                    return;
                }
                const vendorTag = vendor.querySelector('[data-testid=multi-tag__text]').textContent;
                const categories = Array.apply(null, vendor.querySelectorAll('.categories.summary>li>span'));
                const notContainBeverage = categories.every(span => span.textContent !== '飲料');
                if (notContainBeverage && new RegExp(keepRules.join('|')).test(vendorTag)) {
                    return;
                }
                vendor.remove();
            })
        }, 1000);
    }

    function stopScript() {
        clearInterval(intervalId)
    }
})();
