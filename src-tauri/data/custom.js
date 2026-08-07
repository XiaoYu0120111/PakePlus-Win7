window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});document.addEventListener('contextmenu',function(e){const target=e.target;const isInput=target.tagName==='INPUT'||target.tagName==='TEXTAREA';const isContentEditable=target.isContentEditable;if(!isInput&&!isContentEditable){e.preventDefault()}});// =====================================================
// PakePlus 注入脚本：仅提供窗口始终置顶能力
// 复制到 PakePlus 的脚本文件（如 src/inject.js / script.js）中即可
// 前端使用 window.__pakeplus_window__.getAlwaysOnTop / setAlwaysOnTop
// =====================================================

(function () {
  'use strict';

  // 仅运行一次
  if (window.__pakeplus_window_control_ready) return;
  window.__pakeplus_window_control_ready = true;

  function getTauriWindow() {
    const tauri = window.__TAURI__;
    if (!tauri || !tauri.window) return null;
    // Tauri v2
    if (typeof tauri.window.getCurrentWindow === 'function') {
      return tauri.window.getCurrentWindow();
    }
    // Tauri v1
    if (tauri.window.appWindow && typeof tauri.window.appWindow.setAlwaysOnTop === 'function') {
      return tauri.window.appWindow;
    }
    return null;
  }

  function attachPakeplusWindowControl() {
    const win = getTauriWindow();
    if (!win) {
      console.warn('[PakePlus Window] 未检测到 Tauri 窗口 API，跳过置顶能力注入');
      return;
    }

    if (typeof win.setAlwaysOnTop !== 'function') {
      console.warn('[PakePlus Window] 当前 Tauri 窗口未暴露 setAlwaysOnTop，无法注入');
      return;
    }

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

  function waitAndInit(attempts = 0) {
    if (window.__TAURI__) {
      attachPakeplusWindowControl();
      return;
    }
    if (attempts >= 50) {
      console.warn('[PakePlus Window] 等待 Tauri API 超时，未注入置顶能力');
      return;
    }
    setTimeout(() => waitAndInit(attempts + 1), 100);
  }

  if (document.readyState === 'complete') {
    waitAndInit();
  } else {
    window.addEventListener('DOMContentLoaded', () => waitAndInit());
  }
})();