// ==UserScript==
// @name         Scroll by Clicking on Page Sides
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Scroll up or down by clicking on the left or right 30% of the webpage.
// @author       Jasonnor
// @match        *://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=https://scroll.io
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Function to handle click events
  function handleClick(event) {
    const screenWidth = window.innerWidth;
    const clickX = event.clientX;

    // Define the boundaries for the left and right 30% of the screen
    const leftBoundary = screenWidth * 0.3;
    const rightBoundary = screenWidth * 0.7;

    if (clickX <= leftBoundary) {
      // Clicked in the left 30% of the screen, scroll up
      window.scrollBy(0, -window.innerHeight);
    } else if (clickX >= rightBoundary) {
      // Clicked in the right 30% of the screen, scroll down
      window.scrollBy(0, window.innerHeight);
    }
  }

  // Add event listener to the document to capture all clicks
  document.addEventListener('click', handleClick);
})();
