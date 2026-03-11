// ==UserScript==
// @name         Bilibili Video Filter & Sorter
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Filter and sort Bilibili videos by danmu count and view count
// @author       Jasonnor
// @match        https://space.bilibili.com/*
// @match        https://search.bilibili.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bilibili.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const scriptBody = document.createElement('div');
  scriptBody.id = 'bili-filter-helper';
  document.body.append(scriptBody);

  // Toggle button
  const scriptDisplay = document.createElement('div');
  scriptDisplay.id = 'bili-display';
  scriptDisplay.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`;
  scriptDisplay.onclick = () => scriptBody.classList.toggle('active');
  scriptBody.append(scriptDisplay);

  // Hidden form panel
  const scriptForm = document.createElement('div');
  scriptForm.id = 'bili-form';
  scriptBody.append(scriptForm);

  // Title
  const title = document.createElement('div');
  title.className = 'bili-title';
  title.innerText = 'Video Filter & Sort';
  scriptForm.append(title);

  // Filter section
  const filterSection = document.createElement('div');
  filterSection.className = 'bili-section';
  scriptForm.append(filterSection);

  const filterTitle = document.createElement('div');
  filterTitle.className = 'bili-section-title';
  filterTitle.innerText = 'Filter';
  filterSection.append(filterTitle);

  // Filter by danmu count
  const danmuFilterContainer = document.createElement('div');
  danmuFilterContainer.className = 'bili-control-group';
  filterSection.append(danmuFilterContainer);

  const danmuFilterLabel = document.createElement('label');
  danmuFilterLabel.innerText = 'Min Danmu Count:';
  danmuFilterContainer.append(danmuFilterLabel);

  const danmuFilterInput = document.createElement('input');
  danmuFilterInput.type = 'number';
  danmuFilterInput.id = 'danmu-filter-input';
  danmuFilterInput.min = '0';
  danmuFilterInput.max = '10000';
  danmuFilterInput.value = '300';
  danmuFilterInput.placeholder = '0-10,000';
  danmuFilterContainer.append(danmuFilterInput);

  const danmuFilterBtn = document.createElement('button');
  danmuFilterBtn.className = 'bili-btn bili-btn-filter';
  danmuFilterBtn.innerText = 'Filter';
  danmuFilterBtn.onclick = () => filterByDanmu(parseInt(danmuFilterInput.value) || 0);
  danmuFilterContainer.append(danmuFilterBtn);

  // Filter by view count
  const viewFilterContainer = document.createElement('div');
  viewFilterContainer.className = 'bili-control-group';
  filterSection.append(viewFilterContainer);

  const viewFilterLabel = document.createElement('label');
  viewFilterLabel.innerText = 'Min View Count:';
  viewFilterContainer.append(viewFilterLabel);

  const viewFilterInput = document.createElement('input');
  viewFilterInput.type = 'number';
  viewFilterInput.id = 'view-filter-input';
  viewFilterInput.min = '0';
  viewFilterInput.max = '10000000';
  viewFilterInput.value = '50000';
  viewFilterInput.placeholder = '0-10,000,000';
  viewFilterContainer.append(viewFilterInput);

  const viewFilterBtn = document.createElement('button');
  viewFilterBtn.className = 'bili-btn bili-btn-filter';
  viewFilterBtn.innerText = 'Filter';
  viewFilterBtn.onclick = () => filterByView(parseInt(viewFilterInput.value) || 0);
  viewFilterContainer.append(viewFilterBtn);

  // Sort section
  const sortSection = document.createElement('div');
  sortSection.className = 'bili-section';
  scriptForm.append(sortSection);

  const sortTitle = document.createElement('div');
  sortTitle.className = 'bili-section-title';
  sortTitle.innerText = 'Sort';
  sortSection.append(sortTitle);

  // Sort buttons
  const sortBtnContainer = document.createElement('div');
  sortBtnContainer.className = 'bili-btn-group';
  sortSection.append(sortBtnContainer);

  const sortByDanmuBtn = document.createElement('button');
  sortByDanmuBtn.className = 'bili-btn bili-btn-sort';
  sortByDanmuBtn.innerText = 'By Danmu ↓';
  sortByDanmuBtn.onclick = () => sortVideos('danmu');
  sortBtnContainer.append(sortByDanmuBtn);

  const sortByViewBtn = document.createElement('button');
  sortByViewBtn.className = 'bili-btn bili-btn-sort';
  sortByViewBtn.innerText = 'By View ↓';
  sortByViewBtn.onclick = () => sortVideos('view');
  sortBtnContainer.append(sortByViewBtn);

  // Reset button
  const resetBtn = document.createElement('button');
  resetBtn.className = 'bili-btn bili-btn-reset';
  resetBtn.innerText = 'Reset';
  resetBtn.onclick = resetFilters;
  scriptForm.append(resetBtn);

  // Status text
  const statusText = document.createElement('div');
  statusText.id = 'bili-status';
  scriptForm.append(statusText);

  // Injected CSS
  const css = `
    /* Container */
    #bili-filter-helper {
      position: fixed;
      top: 80px;
      right: 16px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    /* Bubble trigger */
    #bili-display {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #00A1D6 0%, #00B5E5 100%);
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0, 161, 214, 0.4), 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-size: 26px;
      user-select: none;
      position: relative;
    }
    #bili-display::before {
      content: '';
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      padding: 2px;
      background: linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0));
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    #bili-display:hover {
      background: linear-gradient(135deg, #0086B3 0%, #00A1D6 100%);
      box-shadow: 0 6px 20px rgba(0, 161, 214, 0.5), 0 3px 10px rgba(0, 0, 0, 0.15);
      transform: translateY(-3px) scale(1.05);
    }
    #bili-display:hover::before {
      opacity: 1;
    }
    #bili-display:active {
      transform: translateY(-1px) scale(1.02);
      box-shadow: 0 3px 12px rgba(0, 161, 214, 0.4);
    }
    #bili-filter-helper.active #bili-display {
      background: linear-gradient(135deg, #0086B3 0%, #00A1D6 100%);
      box-shadow: 0 2px 8px rgba(0, 161, 214, 0.3);
    }

    /* Hidden panel */
    #bili-form {
      display: none;
      margin-top: 12px;
      padding: 16px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      min-width: 320px;
      max-width: 380px;
    }

    /* Show when active */
    #bili-filter-helper.active #bili-form {
      display: block;
      animation: slideIn 0.2s ease;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Title */
    .bili-title {
      font-size: 16px;
      font-weight: 600;
      color: #212121;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #00A1D6;
    }

    /* Section */
    .bili-section {
      margin-bottom: 16px;
    }

    .bili-section-title {
      font-size: 14px;
      font-weight: 600;
      color: #505050;
      margin-bottom: 10px;
    }

    /* Control group */
    .bili-control-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }

    .bili-control-group label {
      font-size: 13px;
      color: #606060;
      font-weight: 500;
    }

    .bili-control-group input {
      padding: 8px 12px;
      font-size: 14px;
      border: 1.5px solid #e0e0e0;
      border-radius: 6px;
      outline: none;
      transition: border-color 0.2s;
      font-family: inherit;
    }

    .bili-control-group input:focus {
      border-color: #00A1D6;
    }

    /* Buttons */
    .bili-btn {
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 500;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
    }

    .bili-btn-filter {
      background: #00A1D6;
      color: #fff;
      margin-top: 4px;
    }

    .bili-btn-filter:hover {
      background: #0086B3;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 161, 214, 0.3);
    }

    .bili-btn-filter:active {
      transform: translateY(0);
    }

    .bili-btn-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .bili-btn-sort {
      background: #f0f0f0;
      color: #505050;
    }

    .bili-btn-sort:hover {
      background: #e0e0e0;
      transform: translateY(-1px);
    }

    .bili-btn-sort:active {
      transform: translateY(0);
    }

    .bili-btn-reset {
      background: #ff6b6b;
      color: #fff;
      width: 100%;
      margin-top: 8px;
    }

    .bili-btn-reset:hover {
      background: #ee5a52;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
    }

    .bili-btn-reset:active {
      transform: translateY(0);
    }

    .bili-btn:disabled {
      background: #d0d0d0;
      cursor: not-allowed;
      transform: none;
    }

    /* Status text */
    #bili-status {
      margin-top: 12px;
      padding: 8px 12px;
      font-size: 12px;
      color: #606060;
      background: #f5f5f5;
      border-radius: 6px;
      text-align: center;
      min-height: 16px;
    }

    /* Hidden video card */
    .upload-video-card.bili-hidden,
    .list-video-item.bili-hidden,
    .video-list > div.bili-hidden {
      display: none !important;
    }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);

  // Helper function to parse Chinese number format (e.g., "8.6万" -> 86000)
  function parseChineseNumber(text) {
    if (!text) return 0;
    text = text.trim();

    const wanMatch = text.match(/([\d.]+)万/);
    if (wanMatch) {
      return parseFloat(wanMatch[1]) * 10000;
    }

    return parseFloat(text.replace(/,/g, '')) || 0;
  }

  // Get all video cards (the outer wrapper)
  function getVideoCards() {
    let cards = Array.from(document.querySelectorAll('.upload-video-card'));
    if (cards.length > 0) return cards;
    cards = Array.from(document.querySelectorAll('.list-video-item'));
    if (cards.length > 0) return cards;
    return Array.from(document.querySelectorAll('.video-list > div'));
  }

  // Extract danmu count from a video card
  function getDanmuCount(card) {
    const danmuEl = card.querySelector('.bili-cover-card__stat .sic-BDC-danmu_square_line');
    if (danmuEl) {
      const spanEl = danmuEl.nextElementSibling;
      return spanEl ? parseChineseNumber(spanEl.textContent) : 0;
    }
    const items = card.querySelectorAll('.bili-video-card__stats--item');
    if (items.length >= 2) {
      return parseChineseNumber(items[1].textContent);
    }
    return 0;
  }

  // Extract view count from a video card
  function getViewCount(card) {
    const viewEl = card.querySelector('.bili-cover-card__stat .sic-BDC-playdata_square_line');
    if (viewEl) {
      const spanEl = viewEl.nextElementSibling;
      return spanEl ? parseChineseNumber(spanEl.textContent) : 0;
    }
    const items = card.querySelectorAll('.bili-video-card__stats--item');
    if (items.length >= 1) {
      return parseChineseNumber(items[0].textContent);
    }
    return 0;
  }

  // Filter by danmu count
  function filterByDanmu(minCount) {
    const cards = getVideoCards();
    let hiddenCount = 0;

    cards.forEach(card => {
      const danmuCount = getDanmuCount(card);
      if (danmuCount < minCount) {
        card.classList.add('bili-hidden');
        hiddenCount++;
      } else {
        card.classList.remove('bili-hidden');
      }
    });

    updateStatus(`Filtered: ${hiddenCount} videos hidden (min danmu: ${minCount})`);
  }

  // Filter by view count
  function filterByView(minCount) {
    const cards = getVideoCards();
    let hiddenCount = 0;

    cards.forEach(card => {
      const viewCount = getViewCount(card);
      if (viewCount < minCount) {
        card.classList.add('bili-hidden');
        hiddenCount++;
      } else {
        card.classList.remove('bili-hidden');
      }
    });

    updateStatus(`Filtered: ${hiddenCount} videos hidden (min views: ${minCount.toLocaleString()})`);
  }

  // Sort videos
  function sortVideos(type) {
    const cards = getVideoCards();
    if (cards.length === 0) {
      updateStatus('No videos found');
      return;
    }

    // Create array of cards with their data
    const cardData = cards.map(card => {
      return {
        element: card,
        danmuCount: getDanmuCount(card),
        viewCount: getViewCount(card),
      };
    });

    // Sort based on type
    cardData.sort((a, b) => {
      if (type === 'danmu') {
        return b.danmuCount - a.danmuCount;
      } else {
        return b.viewCount - a.viewCount;
      }
    });

    // Get container and reorder
    const container = cards[0]?.parentElement;
    if (container) {
      cardData.forEach(item => {
        container.appendChild(item.element);
      });
      updateStatus(`Sorted by ${type === 'danmu' ? 'danmu count' : 'view count'} (descending)`);
    } else {
      updateStatus('Could not find video container');
    }
  }

  // Reset all filters
  function resetFilters() {
    const cards = getVideoCards();
    cards.forEach(card => {
      card.classList.remove('bili-hidden');
    });

    danmuFilterInput.value = '0';
    viewFilterInput.value = '0';
    updateStatus('Filters reset - all videos shown');
  }

  // Update status text
  function updateStatus(message) {
    statusText.textContent = message;
    setTimeout(() => {
      if (statusText.textContent === message) {
        statusText.textContent = '';
      }
    }, 5000);
  }

  // Initial status
  updateStatus('Ready');

  // Observer to detect page changes (for dynamic content loading)
  const observer = new MutationObserver(() => {
    const cards = getVideoCards();
    if (cards.length > 0) {
      console.log(`Bilibili Filter Helper: Detected ${cards.length} videos`);
    }
  });

  // Start observing when page is loaded
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
