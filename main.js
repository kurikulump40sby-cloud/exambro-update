const { app, BrowserWindow, globalShortcut, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Matikan auto-install bawaan karena kita akan mengaturnya secara manual
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;

let win;
let splash; // Variabel untuk layar pemuatan (Splash Screen)
let isAllowedToClose = false;
let isCheatDetected = false;
let pressedKeys = new Set();

const HOME_URL = 'ujikom.pakkar.my.id/2026/10/try-out-tka-sby.html';
const GOOGLE_LOGOUT_AND_LOGIN = 'https://accounts.google.com/Logout?continue=https://accounts.google.com/ServiceLogin';
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

Menu.setApplicationMenu(null);

function injectToolbar() {
  if (!win || win.isDestroyed()) return;
  const toolbarPath = path.join(__dirname, 'toolbar.js');
  if (fs.existsSync(toolbarPath)) {
    const toolbarCode = fs.readFileSync(toolbarPath, 'utf8');
    win.webContents.executeJavaScript(toolbarCode).catch(() => {});
  }
}

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

// FUNGSI ALARM BIOHAZARD (Tetap dipertahankan)
function triggerCheatAlarm() {
  if (!win || win.isDestroyed() || isAllowedToClose || isCheatDetected) return;
  isCheatDetected = true;

  shell.beep();
  win.restore();
  win.setAlwaysOnTop(true, 'screen-saver');
  win.focus();

  win.webContents.executeJavaScript(`
    (function() {
      if (window.__isAlarmPlaying) return;
      window.__isAlarmPlaying = true;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();

      audioCtx.onstatechange = () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
      };

      const mainOsc = audioCtx.createOscillator();
      mainOsc.type = 'sawtooth';
      mainOsc.frequency.value = 350;

      const lfo = audioCtx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.5;

      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 250;

      const mainGain = audioCtx.createGain();
      mainGain.gain.value = 0.5;

      lfo.connect(lfoGain);
      lfoGain.connect(mainOsc.frequency);
      mainOsc.connect(mainGain);
      mainGain.connect(audioCtx.destination);

      lfo.start();
      mainOsc.start();

      const overlay = document.createElement('div');
      overlay.id = 'cheat-warning-overlay';
      overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(220, 38, 38, 1); color:white; z-index:2147483647; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:sans-serif; text-align:center; user-select:none; border: 20px solid #ff0000; box-sizing: border-box;';
      overlay.innerHTML = '<div style="font-size:120px; margin-bottom:20px; animation: blink 0.5s infinite;">🚨</div><h1 style="font-size:50px; margin:0 0 10px 0; font-weight:bold;">SISTEM TERKUNCI!</h1><p style="font-size:28px; margin:0;">Anda terdeteksi menekan tombol terlarang (Windows) atau keluar aplikasi!<br><br><b>Hubungi Pengawas Ujian untuk menutup peringatan ini.</b></p><style>@keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }</style>';
      document.body.appendChild(overlay);
    })();
  `).catch(() => {});
}

// 1. FUNGSI LAYAR PEMUATAN (SPLASH SCREEN)
function createSplashWindow() {
  splash = new BrowserWindow({
    width: 500,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const splashHTML = `
    data:text/html;charset=utf-8,
    <html>
      <body style="margin:0; padding:0; background:#1e1e1e; color:white; font-family:sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; border: 2px solid #10b981; border-radius: 10px; box-sizing:border-box;">
        <h2 style="margin: 0 0 10px 0; color:#10b981;">Spenforty ExamBrowser</h2>
        <p id="status" style="font-size: 16px; margin:0;">Memeriksa pembaruan...</p>
        <div style="width: 80%; background: #333; height: 10px; border-radius: 5px; margin-top: 20px; overflow: hidden;">
          <div id="progress" style="width: 0%; background: #10b981; height: 100%; transition: width 0.3s;"></div>
        </div>
      </body>
    </html>
  `;
  splash.loadURL(splashHTML);
}

function updateSplashText(text, percent = 0) {
  if (splash && !splash.isDestroyed()) {
    splash.webContents.executeJavaScript(`
      document.getElementById('status').innerText = '${text}';
      document.getElementById('progress').style.width = '${percent}%';
    `).catch(() => {});
  }
}

// 2. FUNGSI LAYAR UJIAN UTAMA
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
      sandbox: true,
      userAgent: CHROME_UA
    }
  });

  win.webContents.on('did-finish-load', () => {
    const url = win.webContents.getURL();
    if (url.includes('myaccount.google.com') || url.includes('google.com/account')) {
      win.webContents.executeJavaScript(`
        document.body.innerHTML = '<div style="background:white; height:100vh; width:100vw; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:sans-serif; color:#333;"> <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" style="margin-bottom:20px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> <h2 style="margin:0">Sesi Login Berhasil</h2> <p style="color:#666">Silahkan klik tombol <b>Halaman Awal</b> untuk kembali ke ujian.</p></div>';
        document.body.style.background = 'white';
      `);
    }
  });

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const headers = Object.assign({}, details.responseHeaders);
    delete headers['content-security-policy'];
    delete headers['Content-Security-Policy'];
    callback({ responseHeaders: headers });
  });

  win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.toLowerCase().includes('exambro-switch.local')) {
      clearSessionAndRelogin();
      callback({ cancel: true });
      return;
    }
    callback({});
  });

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
    isCheatDetected = false;
    setTimeout(injectToolbar, 300);
  });

  win.webContents.on('before-input-event', (event, input) => {
    const key = input.key.toLowerCase();

    if (input.type === 'keyDown') {
      pressedKeys.add(key);
    } else if (input.type === 'keyUp') {
      pressedKeys.delete(key);
    }

    // 1. TOMBOL KELUAR BARU: CTRL + K + L
    if (input.control && pressedKeys.has('k') && pressedKeys.has('l')) {
      isAllowedToClose = true;
      app.quit();
    }

    // 2. FUNGSI RELOAD / REFRESH BARU: CTRL + R
    if (input.control && key === 'r' && input.type === 'keyDown') {
      event.preventDefault();
      isCheatDetected = false;
      win.reload();
      return;
    }

    // 3. PEMICU ALARM (Tombol Windows)
    if (key === 'meta' || key === 'os') {
      event.preventDefault();
      triggerCheatAlarm();
    }

    // 4. BLOKIR COPY, PASTE, F5, dan F12
    if ((input.control && (key === 'c' || key === 'v')) || input.key === 'f5' || key === 'f12') {
      event.preventDefault();
    }
  });

  win.on('minimize', (e) => {
    e.preventDefault();
    if (win && !win.isDestroyed()) {
      win.restore();
      win.focus();
    }
  });

  win.on('blur', () => {
    pressedKeys.clear();
    triggerCheatAlarm();
  });

  win.on('close', (e) => { if (!isAllowedToClose) e.preventDefault(); });
}

