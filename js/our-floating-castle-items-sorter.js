// ==UserScript==
// @name         our-floating-castle-items-sorter
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Sort item in market by price per HP
// @author       Jasonnor
// @match        https://ourfloatingcastle.com/market
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    var checkExist = setInterval(function() {
        if (document.querySelector('button[aria-selected="true"]')) {
            let nowTab = document.querySelector('button[aria-selected="true"]');
            if (nowTab.innerText === '道具') {
                document.querySelectorAll('[role=row].css-1iwappo').forEach(function(e) {
                    const title = e.querySelector(':nth-child(1)').textContent
                    const count = parseInt(e.querySelector(':nth-child(2)').textContent)
                    const totalPrice = parseInt(e.querySelector(':nth-child(3)').textContent)
                    const matchedHP = e.querySelector(':nth-child(4)').textContent.match(/恢復 ([0-9]+) 點體力/)
                    let HP = 0
                    if (matchedHP !== null) {
                        HP = parseInt(matchedHP[1])
                    }
                    const pricePerItem = totalPrice / count
                    const pricePerHP = pricePerItem / HP
                    if (e.querySelector(':nth-child(5)')) {
                        e.querySelector(':nth-child(5)').innerHTML = pricePerItem.toFixed(2)
                    } else {
                        let pricePerItemTd = document.createElement('td');
                        pricePerItemTd.innerHTML = `<td role="gridcell" data-is-numeric="true" class="css-19s5wst">${pricePerItem.toFixed(2)}</td>`
                        e.appendChild(pricePerItemTd)
                    }
                    if (e.querySelector(':nth-child(6)')) {
                        e.querySelector(':nth-child(5)').innerHTML = pricePerHP.toFixed(2)
                    } else {
                        let pricePerHPTd = document.createElement('td');
                        pricePerHPTd.innerHTML = `<td role="gridcell" data-is-numeric="true" class="css-19s5wst">${pricePerHP.toFixed(2)}</td>`
                        e.appendChild(pricePerHPTd)
                    }
                    e.setAttribute('pricePerItem', pricePerItem)
                    e.setAttribute('pricePerHP', pricePerHP)
                    e.setAttribute('title', title)
                })
                let categoryItemsArray = Array.from(document.querySelectorAll('[pricePerHP]'))
                let sorted = categoryItemsArray.sort(sorter)
                function sorter(a,b) {
                    if(parseFloat(a.getAttribute('pricePerHP')) < parseFloat(b.getAttribute('pricePerHP'))) return -1
                    if(parseFloat(a.getAttribute('pricePerHP')) > parseFloat(b.getAttribute('pricePerHP'))) return 1
                    return 0
                }
                sorted.forEach(e => document.querySelector("tbody.css-0").appendChild(e))
            }
        }
    }, 1000);
})();
