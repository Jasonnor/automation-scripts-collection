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
 *  1. Adds a small button in the bottom-left corner
 *  2. Default state: 🗑️ emoji
 *  3. Hover state: Expands to "🗑️ Bulk Delete"
 *  4. Functionality: Deletes all visible notes one by one
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
      PRIMARY: 'linear-gradient(135deg, #c62828 0%, #b71c1c 100%)',
      HOVER: 'linear-gradient(135deg, #d32f2f 0%, #c62828 100%)',
      RUNNING: 'linear-gradient(135deg, #424242 0%, #212121 100%)',
    },
  };

  /* ---------- small utilities --------------------------------- */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * Repeatedly searches for an element matching `selector`.
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
   * Deletes ONE note.
   * Returns true  – a note was deleted
   *         false – no kebab icon found (nothing left)
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

    // UI Update for running state
    const originalLabel = labelSpan.innerText;
    btn.dataset.running = 'true';
    btn.style.background = CONFIG.STYLES.RUNNING;
    btn.style.cursor = 'wait';
    btn.style.minWidth = '160px'; // Force expand
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
      btn.style.minWidth = '48px';
      labelSpan.innerText = originalLabel;
      // Trigger mouseleave logic to collapse if mouse not there
      btn.dispatchEvent(new Event('mouseleave'));
    }
  }

  /* ---------- inject floating button -------------------------- */
  function createFloatingButton() {
    if (document.getElementById(CONFIG.UI.BUTTON_ID)) return;

    // Create Main Button
    const btn = document.createElement('button');
    btn.id = CONFIG.UI.BUTTON_ID;

    // Inline Styles for Container
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '24px',
      left: '24px',
      zIndex: '999999', // Very high z-index
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start', // Align left so icon stays
      overflow: 'hidden',
      height: '48px',
      minWidth: '48px',
      width: 'auto',
      borderRadius: '24px',
      padding: '0 14px', // Reduced padding to keep circle tight initially
      background: CONFIG.STYLES.PRIMARY,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      border: 'none',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '16px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
      opacity: '0.5',
      whiteSpace: 'nowrap',
    });

    // Inner Elements
    const iconSpan = document.createElement('span');
    iconSpan.innerText = '🗑️';
    Object.assign(iconSpan.style, {
      fontSize: '20px',
      lineHeight: '1',
      marginRight: '0px',
      transition: 'margin-right 0.3s ease',
    });

    const labelSpan = document.createElement('span');
    labelSpan.innerText = 'Bulk Delete';
    Object.assign(labelSpan.style, {
      maxWidth: '0',
      opacity: '0',
      transition: 'all 0.3s ease',
      overflow: 'hidden',
      display: 'inline-block', // needed for transform/width
    });

    btn.appendChild(iconSpan);
    btn.appendChild(labelSpan);

    // Hover Effects
    btn.addEventListener('mouseenter', () => {
      if (btn.dataset.running) return;
      btn.style.opacity = '1';
      btn.style.minWidth = '140px';
      btn.style.background = CONFIG.STYLES.HOVER;
      btn.style.padding = '0 20px'; // Adjust padding on expand
      btn.style.transform = 'translateY(-2px)';
      btn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';

      iconSpan.style.marginRight = '8px';

      labelSpan.style.maxWidth = '100px';
      labelSpan.style.opacity = '1';
    });

    btn.addEventListener('mouseleave', () => {
      if (btn.dataset.running) return;
      btn.style.opacity = '0.5';
      btn.style.minWidth = '48px';
      btn.style.background = CONFIG.STYLES.PRIMARY;
      btn.style.padding = '0 14px';
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';

      iconSpan.style.marginRight = '0px';

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
