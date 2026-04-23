const { app, BrowserWindow, globalShortcut, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Konfigurasi Auto-Update
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let win;
let isAllowedToClose = false;

const HOME_URL = 'https://portalujian-smpn40sby.blogspot.com/';
const GOOGLE_LOGOUT_AND_LOGIN = 'https://accounts.google.com/Logout?continue=https://accounts.google.com/ServiceLogin';

Menu.setApplicationMenu(null);

function injectToolbar() {
  if (!win || win.isDestroyed()) return;
  const toolbarPath = path.join(__dirname, 'toolbar.js');
  if (fs.existsSync(toolbarPath)) {
    const toolbarCode = fs.readFileSync(toolbarPath, 'utf8');
    win.webContents.executeJavaScript(toolbarCode).catch(() => {});
  }
}

// FUNGSI GANTI AKUN (CLEAN WIPE)
async function clearSessionAndRelogin() {
  if (!win || win.isDestroyed()) return;
  try {
    await win.webContents.session.clearStorageData();
    await win.webContents.session.clearCache();
    await win.webContents.session.clearAuthCache();

    setTimeout(() => {
      if (win && !win.isDestroyed()) {
        win.loadURL(GOOGLE_LOGOUT_AND_LOGIN);
      }
    }, 500);
  } catch (err) {
    console.error('Gagal menghapus sesi:', err);
    if (win && !win.isDestroyed()) win.loadURL(GOOGLE_LOGOUT_AND_LOGIN);
  }
}

function createWindow() {
  win = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    alwaysOnTop: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false,
      sandbox: true
    }
  });

  // 1. BYPASS CSP UNTUK TOOLBAR
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const headers = Object.assign({}, details.responseHeaders);
    delete headers['content-security-policy'];
    delete headers['Content-Security-Policy'];
    callback({ responseHeaders: headers });
  });

  // 2. CEGAT URL PALSU SEBELUM MENCARI DNS (SOLUSI ERR_NAME_NOT_RESOLVED)
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.toLowerCase().includes('exambro-switch.local')) {
      clearSessionAndRelogin();
      callback({ cancel: true }); // Batalkan request sepenuhnya!
      return;
    }
    callback({}); // Biarkan URL lain lewat
  });

  // 3. CEGAH MEMBUKA TAB BARU (POP-UP)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.toLowerCase().includes('exambro-switch.local')) {
      clearSessionAndRelogin();
      return { action: 'deny' };
    }
    win.loadURL(url);
    return { action: 'deny' };
  });

  win.loadURL(HOME_URL);

  win.webContents.on('did-finish-load', () => {
    setTimeout(injectToolbar, 200);
  });

  // Proteksi Keyboard & Tombol Keluar (Alt + F12)
  win.webContents.on('before-input-event', (event, input) => {
    const key = input.key.toLowerCase();
    if (input.alt && input.key === 'F12') {
      isAllowedToClose = true;
      app.quit();
    }
    if ((input.control && (key === 'r' || key === 'c' || key === 'v')) || input.key === 'f5' || key === 'f12') {
      event.preventDefault();
    }
  });

  win.on('close', (e) => {
    if (!isAllowedToClose) e.preventDefault();
  });
}

app.whenReady().then(() => {
  createWindow();

  // Blokir Shortcut Global (Anti Alt+Tab)
  const globalBlocks = ['Alt+Tab', 'Alt+Esc', 'Alt+F4', 'PrintScreen'];
  globalBlocks.forEach(accel => {
    try { globalShortcut.register(accel, () => {}); } catch (e) {}
  });

  autoUpdater.checkForUpdatesAndNotify();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});