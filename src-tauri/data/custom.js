window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});document.addEventListener('contextmenu',function(e){const target=e.target;const isInput=target.tagName==='INPUT'||target.tagName==='TEXTAREA';const isContentEditable=target.isContentEditable;if(!isInput&&!isContentEditable){e.preventDefault()}});#!/usr/bin/env node
/**
 * 小鱼快递助手 - Electron 单文件适配器
 * 把这个文件放到你的项目根目录，即可把 Vite/React 网页包装成桌面应用。
 * 支持：后台全局快捷键 Alt+Q、窗口控制、本地文件加载。
 *
 * 用法：
 *   1. 先把网页打包好：npm run build（生成 dist/index.html）
 *   2. 安装 Electron：npm install -D electron
 *   3. 启动桌面应用：npx electron electron-adapter.js
 */

const { app, BrowserWindow, globalShortcut, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

// ============================================================
// 1. 自动写出 preload 脚本（让网页能安全接收 Electron 事件）
// ============================================================
const PRELOAD_PATH = path.join(__dirname, 'electron-adapter-preload.js');

const PRELOAD_CODE = `const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // 监听主进程发来的全局快捷键事件
  onGlobalShortcut(callback) {
    const handler = (_event, eventName) => callback(eventName);
    ipcRenderer.on('global-shortcut', handler);
    return () => ipcRenderer.removeListener('global-shortcut', handler);
  },

  // 窗口控制：minimize / maximize / close / show
  windowControl(command) {
    return ipcRenderer.invoke('window-control', command);
  },
});
`;

if (!fs.existsSync(PRELOAD_PATH)) {
  fs.writeFileSync(PRELOAD_PATH, PRELOAD_CODE, 'utf8');
  console.log('[Electron] 已自动生成:', PRELOAD_PATH);
}

// ============================================================
// 2. 全局快捷键配置
// ============================================================
const SHORTCUTS = {
  'Alt+Q': { event: 'express-query', description: '快递查询' },
};

// ============================================================
// 3. 窗口管理
// ============================================================
let mainWindow = null;
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: !isDev,
    },
  });

  // 加载页面：开发模式用 vite，生产模式加载 dist/index.html
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const distHtml = path.join(__dirname, 'dist', 'index.html');
    if (!fs.existsSync(distHtml)) {
      console.error('[Electron] 未找到 dist/index.html，请先运行 npm run build');
      app.quit();
      return;
    }
    mainWindow.loadFile(distHtml);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================
// 4. 注册系统级全局快捷键（窗口在后台也能响应）
// ============================================================
function registerGlobalShortcuts() {
  globalShortcut.unregisterAll();

  for (const [accelerator, config] of Object.entries(SHORTCUTS)) {
    const ok = globalShortcut.register(accelerator, () => {
      if (!mainWindow) return;

      // 窗口最小化/隐藏/后台时，自动恢复并聚焦
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();

      // 把事件发给网页
      mainWindow.webContents.send('global-shortcut', config.event);
      console.log(`[Electron] 快捷键触发: ${accelerator} -> ${config.event}`);
    });

    if (ok) {
      console.log(`[Electron] 已注册全局快捷键: ${accelerator}`);
    } else {
      console.error(`[Electron] 注册失败，快捷键可能已被占用: ${accelerator}`);
    }
  }
}

function unregisterGlobalShortcuts() {
  globalShortcut.unregisterAll();
}

// ============================================================
// 5. 应用生命周期
// ============================================================
app.whenReady().then(() => {
  createWindow();
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  unregisterGlobalShortcuts();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  unregisterGlobalShortcuts();
});

// ============================================================
// 6. 网页可调用的命令
// ============================================================
ipcMain.handle('window-control', (_event, command) => {
  if (!mainWindow) return;
  switch (command) {
    case 'minimize':
      mainWindow.minimize();
      break;
    case 'maximize':
      mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
      break;
    case 'close':
      mainWindow.close();
      break;
    case 'show':
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      break;
  }
});