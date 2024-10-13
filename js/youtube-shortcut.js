// ==UserScript==
// @name         YouTube Shortcut
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Press "p" to hide/display video control panel
// @author       Jasonnor
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=www.youtube.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  let isHidden = false;
  document.addEventListener(
    'keydown',
    (event) => {
      switch (event.key) {
        case 'p':
          if (isHidden) {
            console.info('Display video controlls.');
            document.querySelector('div.ytp-chrome-bottom').style.display = 'block';
            document.querySelector('div.ytp-gradient-top').style.display = 'block';
            document.querySelector('div.ytp-chrome-top').style.display = 'block';
            document.querySelector('div.ytp-gradient-bottom').style.display = 'block';
            document.querySelector('div.ytp-chrome-bottom').style.display = 'block';
            document.querySelector('div.annotation').style.display = 'block';
          } else {
            console.info('Hide video controlls.');
            document.querySelector('div.ytp-chrome-bottom').style.display = 'none';
            document.querySelector('div.ytp-gradient-top').style.display = 'none';
            document.querySelector('div.ytp-chrome-top').style.display = 'none';
            document.querySelector('div.ytp-gradient-bottom').style.display = 'none';
            document.querySelector('div.ytp-chrome-bottom').style.display = 'none';
            document.querySelector('div.annotation').style.display = 'none';
          }
          isHidden = !isHidden;
          break;
      }
    },
    false
  );
  // Disable all videos autoplay
  // setTimeout(() => {
  //   const allVideos = document.querySelectorAll('video');
  //   for (const targetVideo of allVideos) {
  //     targetVideo.pause();
  //   }
  // }, 1000);
})();
