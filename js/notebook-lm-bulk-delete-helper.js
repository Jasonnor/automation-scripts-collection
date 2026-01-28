// ==UserScript==
// @name         NotebookLM bulk-delete helper
// @namespace    http://tampermonkey.net/
// @version      2026-01-27
// @author       Jasonnor
// @description  Adds a floating button that deletes every note in the current NotebookLM view (by clicking the UI just as a human would). USE WITH CARE!
// @match        https://notebooklm.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=notebooklm.google.com
// @grant        none
// ==/UserScript==

/*  ***************************************************************
 *  NotebookLM bulk-delete helper
 *  --------------------------------------------------------------
 *  1. Floats a "Bulk Delete" button in the bottom-left.
 *  2. Uses a Material Design accessible SVG icon.
 *  3. Expands on hover; deletes all visible notes sequentially.
 *  ***************************************************************/

(function () {
  'use strict';

  const CONFIG = {
    SELECTORS: {
      KEBAB_ICON: 'project-action-button > button > mat-icon',
      DELETE_MENU_ITEM: 'button.mat-mdc-menu-item.project-button-hamburger-menu-action.delete-button',
      CONFIRM_BUTTON: 'button.mdc-button.mat-mdc-button-base.mat-mdc-tooltip-trigger.submit.mat-mdc-button.mat-primary',
    },
    TIMEOUTS: {
      ELEMENT_WAIT: 8000,
      POLL_INTERVAL: 150,
      DOM_SETTLE: 100,
    },
    UI: {
      BUTTON_ID: 'nb-lm-bulk-delete-btn',
      MSG_CONFIRM:
        'Delete ALL notes visible in this notebook?\n\nThis simply clicks the regular UI in a loop, but it cannot be undone.',
      MSG_STARTING: '[NotebookLM bulk-delete] Starting ...',
      MSG_FINISHED: (count) => `✅ Deleted ${count} note${count !== 1 ? 's' : ''}.`,
      MSG_ABORTED: (msg) => `❌ Bulk delete aborted: ${msg}`,
    },
    STYLES: {
      PRIMARY: '#B3261E', // Material 3 "Error" color
      HOVER: '#601410',
      RUNNING: '#1C1B1F',
    },
  };

  /* ---------- small utilities --------------------------------- */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * Polls for an element matching `selector` until timeout.
   * @param {string} selector - CSS selector to find.
   * @param {number} timeout - Max wait time in ms.
   * @returns {Promise<Element|null>}
   */
  async function waitForElement(selector, timeout = CONFIG.TIMEOUTS.ELEMENT_WAIT) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const el = document.querySelector(selector);
      if (el) return el;
      await sleep(CONFIG.TIMEOUTS.POLL_INTERVAL);
    }
    return null;
  }

  /* ---------- core logic -------------------------------------- */
  /**
   * Deletes a single note by interacting with the UI menu.
   * @returns {Promise<boolean>} True if deleted, false if no notes remain.
   */
  async function deleteOneNote() {
    const icon = await waitForElement(CONFIG.SELECTORS.KEBAB_ICON, 5000);
    if (!icon) return false;

    icon.click();

    const deleteBtn = await waitForElement(CONFIG.SELECTORS.DELETE_MENU_ITEM, 5000);
    if (!deleteBtn) throw new Error('Delete menu item not found');
    deleteBtn.click();

    const confirmBtn = await waitForElement(CONFIG.SELECTORS.CONFIRM_BUTTON, 5000);
    if (!confirmBtn) throw new Error('Confirmation "Yes" button not found');
    confirmBtn.click();

    await sleep(CONFIG.TIMEOUTS.DOM_SETTLE);
    return true;
  }

  async function deleteAllNotes(btn, labelSpan) {
    console.log(CONFIG.UI.MSG_STARTING);
    let counter = 0;

    // Visual feedback usually reserved for "loading" states
    const originalLabel = labelSpan.innerText;
    btn.dataset.running = 'true';
    btn.style.background = CONFIG.STYLES.RUNNING;
    btn.style.cursor = 'wait';
    btn.style.minWidth = '160px'; // Prevent collapse during text changes
    labelSpan.innerText = 'Deleting...';
    labelSpan.style.opacity = '1';
    labelSpan.style.maxWidth = '200px';

    try {
      while (await deleteOneNote()) {
        counter++;
        labelSpan.innerText = `Deleting... (${counter})`;
      }
      const finishMsg = CONFIG.UI.MSG_FINISHED(counter);
      console.log(`[NotebookLM bulk-delete] ${finishMsg}`);
      alert(finishMsg);
    } catch (err) {
      const errorMsg = CONFIG.UI.MSG_ABORTED(err.message);
      console.error('[NotebookLM bulk-delete] Aborted:', err);
      alert(errorMsg);
    } finally {
      // Restore UI
      delete btn.dataset.running;
      btn.style.background = CONFIG.STYLES.PRIMARY;
      btn.style.cursor = 'pointer';
      btn.style.minWidth = '56px';
      labelSpan.innerText = originalLabel;
      // Trigger mouseleave logic to collapse if mouse not there
      btn.dispatchEvent(new Event('mouseleave'));
    }
  }

  /* ---------- inject floating button -------------------------- */
  function createFloatingButton() {
    if (document.getElementById(CONFIG.UI.BUTTON_ID)) return;

    const btn = document.createElement('button');
    btn.id = CONFIG.UI.BUTTON_ID;

    // SVG creation via DOM API to comply with strict CSP/Trusted Types
    const createSvgIcon = () => {
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('height', '24px');
      svg.setAttribute('viewBox', '0 -960 960 960');
      svg.setAttribute('width', '24px');
      svg.setAttribute('fill', '#FFFFFF');

      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute(
        'd',
        'M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z',
      );

      svg.appendChild(path);
      return svg;
    };

    // Container Styles (Fab-like)
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '24px',
      left: '24px',
      zIndex: '999999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      overflow: 'hidden',
      height: '56px',
      minWidth: '56px',
      width: 'auto',
      borderRadius: '16px',
      padding: '0 16px',
      background: CONFIG.STYLES.PRIMARY,
      boxShadow: '0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3)', // Elevation 3
      border: 'none',
      color: '#ffffff',
      fontFamily: '"Google Sans", "Roboto", "Arial", sans-serif',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.2, 0.0, 0, 1.0)', // Standard easing
      opacity: '0.6',
      whiteSpace: 'nowrap',
      letterSpacing: '0.1px',
    });

    // Inner Elements
    const iconContainer = document.createElement('div');
    try {
      iconContainer.appendChild(createSvgIcon());
    } catch (e) {
      console.error('Failed to create SVG icon', e);
      iconContainer.innerText = '🗑️'; // Fallback
    }
    Object.assign(iconContainer.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '24px',
      height: '24px',
      marginRight: '0px',
      transition: 'margin-right 0.2s ease',
    });

    const labelSpan = document.createElement('span');
    labelSpan.innerText = 'Bulk Delete';
    Object.assign(labelSpan.style, {
      maxWidth: '0',
      opacity: '0',
      transition: 'all 0.3s cubic-bezier(0.2, 0.0, 0, 1.0)',
      overflow: 'hidden',
      display: 'inline-block',
    });

    btn.appendChild(iconContainer);
    btn.appendChild(labelSpan);

    // Hover Effects
    btn.addEventListener('mouseenter', () => {
      if (btn.dataset.running) return;
      btn.style.opacity = '1';
      btn.style.minWidth = '148px'; // Expand width
      btn.style.background = CONFIG.STYLES.HOVER;
      btn.style.boxShadow = '0 6px 10px 4px rgba(0, 0, 0, 0.15), 0 2px 3px rgba(0, 0, 0, 0.3)'; // Elevated hover

      iconContainer.style.marginRight = '12px';

      labelSpan.style.maxWidth = '100px';
      labelSpan.style.opacity = '1';
    });

    btn.addEventListener('mouseleave', () => {
      if (btn.dataset.running) return;
      btn.style.opacity = '0.6';
      btn.style.minWidth = '56px';
      btn.style.background = CONFIG.STYLES.PRIMARY;
      btn.style.boxShadow = '0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3)';

      iconContainer.style.marginRight = '0px';

      labelSpan.style.maxWidth = '0';
      labelSpan.style.opacity = '0';
    });

    btn.addEventListener('click', async () => {
      if (btn.dataset.running) return;
      if (!confirm(CONFIG.UI.MSG_CONFIRM)) return;
      await deleteAllNotes(btn, labelSpan);
    });

    document.body.appendChild(btn);
  }

  /* ---------- wait for DOM & inject button -------------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFloatingButton);
  } else {
    createFloatingButton();
  }
})();
