window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});document.addEventListener('contextmenu',function(e){const target=e.target;const isInput=target.tagName==='INPUT'||target.tagName==='TEXTAREA';const isContentEditable=target.isContentEditable;if(!isInput&&!isContentEditable){e.preventDefault()}});#!/usr/bin/env node
/**
 * PakePlus 全局快捷键 + 窗口控制注入脚本
 * 为 PakePlus（Tauri 2）本地打包项目添加：
 * 1. 系统级全局快捷键（即使窗口未激活、在后台运行也能触发）
 * 2. 窗口置顶（alwaysOnTop）API 与权限
 * 默认快捷键：Alt + Q，可按需修改脚本顶部的 DEFAULT_SHORTCUTS 数组。
 */

const fs = require('fs');
const path = require('path');

// 默认快捷键配置。每个对象对应一个全局快捷键。
const DEFAULT_SHORTCUTS = [
  {
    // Tauri 快捷键字符串（accelerator）
    accelerator: 'alt+q',
    // 向前端发送的 payload
    event: 'alt-q',
    // 用于 Rust 匹配代码
    modifiers: 'Modifiers::ALT',
    code: 'Code::KeyQ',
  },
];

const CARGO_DEP_BLOCK = `[target."cfg(not(any(target_os = \\"android\\", target_os = \\"ios\\\")))".dependencies]\ntauri-plugin-global-shortcut = "2.0.0"\n`;

function buildRustBlock(shortcuts) {
  const handlerBranches = shortcuts
    .map(
      (s) => `                            if shortcut.matches(${s.modifiers}, ${s.code}) {
                                let _ = app.emit("global-shortcut", "${s.event}");
                            }`
    )
    .join('\n');

  const shortcutList = shortcuts.map((s) => `"${s.accelerator}"`).join(', ');

  return `
        #[cfg(desktop)]
        {
            use tauri::Emitter;
            use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};

            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_shortcuts([${shortcutList}])?
                    .with_handler(|app, shortcut, event| {
                        if event.state == ShortcutState::Pressed {
${handlerBranches}
                        }
                    })
                    .build(),
            )?;
        }
`;
}

function backupFile(filePath, suffix) {
  const backup = `${filePath}${suffix}`;
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(filePath, backup);
    console.log(`  已备份: ${path.relative(process.cwd(), backup)}`);
  }
}

function patchCargoToml(tauriDir, suffix) {
  const cargoPath = path.join(tauriDir, 'Cargo.toml');
  if (!fs.existsSync(cargoPath)) {
    throw new Error('未找到 src-tauri/Cargo.toml');
  }

  let content = fs.readFileSync(cargoPath, 'utf8');
  if (content.includes('tauri-plugin-global-shortcut')) {
    console.log('✓ Cargo.toml 已包含全局快捷键插件');
    return;
  }

  backupFile(cargoPath, suffix);

  const targetSection = `[target."cfg(not(any(target_os = "android", target_os = "ios")))".dependencies]`;
  if (content.includes(targetSection)) {
    content = content.replace(
      targetSection,
      `${targetSection}\ntauri-plugin-global-shortcut = "2.0.0"`
    );
  } else {
    content = content.trimEnd() + '\n\n' + CARGO_DEP_BLOCK;
  }

  fs.writeFileSync(cargoPath, content, 'utf8');
  console.log('✓ 已更新 Cargo.toml');
}

