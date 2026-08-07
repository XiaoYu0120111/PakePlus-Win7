window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});document.addEventListener('contextmenu',function(e){const target=e.target;const isInput=target.tagName==='INPUT'||target.tagName==='TEXTAREA';const isContentEditable=target.isContentEditable;if(!isInput&&!isContentEditable){e.preventDefault()}});// =====================================================
// PakePlus 注入脚本：仅保留窗口始终置顶 API
// 复制到 PakePlus 的脚本文件（如 src/inject.js / script.js）中即可
// 前端使用 window.__pakeplus_window__.getAlwaysOnTop / setAlwaysOnTop
// =====================================================

(function () {
  'use strict';

  // 仅运行一次
  if (window.__pakeplus_window_control_ready) return;
  window.__pakeplus_window_control_ready = true;

  function attachPakeplusWindowControl() {
    const tauri = window.__TAURI__;
    if (!tauri || !tauri.window || !tauri.window.getCurrentWindow) {
      console.warn('[PakePlus Window] 未检测到 Tauri 窗口 API，跳过置顶能力注入');
      return;
    }

    const win = tauri.window.getCurrentWindow();

    window.__pakeplus_window__ = {
      async getAlwaysOnTop() {
        try {
          if (typeof win.isAlwaysOnTop === 'function') {
            return await win.isAlwaysOnTop();
          }
        } catch (err) {
          console.warn('[PakePlus Window] isAlwaysOnTop failed', err);
        }
        return false;
      },
      async setAlwaysOnTop(enabled) {
        try {
          await win.setAlwaysOnTop(enabled);
          console.log('[PakePlus Window] setAlwaysOnTop', enabled);
          return true;
        } catch (err) {
          console.warn('[PakePlus Window] setAlwaysOnTop failed', err);
          return false;
        }
      },
    };

    console.log('[PakePlus Window] 窗口置顶 API 已注入');
  }

  function init() {
    attachPakeplusWindowControl();
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }
})();
