const { app, BrowserWindow, globalShortcut, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { resolveConfig, DEFAULT_CONFIG } = require('./config');

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.autoRunAppAfterInstall = true;

let win = null;
let splash = null;
let splashReady = null;
let appConfig = { ...DEFAULT_CONFIG };

let isAllowedToClose = false;
let isCheatDetected = false;
let examStarted = false;
let splashExitShortcutRegistered = false;

const GOOGLE_LOGOUT_AND_LOGIN =
  'https://accounts.google.com/Logout?continue=https://accounts.google.com/ServiceLogin';
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const SWITCH_TRIGGER = 'exambro-switch.local';

// Host yang selalu boleh dibuka dari dalam halaman ujian
const BASE_ALLOWED_HOSTS = [
  'google.com',
  'googleusercontent.com',
  'gstatic.com',
  'googleapis.com',
  'forms.gle',
  'g.co'
];

Menu.setApplicationMenu(null);

/* ------------------------------------------------------------------ */
/* UTIL                                                               */
/* ------------------------------------------------------------------ */

function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

function allowedHosts() {
  const set = new Set(BASE_ALLOWED_HOSTS);

  const extra = String(appConfig.extra_allowed_hosts || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  extra.forEach((h) => set.add(h));

  for (const url of [appConfig.exam_portal_url, appConfig.exam_portal_fallback]) {
    try {
      if (url) set.add(new URL(url).hostname.toLowerCase());
    } catch (err) {
      /* abaikan URL rusak */
    }
  }
  return set;
}

function isAllowedNavigation(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (const allowed of allowedHosts()) {
      if (host === allowed || host.endsWith('.' + allowed)) return true;
    }
  } catch (err) {
    /* URL tidak valid */
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* SPLASH SCREEN                                                      */
/* ------------------------------------------------------------------ */

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

  const splashHTML = `<html><body style="margin:0;background:#1e1e1e;color:white;font-family:'Segoe UI',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;border:2px solid #10b981;box-sizing:border-box;">
<h2 style="margin:0 0 10px;color:#10b981;font-size:20px;">Spenforty ExamBrowser</h2>
<p id="status" style="font-size:15px;margin:0;text-align:center;padding:0 24px;line-height:1.5;">Memeriksa pembaruan...</p>
<div style="width:80%;background:#333;height:10px;border-radius:5px;margin-top:20px;overflow:hidden;">
<div id="progress" style="width:0%;background:#10b981;height:100%;transition:width .3s;"></div></div>
<p id="version" style="position:absolute;bottom:10px;right:14px;font-size:11px;color:#666;margin:0;">v${app.getVersion()}</p>
</body></html>`;

  splashReady = new Promise((resolve) => {
    splash.webContents.once('did-finish-load', resolve);
  });

  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHTML));
}

async function updateSplashText(text, percent) {
  if (!splash || splash.isDestroyed()) return;
  try {
    await splashReady;
  } catch (err) {
    /* splash gagal load */
  }
  if (!splash || splash.isDestroyed()) return;

  const payload = JSON.stringify(String(text));
  splash.webContents
    .executeJavaScript(
      `(function(){
        var s = document.getElementById('status');
        var p = document.getElementById('progress');
        if (s) s.innerText = ${payload};
        if (p) p.style.width = '${Number(percent) || 0}%';
      })();`
    )
    .catch(() => {});
}

function registerSplashExitShortcut() {
  if (splashExitShortcutRegistered) return;
  try {
    globalShortcut.register('CommandOrControl+K+L', () => {
      isAllowedToClose = true;
      app.quit();
    });
    splashExitShortcutRegistered = true;
  } catch (err) {
    /* diabaikan */
  }
}

function unregisterSplashExitShortcut() {
  if (!splashExitShortcutRegistered) return;
  try {
    globalShortcut.unregister('CommandOrControl+K+L');
  } catch (err) {
    /* diabaikan */
  }
  splashExitShortcutRegistered = false;
}

/* ------------------------------------------------------------------ */
/* AUTO UPDATER                                                       */
/* ------------------------------------------------------------------ */

// Listener permanen supaya event 'error' tidak pernah tanpa penanganan
autoUpdater.on('error', (err) => {
  console.warn('[update] error:', err && err.message ? err.message : err);
});

autoUpdater.on('download-progress', (p) => {
  const percent = Math.max(10, Math.round(p.percent));
  updateSplashText(`Mengunduh pembaruan... ${Math.round(p.percent)}%`, percent);
});

