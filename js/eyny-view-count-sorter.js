// ==UserScript==
// @name         Eyny View Count Sorter
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        *://*.eyny.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=eyny.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    const scriptBody = document.createElement('div')
    scriptBody.id = 'script-body'
    scriptBody.style.zIndex = '999999'
    scriptBody.style.position = 'fixed'
    scriptBody.style.top = 0
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
    const scriptButton = document.createElement('button')
    scriptButton.onclick = runScript
    scriptButton.innerText = 'Sort'
    scriptForm.append(scriptButton)
    scriptBody.append(scriptDisplay)
    scriptBody.append(scriptForm)
    document.body.append(scriptBody)

    function toggleScriptMenuDisplay() {
        const targetElement = document.getElementById('script-form')
        targetElement.style.display = targetElement.style.display === 'block' ? 'none' : 'block'
    }

    function runScript() {
        document.querySelectorAll('td.num>em').forEach(function(e) {
            const viewCount = parseInt(e.textContent)
            const productNode = e.parentNode.parentNode.parentNode
            productNode.setAttribute('viewCount', viewCount)
        })
        let categoryItemsArray = Array.from(document.querySelectorAll('[viewcount]'))
        let sorted = categoryItemsArray.sort(sorter)
        function sorter(a,b) {
            if(parseFloat(a.getAttribute('viewcount')) < parseFloat(b.getAttribute('viewcount'))) return 1
            if(parseFloat(a.getAttribute('viewcount')) > parseFloat(b.getAttribute('viewcount'))) return -1
            return 0
        }
        sorted.forEach(e => document.querySelector('#moderate>table').appendChild(e))
        document.querySelectorAll('#separatorline').forEach(e => e.remove())
        document.querySelectorAll('p.autopagerize_page_info').forEach(e => e.remove())
        document.querySelectorAll('hr.autopagerize_page_separator').forEach(e => e.remove())
    }
})();
