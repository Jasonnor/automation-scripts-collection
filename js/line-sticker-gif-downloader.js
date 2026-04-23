// ==UserScript==
// @name         LINE Sticker GIF Downloader
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Download LINE stickers as animated GIF (or PNG for static) from LINE Store product pages
// @author       You
// @match        *://store.line.me/stickershop/product/*
// @match        *://yabeline.tw/Stickers_Data.php?Number=*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=store.line.me
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @connect      stickershop.line-scdn.net
// @connect      sdl-stickershop.line.naver.jp
// @require      https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js
// @require      https://cdn.jsdelivr.net/npm/upng-js@2.1.0/UPNG.js
// @require      https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js
// @resource     GIFWORKER https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js
// ==/UserScript==

(function () {
  "use strict";

  const LINE_GREEN = "#00C300";
  const LINE_GREEN_DARK = "#00A000";

  const IS_YABE = window.location.hostname.includes("yabeline.tw");

  // ─── CSS ────────────────────────────────────────────────────────
  const addCSS = (s) => {
    const style = document.createElement("style");
    style.innerHTML = s;
    (document.head || document.documentElement).appendChild(style);
  };

  addCSS(`
    #ls-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    #ls-toggle {
      width: 52px;
      height: 52px;
      background: ${LINE_GREEN};
      color: white;
      border-radius: 50%;
      box-shadow: 0 4px 14px rgba(0,0,0,0.22);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      user-select: none;
      flex-shrink: 0;
    }
    #ls-toggle:hover {
      transform: scale(1.07);
      box-shadow: 0 6px 20px rgba(0,0,0,0.28);
    }
    #ls-panel {
      margin-bottom: 12px;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 16px;
      padding: 18px 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14);
      width: 300px;
      display: none;
      flex-direction: column;
      gap: 14px;
    }
    #ls-panel.show {
      display: flex;
      animation: lsFadeIn 0.25s ease;
    }
    @keyframes lsFadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .ls-title {
      font-size: 14px;
      font-weight: 700;
      color: #111;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .ls-subtitle {
      font-size: 11px;
      color: #888;
      font-weight: 400;
      margin-top: 2px;
      line-height: 1.4;
    }
    .ls-btn {
      width: 100%;
      padding: 11px;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
    }
    .ls-btn-primary {
      background: ${LINE_GREEN};
      color: white;
    }
    .ls-btn-primary:hover:not(:disabled) {
      background: ${LINE_GREEN_DARK};
      transform: translateY(-1px);
    }
    .ls-btn-primary:disabled {
      background: #aaa;
      cursor: not-allowed;
      transform: none;
    }
    .ls-progress-wrap {
      display: none;
      flex-direction: column;
      gap: 6px;
    }
    .ls-progress-wrap.show {
      display: flex;
    }
    .ls-progress-bar-bg {
      width: 100%;
      height: 6px;
      background: #e8e8e8;
      border-radius: 3px;
      overflow: hidden;
    }
    .ls-progress-bar-fill {
      height: 100%;
      background: ${LINE_GREEN};
      border-radius: 3px;
      width: 0%;
      transition: width 0.3s ease;
    }
    .ls-status {
      font-size: 12px;
      color: #555;
      text-align: center;
      min-height: 16px;
    }

    /* ── Per-sticker download button ── */
    li.mdCMN09Li,
    li.stickerSub {
      position: relative !important;
    }
    .ls-dl-btn {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 26px;
      height: 26px;
      background: rgba(0, 195, 0, 0.90);
      color: white;
      border-radius: 7px;
      border: none;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 20;
      padding: 0;
      line-height: 1;
      transition: background 0.15s ease, transform 0.15s ease;
      box-shadow: 0 2px 7px rgba(0, 0, 0, 0.22);
    }
    li.mdCMN09Li:hover .ls-dl-btn,
    li.stickerSub:hover .ls-dl-btn {
      display: flex;
    }
    .ls-dl-btn:hover {
      background: ${LINE_GREEN_DARK};
      transform: scale(1.12);
    }
    .ls-dl-btn.ls-loading {
      background: #f0a000;
      cursor: wait;
      animation: lsSpin 0.8s linear infinite;
    }
    .ls-dl-btn.ls-done {
      background: #0077cc;
    }
    .ls-dl-btn.ls-error {
      background: #cc2200;
    }
    @keyframes lsSpin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
  `);

  // ─── Helpers ─────────────────────────────────────────────────────
  function fetchArrayBuffer(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        responseType: "arraybuffer",
        onload: (r) => {
          if (r.status >= 200 && r.status < 300) resolve(r.response);
          else reject(new Error(`HTTP ${r.status} for ${url}`));
        },
        onerror: (e) => reject(new Error(`Network error: ${e}`)),
      });
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  function sanitizeName(name) {
    return name.replace(/[\\/:*?"<>|]/g, "_").trim();
  }

  function getPackName() {
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      const raw = ogTitle.getAttribute("content") || "";
      return sanitizeName(raw.split("–")[0].split("|")[0].trim());
    }
    return sanitizeName(document.title.split("–")[0].split("|")[0].trim());
  }

  function getStickerItems() {
    if (IS_YABE) {
      return Array.from(document.querySelectorAll("li.stickerSub"));
    }
    return Array.from(
      document.querySelectorAll("li.FnStickerPreviewItem[data-preview]")
    );
  }

  function parsePreview(li) {
    if (IS_YABE) {
      const img = li.querySelector("img");
      if (!img) return null;
      const staticUrl = img.getAttribute("src");
      const animationUrl = img.getAttribute("data-anim");
      const idMatch = staticUrl.match(/sticker\/(\d+)/);
      const id = idMatch ? idMatch[1] : Math.random().toString(36).substr(2, 9);
      return {
        id,
        type: animationUrl ? "animation" : "static",
        animationUrl,
        staticUrl,
      };
    }
    try {
      const raw = li.getAttribute("data-preview").replace(/&quot;/g, '"');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // ─── GIF Worker blob URL (Tampermonkey resource → blob) ──────────
  let _workerBlobUrl = null;

  function getWorkerUrl() {
    if (_workerBlobUrl) return _workerBlobUrl;
    const text = GM_getResourceText("GIFWORKER");
    const blob = new Blob([text], {type: "application/javascript"});
    _workerBlobUrl = URL.createObjectURL(blob);
    return _workerBlobUrl;
  }

  // ─── APNG → GIF conversion ───────────────────────────────────────
  // GIF has no alpha channel — we use a chroma-key color (near-pure green,
  // very unlikely in sticker art) as the transparency index, and composite
  // semi-transparent pixels onto a white background.
  const TRANSPARENT_KEY = 0x00fe01; // 0xRRGGBB used by gif.js
  const KEY_R = 0, KEY_G = 254, KEY_B = 1;

  async function apngToGifBlob(buffer) {
    const img = UPNG.decode(buffer);
    const frames = UPNG.toRGBA8(img);
    const {width, height} = img;

    if (!frames || frames.length === 0) throw new Error("No frames decoded");

    return new Promise((resolve, reject) => {
      const gif = new GIF({
        workers: 2,
        quality: 10,
        workerScript: getWorkerUrl(),
        width,
        height,
        repeat: 0,
        transparent: TRANSPARENT_KEY,
      });

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      frames.forEach((frameData, i) => {
        const src = new Uint8ClampedArray(frameData);
        const out = new Uint8ClampedArray(width * height * 4);

        for (let px = 0; px < src.length; px += 4) {
          const a = src[px + 3];
          if (a < 10) {
            // Fully/nearly transparent → chroma key (will be transparent in GIF)
            out[px]     = KEY_R;
            out[px + 1] = KEY_G;
            out[px + 2] = KEY_B;
            out[px + 3] = 255;
          } else {
            // Alpha-composite onto white background to preserve antialiasing
            const af = a / 255;
            out[px]     = Math.round(src[px]     * af + 255 * (1 - af));
            out[px + 1] = Math.round(src[px + 1] * af + 255 * (1 - af));
            out[px + 2] = Math.round(src[px + 2] * af + 255 * (1 - af));
            out[px + 3] = 255;
          }
        }

        ctx.putImageData(new ImageData(out, width, height), 0, 0);

        const delay =
          img.frames && img.frames[i] && img.frames[i].delay != null
            ? img.frames[i].delay
            : 100;

        gif.addFrame(ctx, {copy: true, delay: Math.max(delay, 20)});
      });

      gif.on("finished", resolve);
      gif.on("abort", () => reject(new Error("GIF encoding aborted")));
      gif.render();
    });
  }

  // ─── Download a single sticker ───────────────────────────────────
  async function downloadSticker(preview, packName, btnEl) {
    const {id, type, animationUrl, staticUrl} = preview;
    const isAnimated = type === "animation" && animationUrl;
    const url = isAnimated ? animationUrl : staticUrl;
    const ext = isAnimated ? "gif" : "png";
    const filename = `${packName}_${id}.${ext}`;

    if (btnEl) {
      btnEl.classList.remove("ls-done", "ls-error");
      btnEl.classList.add("ls-loading");
      btnEl.textContent = "↻";
    }

    try {
      const buffer = await fetchArrayBuffer(url);
      let blob;
      if (isAnimated) {
        blob = await apngToGifBlob(buffer);
      } else {
        blob = new Blob([buffer], {type: "image/png"});
      }
      downloadBlob(blob, filename);

      if (btnEl) {
        btnEl.classList.remove("ls-loading");
        btnEl.classList.add("ls-done");
        btnEl.textContent = "✓";
      }
    } catch (err) {
      console.error("[LINE DL]", err);
      if (btnEl) {
        btnEl.classList.remove("ls-loading");
        btnEl.classList.add("ls-error");
        btnEl.textContent = "✕";
      }
    }
  }

  // ─── Inject per-sticker download buttons ─────────────────────────
  function injectStickerButtons(packName) {
    getStickerItems().forEach((li) => {
      if (li.querySelector(".ls-dl-btn")) return;
      const preview = parsePreview(li);
      if (!preview) return;

      const btn = document.createElement("button");
      btn.className = "ls-dl-btn";
      btn.title = "Download as GIF";
      btn.textContent = "↓";

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (btn.classList.contains("ls-loading")) return;
        downloadSticker(preview, packName, btn);
      });

      li.appendChild(btn);
    });
  }

  // ─── Panel UI ────────────────────────────────────────────────────
  function init() {
    if (document.getElementById("ls-container")) return;

    const packName = getPackName();
    const items = getStickerItems();
    const count = items.length;

    const container = document.createElement("div");
    container.id = "ls-container";
    container.innerHTML = `
      <div id="ls-panel">
        <div>
          <div class="ls-title">📥 LINE Sticker Downloader</div>
          <div class="ls-subtitle">${count} sticker${count !== 1 ? "s" : ""} found &mdash; animated stickers saved as GIF, static as PNG</div>
        </div>
        <button class="ls-btn ls-btn-primary" id="ls-btn-all">⬇ Download All (${count})</button>
        <div class="ls-progress-wrap" id="ls-progress-wrap">
          <div class="ls-progress-bar-bg">
            <div class="ls-progress-bar-fill" id="ls-progress-fill"></div>
          </div>
          <div class="ls-status" id="ls-status"></div>
        </div>
      </div>
      <div id="ls-toggle" title="LINE Sticker Downloader">📥</div>
    `;
    document.body.appendChild(container);

    // Toggle panel
    document.getElementById("ls-toggle").addEventListener("click", () => {
      document.getElementById("ls-panel").classList.toggle("show");
    });

    // Download All
    document.getElementById("ls-btn-all").addEventListener("click", async () => {
      const allItems = getStickerItems();
      const total = allItems.length;
      const btn = document.getElementById("ls-btn-all");
      const progressWrap = document.getElementById("ls-progress-wrap");
      const fill = document.getElementById("ls-progress-fill");
      const status = document.getElementById("ls-status");

      btn.disabled = true;
      progressWrap.classList.add("show");
      let errorCount = 0;

      for (let i = 0; i < total; i++) {
        const preview = parsePreview(allItems[i]);
        if (!preview) continue;

        status.textContent = `Converting & downloading ${i + 1} / ${total}…`;
        fill.style.width = `${Math.round(((i) / total) * 100)}%`;

        // Also update the individual button state if present
        const individualBtn = allItems[i].querySelector(".ls-dl-btn");

        try {
          await downloadSticker(preview, packName, individualBtn);
        } catch {
          errorCount++;
        }

        fill.style.width = `${Math.round(((i + 1) / total) * 100)}%`;

        // Small pause to prevent browser from blocking too many simultaneous downloads
        await new Promise((r) => setTimeout(r, 400));
      }

      const errMsg = errorCount > 0 ? ` (${errorCount} failed)` : "";
      status.textContent = `✓ Done! ${total - errorCount} stickers downloaded${errMsg}`;
      fill.style.width = "100%";
      btn.disabled = false;
    });

    // Inject per-sticker buttons
    injectStickerButtons(packName);
  }

  // ─── Wait for sticker list to render (SPA safety) ────────────────
  function waitForStickers(cb) {
    const selector = IS_YABE ? "li.stickerSub" : "li.FnStickerPreviewItem";
    if (document.querySelector(selector)) {
      cb();
      return;
    }
    const obs = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        obs.disconnect();
        cb();
      }
    });
    obs.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => waitForStickers(init));
  } else {
    waitForStickers(init);
  }
})();