// 3. LOGIKA AUTO-UPDATER
app.whenReady().then(() => {
  // Daftarkan tombol larangan
  const globalBlocks = [
    'Alt+Tab', 'Alt+Esc', 'Alt+F4', 'PrintScreen',
    'Super+D', 'Super+M', 'Super+Down', 'Super+Up', 'Super+Left', 'Super+Right', 'Super+Tab'
  ];
  globalBlocks.forEach(accel => {
    try { globalShortcut.register(accel, () => {}); } catch (e) {}
  });

  if (!app.isPackaged) {
    // Jika masih npm start, langsung buka layar ujian agar bisa dicoba
    createWindow();
  } else {
    // Jika sudah di-pack (.exe), aktifkan splash screen & cek update ke GitHub
    createSplashWindow();
    autoUpdater.checkForUpdates();
  }
});

autoUpdater.on('update-available', () => {
  updateSplashText('Pembaruan ditemukan! Menyiapkan unduhan...', 10);
});

autoUpdater.on('download-progress', (progressObj) => {
  let percent = Math.round(progressObj.percent);
  updateSplashText(`Mengunduh pembaruan... ${percent}%`, percent);
});

autoUpdater.on('update-downloaded', () => {
  updateSplashText('Pembaruan siap! Memulai ulang aplikasi...', 100);
  isAllowedToClose = true;
  setTimeout(() => {
    autoUpdater.quitAndInstall();
  }, 2000);
});

autoUpdater.on('update-not-available', () => {
  if (splash && !splash.isDestroyed()) splash.close();
  createWindow();
});

autoUpdater.on('error', (err) => {
  if (splash && !splash.isDestroyed()) splash.close();
  createWindow();
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); });
