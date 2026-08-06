window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});document.addEventListener('contextmenu',function(e){const target=e.target;const isInput=target.tagName==='INPUT'||target.tagName==='TEXTAREA';const isContentEditable=target.isContentEditable;if(!isInput&&!isContentEditable){e.preventDefault()}});/**
 * 小鱼快递助手 - PakePlus / Electron 发布 全局快捷键脚本
 *
 * 用途：把本文件内容粘贴到 PakePlus「软件配置 → 脚本文件」输入框，
 *       即可为 Electron 发布版注入 9 个系统级全局快捷键。
 *
 * 特点：
 *   1. 优先调用 PakePlus 原生 API：window.pakeplus.registerShortcut
 *   2. 兼容 Tauri（window.__TAURI__）与标准 Electron（window.electronAPI）
 *   3. 为前端统一暴露 window.electronAPI，useShortcutManager 无需改动
 */
(function () {
  'use strict';

  // 与 src/utils/shortcutConfigStorage.ts 默认值保持一致
  const SHORTCUTS = [
    { id: 'expressQuery', description: '快递查询', accelerator: 'Alt+Q', key: 'q', altKey: true },
    { id: 'openQuery', description: '快递查询', accelerator: 'Ctrl+1', key: '1', ctrlKey: true },
    { id: 'openHistory', description: '查询历史', accelerator: 'Ctrl+2', key: '2', ctrlKey: true },
    { id: 'openPackages', description: '包裹管理', accelerator: 'Ctrl+3', key: '3', ctrlKey: true },
    { id: 'openTable', description: '在线表格', accelerator: 'Ctrl+4', key: '4', ctrlKey: true },
    { id: 'openTableExtractor', description: '表格提取', accelerator: 'Ctrl+5', key: '5', ctrlKey: true },
    { id: 'performanceMode', description: '性能模式', accelerator: 'Alt+1', key: '1', altKey: true },
    { id: 'toggleTheme', description: '切换主题', accelerator: 'Alt+CapsLock', key: 'CapsLock', altKey: true },
    { id: 'toggleMute', description: '切换静音', accelerator: 'Alt+W', key: 'w', altKey: true },
  ];

  const EVENT_NAME = 'pakeplus-global-shortcut';

  function emit(id) {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: id }));
    console.log('[PakePlus/Electron Shortcut] 触发:', id);
  }

  // 1. 使用 PakePlus 原生全局快捷键 API
  function registerWithPakeplus(shortcut) {
    if (typeof window.pakeplus?.registerShortcut === 'function') {
      window.pakeplus.registerShortcut({
        key: shortcut.key,
        altKey: shortcut.altKey,
        ctrlKey: shortcut.ctrlKey,
        shiftKey: shortcut.shiftKey,
        metaKey: shortcut.metaKey,
        callback: () => emit(shortcut.id),
      });
      return true;
    }
    return false;
  }

  // 2. 使用 Tauri 全局快捷键（本地 Tauri 打包时）
  async function registerWithTauri(shortcut) {
    if (window.__TAURI__ && window.__TAURI__.globalShortcut) {
      try {
        await window.__TAURI__.globalShortcut.register(shortcut.accelerator, () => emit(shortcut.id));
        return true;
      } catch (err) {
        console.warn('[PakePlus/Electron Shortcut] Tauri 注册失败:', shortcut.accelerator, err);
      }
    }
    return false;
  }

  // 3. 浏览器内兜底：仅在窗口聚焦时生效
  function registerBrowserFallback(shortcut) {
    const keyLower = shortcut.key.toLowerCase();
    const handler = (event) => {
      if (event.key.toLowerCase() !== keyLower) return;
      if (!!shortcut.altKey !== event.altKey) return;
      if (!!shortcut.ctrlKey !== event.ctrlKey) return;
      if (!!shortcut.shiftKey !== event.shiftKey) return;
      if (!!shortcut.metaKey !== event.metaKey) return;
      event.preventDefault();
      emit(shortcut.id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }

  // 暴露与 Electron 一致的 API，让 useShortcutManager 直接复用
  function ensureElectronAPI() {
    if (window.electronAPI) return;

    window.electronAPI = {
      isElectron: true,

      onGlobalShortcut(callback) {
        const handler = (event) => callback(event.detail);
        window.addEventListener(EVENT_NAME, handler);
        return () => window.removeEventListener(EVENT_NAME, handler);
      },

      windowControl() {
        return Promise.resolve();
      },

      getShortcuts() {
        const map = {};
        for (const item of SHORTCUTS) {
          map[item.id] = { event: item.id, description: item.description };
        }
        return Promise.resolve(map);
      },
    };

    console.log('[PakePlus/Electron Shortcut] 已挂载 electronAPI 桥接');
  }

  async function init() {
    ensureElectronAPI();
    const browserCleanups = [];

    for (const shortcut of SHORTCUTS) {
      if (registerWithPakeplus(shortcut)) {
        console.log('[PakePlus/Electron Shortcut] 已注册（PakePlus）:', shortcut.accelerator);
        continue;
      }
      if (await registerWithTauri(shortcut)) {
        console.log('[PakePlus/Electron Shortcut] 已注册（Tauri）:', shortcut.accelerator);
        continue;
      }
      browserCleanups.push(registerBrowserFallback(shortcut));
      console.log('[PakePlus/Electron Shortcut] 已注册（浏览器兜底）:', shortcut.accelerator);
    }

    window.__pakeplusShortcutCleanup = () => {
      for (const cleanup of browserCleanups) cleanup();
    };
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }
})();
