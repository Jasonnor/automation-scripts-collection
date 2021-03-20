// ==UserScript==
// @name         our-floating-castle-equipment-sorter
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Sort equipment in items by attack + defense
// @author       Jasonnor
// @match        https://ourfloatingcastle.com/items
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    var checkExist = setInterval(function() {
        if (document.querySelector('.chakra-text')) {
            document.querySelector('h2').nextSibling.querySelectorAll('[role=row]').forEach(function(e) {
                const attack = parseInt(e.querySelector(':nth-child(3)').textContent)
                const defense = parseInt(e.querySelector(':nth-child(4)').textContent)
                let attackDefense = attack + defense
                if (isNaN(attackDefense)) {
                    attackDefense = '攻防'
                }
                if (e.querySelector(':nth-child(7)')) {
                    e.querySelector(':nth-child(7)').innerHTML = attackDefense
                } else {
                    let attackDefenseTd = document.createElement('td');
                    attackDefenseTd.innerHTML = `<td role="gridcell" data-is-numeric="true" class="css-19s5wst">${attackDefense}</td>`
                    e.appendChild(attackDefenseTd)
                }
                e.setAttribute('attackDefense', attackDefense)
            })
            let categoryItemsArray = Array.from(document.querySelectorAll('[attackDefense]'))
            let sorted = categoryItemsArray.sort(sorter)
            function sorter(a,b) {
                if(parseFloat(a.getAttribute('attackDefense')) < parseFloat(b.getAttribute('attackDefense'))) return 1
                if(parseFloat(a.getAttribute('attackDefense')) > parseFloat(b.getAttribute('attackDefense'))) return -1
                return 0
            }
            sorted.forEach(e => document.querySelector("tbody.css-0").appendChild(e))
        }
    }, 1000);
})();