function patchMainRs(tauriDir, suffix) {
  const mainRsPath = path.join(tauriDir, 'src/main.rs');
  const libRsPath = path.join(tauriDir, 'src/lib.rs');
  let targetFile = mainRsPath;

  if (!fs.existsSync(mainRsPath) && fs.existsSync(libRsPath)) {
    targetFile = libRsPath;
  }
  if (!fs.existsSync(targetFile)) {
    throw new Error('未找到 src-tauri/src/main.rs 或 lib.rs');
  }

  let content = fs.readFileSync(targetFile, 'utf8');
  if (content.includes('global-shortcut') || content.includes('global_shortcut')) {
    console.log(`✓ ${path.basename(targetFile)} 已包含全局快捷键，跳过`);
    return;
  }

  backupFile(targetFile, suffix);

  const rustBlock = buildRustBlock(DEFAULT_SHORTCUTS);

  if (content.includes('.setup(')) {
    // 在已有 setup 闭包的最后一个 Ok(()) 之前插入
    const setupRegex = /(\.setup\(\|app\| \{[\s\S]*?)(\n\s*Ok\(\(\)\)\s*\})/;
    if (!setupRegex.test(content)) {
      throw new Error('main.rs/lib.rs 中已有 setup 闭包，但无法安全定位插入位置，请手动合并');
    }
    content = content.replace(setupRegex, (match, head, tail) => head + rustBlock + tail);
  } else {
    // 没有 setup 时，在 .run( 之前插入 setup 闭包
    content = content.replace(
      /(\.run\()/g,
      '.setup(|app| {' + rustBlock + '        Ok(());\n    })\n    .run('
    );
  }

  fs.writeFileSync(targetFile, content, 'utf8');
  console.log(`✓ 已更新 ${path.basename(targetFile)}`);
}

function patchCapabilities(tauriDir, suffix) {
  const capDir = path.join(tauriDir, 'capabilities');
  if (!fs.existsSync(capDir)) {
    console.warn('⚠ 未找到 capabilities 目录，请手动添加 global-shortcut:default 与 window 权限');
    return;
  }

  const files = fs.readdirSync(capDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    console.warn('⚠ capabilities 目录为空，请手动添加 global-shortcut:default 与 window 权限');
    return;
  }

  const requiredPermissions = [
    'global-shortcut:default',
    'core:window:allow-set-always-on-top',
    'core:window:allow-is-always-on-top',
  ];

  for (const file of files) {
    const filePath = path.join(capDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);

    if (!json.permissions) json.permissions = [];

    let changed = false;
    for (const permission of requiredPermissions) {
      const exists = json.permissions.some(
        (p) => p === permission || (p && p.identifier === permission)
      );
      if (exists) {
        console.log(`✓ ${file} 已包含 ${permission} 权限`);
        continue;
      }
      if (!changed) {
        backupFile(filePath, suffix);
        changed = true;
      }
      json.permissions.push(permission);
      console.log(`✓ 已更新 ${file} 权限: ${permission}`);
    }

    if (changed) {
      fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
    }
  }
}

function writeFrontendScript(projectDir, shortcuts) {
  const srcDir = path.join(projectDir, 'src');
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  const filePath = path.join(srcDir, 'pakeplus-global-shortcut.js');
  const branches = shortcuts
    .map(
      (s) => `    if (event.payload === '${s.event}') {
      window.dispatchEvent(new CustomEvent('pakeplus:shortcut', { detail: '${s.event}' }));
      // 这里可以写自定义行为，例如聚焦输入框、切换页面等
      const target = document.querySelector('[data-pakeplus-shortcut="${s.event}"]');
      if (target) target.focus();
    }`
    )
    .join('\n');

  const content = `// 由 pakeplus-global-shortcut.js 自动生成
// 在 PakePlus 桌面端窗口未激活时，仍可响应系统级快捷键；同时提供窗口置顶 API。
// 使用方式：在 src/main.tsx 或 src/main.ts 中 import './pakeplus-global-shortcut';

function attachPakeplusShortcuts() {
  // 优先使用 withGlobalTauri 暴露的 window.__TAURI__
  const tauri = window.__TAURI__;
  if (tauri && tauri.event) {
    tauri.event.listen('global-shortcut', (event) => {
${branches}
    });
  }
}

/**
 * 窗口置顶 API
 * 暴露 window.__pakeplus_window__ 对象，前端可通过 getAlwaysOnTop / setAlwaysOnTop 控制
 */
function attachPakeplusWindowControl() {
  const tauri = window.__TAURI__;
  if (!tauri || !tauri.window || !tauri.window.getCurrentWindow) {
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
        return true;
      } catch (err) {
        console.warn('[PakePlus Window] setAlwaysOnTop failed', err);
        return false;
      }
    },
  };
}

function init() {
  attachPakeplusShortcuts();
  attachPakeplusWindowControl();
}

if (document.readyState === 'complete') {
  init();
} else {
  window.addEventListener('DOMContentLoaded', init);
}
`;

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✓ 已生成前端监听脚本: ${path.relative(projectDir, filePath)}`);
}

function patchFrontendEntry(projectDir) {
  const candidates = [
    'src/main.tsx',
    'src/main.ts',
    'src/index.tsx',
    'src/index.ts',
    'src/App.tsx',
    'src/App.ts',
  ];

  for (const candidate of candidates) {
    const filePath = path.join(projectDir, candidate);
    if (!fs.existsSync(filePath)) continue;

    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('pakeplus-global-shortcut')) continue;

    const importLine = `import './pakeplus-global-shortcut';\n`;
    content = importLine + content;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ 已自动引入: ${candidate}`);
    return;
  }

  console.log('ℹ 未找到 src/main.tsx 等入口文件，请手动引入 src/pakeplus-global-shortcut.js');
}

function main() {
  const projectDir = process.argv[2] || process.cwd();
  const tauriDir = path.join(projectDir, 'src-tauri');

  if (!fs.existsSync(tauriDir)) {
    console.error(`错误：未找到 ${path.join(projectDir, 'src-tauri')} 目录`);
    console.error('请确认该目录是 PakePlus / Tauri 2 项目根目录');
    process.exit(1);
  }

  const suffix = '.backup-' + Date.now();

  try {
    console.log('开始为 PakePlus 项目注入全局快捷键...\n');
    patchCargoToml(tauriDir, suffix);
    patchMainRs(tauriDir, suffix);
    patchCapabilities(tauriDir, suffix);
    writeFrontendScript(projectDir, DEFAULT_SHORTCUTS);
    patchFrontendEntry(projectDir);

    console.log('\n全局快捷键注入完成！');
    console.log('默认快捷键：', DEFAULT_SHORTCUTS.map((s) => s.accelerator.toUpperCase()).join(', '));
    console.log('后续步骤：');
    console.log('  1. 重新运行 PakePlus 本地打包（tauri build）');
    console.log('  2. 在桌面端中按 Alt+Q 测试后台响应');
    console.log('  3. 需要添加更多快捷键，请修改本脚本顶部的 DEFAULT_SHORTCUTS 后重新运行');
  } catch (err) {
    console.error('\n注入失败:', err.message);
    process.exit(1);
  }
}

main();
