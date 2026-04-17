// ==UserScript==
// @name         Bahamut Anime Shortcut
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Press "p" to hide/display video controls, "f" to enter/exit full screen, "c" to hide/display comment(danmu).
// @author       Jasonnor
// @match        https://ani.gamer.com.tw/animeVideo*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gamer.com.tw
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  let isHidden = false;

  const setDisplay = (sel, value) => {
    const el = document.querySelector(sel);
    if (el) el.style.display = value;
  };

  document.addEventListener(
    'keydown',
    (event) => {
      // Ignore when typing in inputs/textareas/contentEditable
      const t = event.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      const key = (event.key || '').toLowerCase(); // make it case-insensitive

      switch (key) {
        case 'p':
          if (isHidden) {
            console.info('Display video controls.');
            setDisplay('button.vjs-big-play-button', 'block');
            setDisplay('div.vjs-control-bar', 'flex');
            setDisplay('div.control-bar-mask', 'block');
            setDisplay('div.share-button', 'block');
          } else {
            console.info('Hide video controls.');
            setDisplay('button.vjs-big-play-button', 'none');
            setDisplay('div.vjs-control-bar', 'none');
            setDisplay('div.control-bar-mask', 'none');
            setDisplay('div.share-button', 'none');
          }
          isHidden = !isHidden;
          break;

        case 'f':
          console.info('Click full screen button.');
          document.querySelector('button.vjs-fullscreen-control')?.click();
          break;

        case 'c':
          console.info('Click comment button');
          document.getElementById('danmuToggle')?.click();
          break;
      }
    },
    false
  );
})();
