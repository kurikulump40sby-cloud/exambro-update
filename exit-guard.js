/**
 * exit-guard.js
 * Mengatur kode keluar aplikasi (4 digit angka).
 *
 * Kode asli disimpan di Supabase, tabel private `app_secret` (key `exit_code`).
 * Aplikasi TIDAK pernah menerima kode asli. Yang dikirim ke aplikasi hanya
 * `exit_code_hash` (SHA-256) di app_config, yang diisi otomatis oleh trigger
 * database setiap kali kode diubah.
 *
 * Verifikasi dilakukan sepenuhnya di komputer (offline-first), lalu dibatasi
 * 5 percobaan per 60 detik supaya tidak bisa ditebak berulang-ulang.
 */

const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const crypto = require('crypto');

// Dipakai HANYA kalau belum ada hash tersimpan sama sekali.
const DEFAULT_EXIT_CODE = '4817';

const CODE_LENGTH = 4;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60 * 1000;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

/** Buang semua karakter selain angka, potong jadi 4 digit. */
function normalizeCode(input) {
  return String(input == null ? '' : input)
    .replace(/\D/g, '')
    .slice(0, CODE_LENGTH);
}

const DEFAULT_HASH = sha256(DEFAULT_EXIT_CODE);

/**
 * Membandingkan kode yang diketik dengan hash dari database.
 * @returns {Promise<boolean>}
 */
async function verifyExitCode(code, config) {
  const pin = normalizeCode(code);
  if (pin.length !== CODE_LENGTH) return false;

  const hash = config && config.exit_code_hash;
  if (hash) return sha256(pin) === String(hash).toLowerCase();

  console.warn('[exit] belum ada hash tersimpan, memakai kode bawaan');
  return sha256(pin) === DEFAULT_HASH;
}

/**
 * Menampilkan jendela kode keluar.
 * @returns {Promise<'ok'|null>}
 */
function promptExitCode(parentWin, verify) {
  return new Promise((resolve) => {
    let settled = false;
    let busy = false;
    let attempts = 0;
    let lockedUntil = 0;

    const modal = new BrowserWindow({
      width: 430,
      height: 340,
      frame: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      backgroundColor: '#1e1e1e',
      icon: path.join(__dirname, 'icon.ico'),
      webPreferences: {
        preload: path.join(__dirname, 'preload-exit.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        devTools: false
      }
    });

    modal.setAlwaysOnTop(true, 'screen-saver');

    const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { margin:0; height:100vh; background:#1e1e1e; color:#e5e7eb;
         font-family:'Segoe UI',Tahoma,sans-serif; display:flex; flex-direction:column;
         align-items:center; justify-content:center; border:2px solid #10b981; padding:24px; }
  h1 { font-size:18px; font-weight:600; margin:0 0 6px; color:#10b981; }
  p.sub { font-size:13px; color:#9ca3af; margin:0 0 20px; text-align:center; }
  input { width:100%; padding:14px; font-size:26px; text-align:center; letter-spacing:14px;
          text-indent:14px; font-family:'Consolas',monospace;
          background:#111827; border:1px solid #374151; border-radius:8px; color:#fff; outline:none; }
  input:focus { border-color:#10b981; }
  input:disabled { opacity:.5; }
  button { width:100%; margin-top:14px; padding:12px; font-size:14px; font-weight:600;
           background:#10b981; color:#06281d; border:none; border-radius:8px; cursor:pointer; }
  button:hover { background:#0ea371; }
  button:disabled { background:#374151; color:#9ca3af; cursor:default; }
  #pesan { min-height:20px; margin-top:12px; font-size:13px; color:#f87171; text-align:center; }
  #petunjuk { position:absolute; bottom:10px; font-size:11px; color:#4b5563; }
</style></head>
<body>
  <h1>Kode Keluar</h1>
  <p class="sub">Masukkan 4 digit kode untuk menutup aplikasi</p>
  <input id="kode" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4"
         autocomplete="off" spellcheck="false" placeholder="••••">
  <button id="tombol">Buka Kunci</button>
  <div id="pesan"></div>
  <div id="petunjuk">Esc untuk batal</div>
<script>
  var input = document.getElementById('kode');
  var tombol = document.getElementById('tombol');
  var pesan = document.getElementById('pesan');
  var mengirim = false;

  input.addEventListener('input', function () {
    var bersih = input.value.replace(/[^0-9]/g, '').slice(0, 4);
    if (bersih !== input.value) input.value = bersih;
  });

  function kirim() {
    if (mengirim) return;
    var nilai = input.value.replace(/[^0-9]/g, '');
    if (nilai.length !== 4) { pesan.textContent = 'Kode harus 4 digit angka'; return; }
    mengirim = true;
    input.disabled = true;
    tombol.disabled = true;
    tombol.textContent = 'Memeriksa...';
    pesan.textContent = '';
    window.exitBridge.submit(nilai);
  }

  tombol.onclick = kirim;
  input.onkeydown = function (e) { if (e.key === 'Enter') kirim(); };
  document.onkeydown = function (e) { if (e.key === 'Escape') window.exitBridge.cancel(); };

  window.exitBridge.onResult(function (hasil) {
    mengirim = false;
    input.disabled = false;
    tombol.disabled = false;
    tombol.textContent = 'Buka Kunci';
    if (hasil && hasil.ok) { pesan.style.color = '#10b981'; pesan.textContent = 'Kode benar. Menutup...'; return; }
    pesan.style.color = '#f87171';
    pesan.textContent = (hasil && hasil.pesan) || 'Kode salah';
    input.value = '';
    input.focus();
  });

  window.addEventListener('load', function () { input.focus(); });
</script>
</body></html>`;

    function kirimHasil(payload) {
      if (!modal.isDestroyed()) modal.webContents.send('exit-code:result', payload);
    }

    function finish(value) {
      if (settled) return;
      settled = true;
      ipcMain.removeListener('exit-code:submit', onSubmit);
      ipcMain.removeListener('exit-code:cancel', onCancel);
      if (!modal.isDestroyed()) modal.destroy();
      resolve(value);
    }

    async function onSubmit(_event, code) {
      if (settled || busy) return;

      const now = Date.now();
      if (now < lockedUntil) {
        const sisa = Math.ceil((lockedUntil - now) / 1000);
        kirimHasil({ ok: false, pesan: `Terlalu banyak percobaan. Tunggu ${sisa} detik.` });
        return;
      }

      busy = true;
      let benar = false;
      try {
        benar = await verify(code);
      } catch (err) {
        console.error('[exit] gagal memverifikasi:', err);
      }
      busy = false;

      if (settled) return;

      if (benar) {
        kirimHasil({ ok: true });
        setTimeout(() => finish('ok'), 350);
        return;
      }

      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) {
        attempts = 0;
        lockedUntil = Date.now() + LOCK_MS;
        kirimHasil({ ok: false, pesan: `Kode salah. Terkunci ${LOCK_MS / 1000} detik.` });
        return;
      }
      kirimHasil({ ok: false, pesan: `Kode salah (${attempts}/${MAX_ATTEMPTS})` });
    }

    function onCancel() {
      finish(null);
    }

    ipcMain.on('exit-code:submit', onSubmit);
    ipcMain.on('exit-code:cancel', onCancel);

    modal.on('closed', () => finish(null));

    modal.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    modal.once('ready-to-show', () => {
      modal.show();
      modal.focus();
    });
  });
}

module.exports = {
  promptExitCode,
  verifyExitCode,
  sha256,
  normalizeCode,
  DEFAULT_EXIT_CODE,
  CODE_LENGTH
};
