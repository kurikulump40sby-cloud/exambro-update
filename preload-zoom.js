/**
 * preload-zoom.js
 * Berjalan di isolated world jendela ujian. Tugasnya:
 *   1. Menangkap Ctrl + Scroll (wheel) dan mencegah zoom bawaan Chromium.
 *   2. Mengirim arah zoom ke main process lewat IPC.
 *   3. Menjembatani tombol cek pembaruan manual yang ada di teks versi toolbar.
 *
 * Tidak membuka akses Node ke halaman ujian. Yang diekspos ke halaman
 * hanyalah objek kecil `window.examZoom` dan `window.examUpdate`
 * lewat contextBridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

let currentZoom = 1.0;
const listeners = new Set();

// Dengar terus dari preload (bukan cuma saat toolbar memasang callback),
// supaya getZoom() selalu mencerminkan nilai zoom sesungguhnya.
ipcRenderer.on('exam-zoom:changed', (_event, factor) => {
  currentZoom = Number(factor) || 1.0;
  listeners.forEach((cb) => {
    try { cb(currentZoom); } catch (err) { /* listener halaman error: abaikan */ }
  });
});

contextBridge.exposeInMainWorld('examZoom', {
  /** Nilai zoom terakhir yang dikirim main process. */
  getZoom: () => currentZoom,

  /** Reset ke 100% (dipakai tombol label zoom di toolbar). */
  reset: () => ipcRenderer.send('exam-zoom:reset'),

  /** Dipanggil main process setiap kali zoom berubah. */
  onZoomChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    listeners.add(callback);
    callback(currentZoom); // kirim nilai terkini saat baru dipasang
    return () => listeners.delete(callback);
  }
});

/**
 * Isolated world tetap menerima event DOM dari halaman, tapi tidak bisa
 * diubah oleh script halaman. Ini membuat fitur zoom tetap jalan walau
 * portal ujian memasang handler wheel sendiri.
 */
/* ------------------------------------------------------------------ */
/* JEMBATAN PEMBARUAN MANUAL (tombol teks versi di toolbar)            */
/* ------------------------------------------------------------------ */

let lastUpdateStatus = { state: 'idle', message: '', percent: 0 };
const updateListeners = new Set();

ipcRenderer.on('exam-update:status', (_event, status) => {
  lastUpdateStatus = status && status.state
    ? status
    : { state: 'idle', message: '', percent: 0 };
  updateListeners.forEach((cb) => {
    try { cb(lastUpdateStatus); } catch (err) { /* listener halaman error: abaikan */ }
  });
});

contextBridge.exposeInMainWorld('examUpdate', {
  /** Minta main process memeriksa + mengunduh + memasang pembaruan. */
  check: () => ipcRenderer.send('exam-update:check'),

  /** Status terakhir, berguna kalau dialog dibuka ulang. */
  getStatus: () => lastUpdateStatus,

  /** Dipanggil tiap kali ada status baru dari main process. */
  onStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    updateListeners.add(callback);
    return () => updateListeners.delete(callback);
  }
});

window.addEventListener(
  'wheel',
  (event) => {
    if (!event.ctrlKey) return; // scroll biasa: jangan ganggu

    // Matikan zoom bawaan browser supaya tidak dobel dengan setZoomFactor
    // yang dikendalikan main process.
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();

    // deltaY < 0 = scroll ke atas = zoom in
    // deltaY > 0 = scroll ke bawah = zoom out
    if (event.deltaY === 0) return;
    ipcRenderer.send('exam-zoom:delta', event.deltaY < 0 ? 'in' : 'out');
  },
  { capture: true, passive: false }
);
