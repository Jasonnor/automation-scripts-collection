// ==UserScript==
// @name         Bahamut Anime Shortcut
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Press "h" to hide/display video controls, "f" to enter/exit full screen, "c" to hide/display comment(danmu).
// @author       Jasonnor
// @match        https://ani.gamer.com.tw/animeVideo*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gamer.com.tw
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    let isHidden = false;
    document.addEventListener('keydown', (event) => {
        switch (event.key) {
            case 'h':
                if (isHidden) {
                    console.info('Display video controlls.');
                    document.querySelector('button.vjs-big-play-button').style.display = 'block';
                    document.querySelector('div.vjs-control-bar').style.display = 'flex';
                    document.querySelector('div.control-bar-mask').style.display = 'block';
                } else {
                    console.info('Hide video controlls.');
                    document.querySelector('button.vjs-big-play-button').style.display = 'none';
                    document.querySelector('div.vjs-control-bar').style.display = 'none';
                    document.querySelector('div.control-bar-mask').style.display = 'none';
                }
                isHidden = !isHidden;
                break;
            case 'f':
                console.info('Click full screen button.');
                document.querySelector('button.vjs-fullscreen-control').click();
                break;
            case 'c':
                console.info('Click comment button');
                document.getElementById('danmuToggle').click();
                break;
        }
    }, false);
})();