/**
 * Cek pembaruan dengan batas waktu.
 * @returns {Promise<'none'|'available'|'error'|'timeout'>}
 */
function cekUpdate(timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;

    const onNone = () => finish('none');
    const onAvailable = () => finish('available');
    const onError = () => finish('error');

    function cleanup() {
      clearTimeout(timer);
      autoUpdater.removeListener('update-not-available', onNone);
      autoUpdater.removeListener('update-available', onAvailable);
      autoUpdater.removeListener('error', onError);
    }

    function finish(result) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    }

    const timer = setTimeout(() => finish('timeout'), timeoutMs);

    autoUpdater.once('update-not-available', onNone);
    autoUpdater.once('update-available', onAvailable);
    autoUpdater.once('error', onError);

    autoUpdater.checkForUpdates().catch(onError);
  });
}

/**
 * Menunggu unduhan selesai lalu memasang pembaruan.
 * @returns {Promise<boolean>} true kalau pembaruan berhasil dipasang
 */
function tungguUnduhan(timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;

    function cleanup() {
      clearTimeout(timer);
      autoUpdater.removeListener('update-downloaded', onDownloaded);
      autoUpdater.removeListener('error', onError);
    }

    function finish(ok) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ok);
    }

    function onDownloaded() {
      finish(true);
      updateSplashText('Pembaruan siap. Memasang...', 100);
      isAllowedToClose = true;
      // isSilent=false karena installer NSIS di project ini bersifat assisted
      setTimeout(() => autoUpdater.quitAndInstall(false, true), 1500);
    }

    function onError() {
      finish(false);
    }

    const timer = setTimeout(() => finish(false), timeoutMs);

    autoUpdater.once('update-downloaded', onDownloaded);
    autoUpdater.once('error', onError);
  });
}

/* ------------------------------------------------------------------ */
/* ALUR STARTUP                                                       */
/* ------------------------------------------------------------------ */

async function boot() {
  createSplashWindow();
  registerSplashExitShortcut();

  await updateSplashText('Memeriksa pembaruan aplikasi...', 8);

  if (app.isPackaged) {
    const hasil = await cekUpdate(10000);

    if (hasil === 'available') {
      await updateSplashText('Pembaruan ditemukan, mengunduh...', 12);
      const terpasang = await tungguUnduhan(5 * 60 * 1000);
      if (terpasang) return; // aplikasi akan restart otomatis
      await updateSplashText('Pembaruan gagal, melanjutkan...', 30);
    } else if (hasil === 'timeout' || hasil === 'error') {
      await updateSplashText('Server pembaruan tidak merespons, melanjutkan...', 20);
      await new Promise((r) => setTimeout(r, 700));
    }
  }

  await updateSplashText('Mengambil alamat portal ujian...', 55);
  appConfig = await resolveConfig();

  if (String(appConfig.maintenance).toLowerCase() === 'true') {
    const pesan = appConfig.maintenance_message || 'Ujian belum dibuka. Silakan hubungi pengawas.';
    await updateSplashText(pesan, 100);
    return;
  }

  if (
    appConfig.min_app_version &&
    compareVersions(app.getVersion(), appConfig.min_app_version) < 0
  ) {
    await updateSplashText(
      `Versi aplikasi (${app.getVersion()}) sudah tidak didukung. ` +
        `Diperlukan minimal v${appConfig.min_app_version}. Hubungi pengawas.`,
      100
    );
    return;
  }

  await updateSplashText('Membuka portal ujian...', 100);
  await new Promise((r) => setTimeout(r, 400));
  startExam();
}

function startExam() {
  if (examStarted) return;
  examStarted = true;

  unregisterSplashExitShortcut();
  if (splash && !splash.isDestroyed()) splash.close();
  splash = null;

  createWindow();
}

/* ------------------------------------------------------------------ */
/* JENDELA UJIAN                                                      */
/* ------------------------------------------------------------------ */

function injectToolbar() {
  if (!win || win.isDestroyed()) return;
  const toolbarPath = path.join(__dirname, 'toolbar.js');
  if (!fs.existsSync(toolbarPath)) return;

  const toolbarCode = fs.readFileSync(toolbarPath, 'utf8');
  const payload = JSON.stringify({
    homeUrl: appConfig.exam_portal_url,
    fallbackUrl: appConfig.exam_portal_fallback,
    version: app.getVersion()
  });

  win.webContents
    .executeJavaScript(`window.__EXAM_CONFIG__ = ${payload};\n${toolbarCode}`)
    .catch(() => {});
}

async function clearSessionAndRelogin() {
  if (!win || win.isDestroyed()) return;
  try {
    await win.webContents.session.clearStorageData();
    await win.webContents.session.clearCache();
    await win.webContents.session.clearAuthCache();
    setTimeout(() => {
      if (win && !win.isDestroyed()) win.loadURL(GOOGLE_LOGOUT_AND_LOGIN);
    }, 500);
  } catch (err) {
    console.error('Gagal menghapus sesi:', err);
    if (win && !win.isDestroyed()) win.loadURL(GOOGLE_LOGOUT_AND_LOGIN);
  }
}

function triggerCheatAlarm() {
  if (!win || win.isDestroyed() || isAllowedToClose || isCheatDetected) return;
  isCheatDetected = true;

  shell.beep();
  win.restore();
  win.setAlwaysOnTop(true, 'screen-saver');
  win.focus();

  win.webContents
    .executeJavaScript(
      `
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
  `
    )
    .catch(() => {});
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

  win.webContents.setUserAgent(CHROME_UA);

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const headers = Object.assign({}, details.responseHeaders);
    delete headers['content-security-policy'];
    delete headers['Content-Security-Policy'];
    callback({ responseHeaders: headers });
  });

  win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.toLowerCase().includes(SWITCH_TRIGGER)) {
      clearSessionAndRelogin();
      callback({ cancel: true });
      return;
    }
    callback({});
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.toLowerCase().includes(SWITCH_TRIGGER)) {
      clearSessionAndRelogin();
      return { action: 'deny' };
    }
    if (isAllowedNavigation(url)) {
      win.loadURL(url);
    } else {
      console.warn('[nav] tautan diblokir:', url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('did-finish-load', () => {
    const url = win.webContents.getURL();
    if (url.includes('myaccount.google.com') || url.includes('google.com/account')) {
      win.webContents
        .executeJavaScript(`
        document.body.innerHTML = '<div style="background:white; height:100vh; width:100vw; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:sans-serif; color:#333;"> <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" style="margin-bottom:20px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> <h2 style="margin:0">Sesi Login Berhasil</h2> <p style="color:#666">Silahkan klik tombol <b>Halaman Awal</b> untuk kembali ke ujian.</p></div>';
        document.body.style.background = 'white';
      `)
        .catch(() => {});
    }

    isCheatDetected = false;
    setTimeout(injectToolbar, 300);
  });

  win.loadURL(appConfig.exam_portal_url);

  win.webContents.on('before-input-event', (event, input) => {
    const key = input.key.toLowerCase();
    const pressedKeys = win.__pressedKeys || (win.__pressedKeys = new Set());

    if (input.type === 'keyDown') {
      pressedKeys.add(key);
    } else if (input.type === 'keyUp') {
      pressedKeys.delete(key);
    }

    // 1. TOMBOL KELUAR: CTRL + K + L
    if (input.control && pressedKeys.has('k') && pressedKeys.has('l')) {
      isAllowedToClose = true;
      app.quit();
    }

    // 2. RELOAD: CTRL + R
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
    if ((input.control && (key === 'c' || key === 'v')) || key === 'f5' || key === 'f12') {
      event.preventDefault();
    }
  });

  win.on('minimize', () => {
    if (win && !win.isDestroyed()) {
      win.restore();
      win.focus();
    }
  });

  win.on('blur', () => {
    if (win && win.__pressedKeys) win.__pressedKeys.clear();
    triggerCheatAlarm();
  });

  win.on('close', (e) => {
    if (!isAllowedToClose) e.preventDefault();
  });
}

/* ------------------------------------------------------------------ */
/* LIFECYCLE                                                          */
/* ------------------------------------------------------------------ */

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win && !win.isDestroyed()) {
      win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    const globalBlocks = [
      'Alt+Tab',
      'Alt+Esc',
      'Alt+F4',
      'PrintScreen',
      'Super+D',
      'Super+M',
      'Super+Down',
      'Super+Up',
      'Super+Left',
      'Super+Right',
      'Super+Tab'
    ];

    globalBlocks.forEach((accel) => {
      try {
        globalShortcut.register(accel, () => {});
      } catch (err) {
        /* diabaikan */
      }
    });

    boot().catch((err) => {
      console.error('[boot] gagal:', err);
      startExam();
    });
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });
}
