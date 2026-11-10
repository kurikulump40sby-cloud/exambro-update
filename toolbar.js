(function () {
  if (document.getElementById('exam-toolbar')) return;

  // --- 1. INJEKSI CSS UNTUK TAMPILAN ---
  const style = document.createElement('style');
  style.id = 'exam-toolbar-style';
  style.textContent = `
    /* Style Toolbar Atas */
    #exam-toolbar {
      position: fixed; top: 0; left: 0; right: 0; height: 46px;
      background: linear-gradient(135deg, #373b44 0%, #4286f4 100%);
      background: #333947; /* Warna gelap solid menyesuaikan gambar */
      color: #fff; display: flex; justify-content: space-between; align-items: center;
      padding: 0 20px; z-index: 2147483647; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3); user-select: none; -webkit-user-select: none;
    }
    .tb-left { display: flex; align-items: center; gap: 12px; }
    .tb-logo { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 14px; opacity: 0.9; margin-right: 15px; }
    .tb-btn {
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.05);
      color: #fff; padding: 6px 14px; border-radius: 6px; cursor: pointer;
      font-size: 13px; font-weight: 500; transition: all 0.2s ease;
      display: flex; align-items: center; gap: 8px;
    }
    .tb-btn:hover { background: rgba(255,255,255,0.2); }
    .tb-right { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #e2e8f0; }
    .tb-time { font-weight: bold; color: #fff; }

    /* Style Overlay & Modal Pop-up */
    #exam-modal-overlay, #exam-update-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); backdrop-filter: blur(5px);
      z-index: 2147483646; display: flex; justify-content: center; align-items: center;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    .exam-modal-box {
      background: #f8fafc; color: #334155; padding: 30px; border-radius: 16px;
      text-align: center; max-width: 420px; width: 90%;
      box-shadow: 0 20px 50px rgba(0,0,0,0.2);
      animation: modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes modalFadeIn {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .modal-icon-container { margin-bottom: 15px; }
    .modal-title { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
    .modal-desc { font-size: 14px; color: #64748b; line-height: 1.5; margin-bottom: 20px; }

    /* Box Peringatan dalam Modal */
    .modal-alert {
      padding: 12px 15px; border-radius: 8px; font-size: 13px; font-weight: 500;
      display: flex; align-items: center; gap: 10px; margin-bottom: 25px; text-align: left;
    }
    .alert-red { background: #fef2f2; color: #b91c1c; border: 1px dashed #fca5a5; }
    .alert-blue { background: #f0fdfa; color: #0f766e; border: 1px dashed #5eead4; }

    /* Tombol Modal */
    .modal-actions { display: flex; gap: 12px; justify-content: center; }
    .btn-modal {
      padding: 10px 24px; border-radius: 8px; border: none; cursor: pointer;
      font-weight: 600; font-size: 14px; transition: 0.2s;
    }
    .btn-cancel { background: #e2e8f0; color: #475569; }
    .btn-cancel:hover { background: #cbd5e1; }
    .btn-danger { background: #ef4444; color: #fff; }
    .btn-danger:hover { background: #dc2626; }
    .btn-primary { background: #0ea5e9; color: #fff; }
    .btn-primary:hover { background: #0284c7; }

    body { padding-top: 46px !important; }
  `;
  document.head.appendChild(style);

  // --- 2. MEMBUAT ELEMEN TOOLBAR ---
  const toolbar = document.createElement('div');
  toolbar.id = 'exam-toolbar';

  // Icon SVG untuk UI
  const iconHome = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
  const iconUser = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
  const iconClock = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;

  toolbar.innerHTML = `
    <div class="tb-left">
      <div class="tb-logo"><div style="width:8px;height:8px;background:#10b981;border-radius:50%;"></div> Spenforty Exam</div>
      <button class="tb-btn" id="btn-go-home">${iconHome} Halaman Awal</button>
      <button class="tb-btn" id="btn-switch-account">${iconUser} Ganti Akun</button>
    </div>
    <div class="tb-right">
      ${iconClock} <span id="exam-time" class="tb-time">--:--:--</span> <span id="exam-date">Memuat tanggal...</span>
    </div>
  `;
  document.body.appendChild(toolbar);

  // --- 3. LOGIKA JAM & TANGGAL REALTIME ---
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  setInterval(() => {
    const now = new Date();
    // Jam (08:26:02)
    document.getElementById('exam-time').textContent = now.toLocaleTimeString('id-ID', { hour12: false });
    // Tanggal (Kamis, 23 April 2026)
    document.getElementById('exam-date').textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }, 1000);

  // --- 3b. ZOOM INDICATOR ---
  // Label zoom diperbarui oleh main process (main.js) melalui executeJavaScript
  // setiap kali zoom berubah. Di sini kita hanya membuat elemennya.
  const zoomLabel = document.createElement('span');
  zoomLabel.id = 'exam-zoom-label';
  zoomLabel.style.cssText = 'background:rgba(255,255,255,0.1); padding:4px 10px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; min-width:50px; text-align:center; transition:all 0.2s ease; border:1px solid rgba(255,255,255,0.05);';
  zoomLabel.title = 'Ctrl + Scroll untuk zoom, Ctrl + 0 untuk reset';
  zoomLabel.textContent = '100%';

  // Fungsi ini dipanggil dari main.js via executeJavaScript untuk update label
  window.__updateZoomLabel = function (factor) {
    var pct = Math.round(factor * 100);
    var el = document.getElementById('exam-zoom-label');
    if (el) el.textContent = pct + '%';
  };

  // Klik label zoom = reset ke 100%
  zoomLabel.onclick = function () {
    if (window.examZoom && typeof window.examZoom.reset === 'function') {
      window.examZoom.reset();
    }
    window.__updateZoomLabel(1.0);
  };

  // Dengar perubahan zoom dari main process lewat contextBridge
  if (window.examZoom && typeof window.examZoom.onZoomChanged === 'function') {
    window.examZoom.onZoomChanged(function (factor) {
      window.__updateZoomLabel(factor);
    });
    window.__updateZoomLabel(window.examZoom.getZoom());
  }

  // Sisipkan label zoom ke toolbar (sebelum jam)
  var tbRight = document.querySelector('.tb-right');
  if (tbRight) {
    var zoomDivider = document.createElement('span');
    zoomDivider.style.cssText = 'opacity:0.3; margin:0 4px;';
    zoomDivider.textContent = '|';
    tbRight.insertBefore(zoomDivider, tbRight.firstChild);
    tbRight.insertBefore(zoomLabel, tbRight.firstChild);
  }

  // --- 3c. TEKS VERSI = TOMBOL CEK PEMBARUAN MANUAL ---
  // Dipakai saat pemeriksaan otomatis waktu startup gagal karena server
  // pembaruan lambat / tidak merespons. Tidak ada tombol bantuan.
  const appVersion = (window.__EXAM_CONFIG__ && window.__EXAM_CONFIG__.version) || '';
  const versionLabel = document.createElement('span');
  versionLabel.id = 'exam-version-label';
  versionLabel.style.cssText = 'background:rgba(255,255,255,0.1); padding:4px 10px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; border:1px solid rgba(255,255,255,0.05);';
  versionLabel.title = 'Klik untuk memeriksa pembaruan aplikasi';
  versionLabel.textContent = 'v' + (appVersion || '?');

  let updateOverlay = null;
  let lastUpdateStatus = null;

  function closeUpdateDialog() {
    if (updateOverlay && updateOverlay.parentNode) {
      updateOverlay.parentNode.removeChild(updateOverlay);
    }
    updateOverlay = null;
  }

  function showUpdateDialog(state, message, percent) {
    if (!updateOverlay) {
      updateOverlay = document.createElement('div');
      updateOverlay.id = 'exam-update-overlay';
      updateOverlay.innerHTML =
        '<div class="exam-modal-box">' +
          '<div class="modal-title" id="upd-title"></div>' +
          '<div class="modal-desc" id="upd-desc"></div>' +
          '<div id="upd-progress"></div>' +
          '<div id="upd-alert"></div>' +
          '<div class="modal-actions" id="upd-actions"></div>' +
        '</div>';
      document.body.appendChild(updateOverlay);
    }

    let title = 'Pembaruan aplikasi';
    let desc = message || '';
    let alertHtml = '';
    let actions = '';
    let showProgress = false;
    let pct = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));

    if (state === 'confirm') {
      title = 'Periksa pembaruan?';
      desc = 'Aplikasi akan menghubungi server untuk mencari versi terbaru. Jika tersedia, berkas diunduh dan dipasang otomatis, lalu aplikasi dibuka kembali.';
      alertHtml = '<div class="modal-alert alert-blue"><div>i</div><div>Gunakan tombol ini bila pemeriksaan otomatis gagal karena koneksi lambat atau tidak stabil.</div></div>';
      actions = '<button class="btn-modal btn-cancel" id="upd-no">Tidak</button>' +
                '<button class="btn-modal btn-primary" id="upd-yes">Ya, Periksa</button>';
    } else if (state === 'checking') {
      title = 'Memeriksa pembaruan...';
      desc = message || 'Menghubungi server pembaruan. Mohon tunggu...';
      showProgress = true;
      pct = 10;
      actions = '<button class="btn-modal btn-cancel" id="upd-no">Tutup</button>';
    } else if (state === 'downloading') {
      title = 'Mengunduh pembaruan...';
      desc = message || 'Jangan menutup aplikasi selama proses berlangsung.';
      showProgress = true;
      actions = '<button class="btn-modal btn-cancel" id="upd-no">Tutup</button>';
    } else if (state === 'installing') {
      title = 'Pembaruan siap dipasang';
      desc = message || 'Aplikasi akan ditutup dan dibuka kembali secara otomatis.';
      showProgress = true;
      pct = 100;
    } else if (state === 'latest') {
      title = 'Sudah versi terbaru';
      desc = message || 'Aplikasi Anda sudah menggunakan versi paling baru.';
      actions = '<button class="btn-modal btn-primary" id="upd-no">Tutup</button>';
    } else if (state === 'error') {
      title = 'Server pembaruan belum merespons';
      desc = message || 'Koneksi ke server pembaruan gagal. Periksa internet lalu coba lagi.';
      alertHtml = '<div class="modal-alert alert-red"><div>!</div><div>Ujian tetap dapat dilanjutkan. Pembaruan bisa dicoba lagi kapan saja lewat tombol versi.</div></div>';
      actions = '<button class="btn-modal btn-cancel" id="upd-no">Tutup</button>' +
                '<button class="btn-modal btn-primary" id="upd-retry">Coba Lagi</button>';
    } else if (state === 'dev') {
      title = 'Mode pengembangan';
      desc = message || 'Pemeriksaan pembaruan hanya berjalan pada aplikasi yang dipasang lewat installer.';
      actions = '<button class="btn-modal btn-primary" id="upd-no">Tutup</button>';
    }

    document.getElementById('upd-title').textContent = title;
    document.getElementById('upd-desc').textContent = desc;
    document.getElementById('upd-alert').innerHTML = alertHtml;

    const progressEl = document.getElementById('upd-progress');
    if (showProgress) {
      if (!document.getElementById('upd-progress-wrap')) {
        progressEl.innerHTML =
          '<div id="upd-progress-wrap" style="width:100%;background:#e2e8f0;height:8px;border-radius:5px;overflow:hidden;margin:4px 0 18px;">' +
            '<div id="upd-bar" style="width:0%;background:#10b981;height:100%;transition:width .3s;"></div>' +
          '</div>';
      }
      document.getElementById('upd-bar').style.width = pct + '%';
    } else {
      progressEl.innerHTML = '';
    }

    document.getElementById('upd-actions').innerHTML = actions;

    const btnNo = document.getElementById('upd-no');
    if (btnNo) btnNo.onclick = closeUpdateDialog;
    const btnYes = document.getElementById('upd-yes');
    if (btnYes) btnYes.onclick = requestUpdateCheck;
    const btnRetry = document.getElementById('upd-retry');
    if (btnRetry) btnRetry.onclick = requestUpdateCheck;
  }

  function requestUpdateCheck() {
    if (!window.examUpdate || typeof window.examUpdate.check !== 'function') {
      showUpdateDialog('error', 'Fitur pembaruan tidak tersedia pada halaman ini.', 0);
      return;
    }
    showUpdateDialog('checking', 'Menghubungi server pembaruan. Mohon tunggu...', 10);
    window.examUpdate.check();
  }

  versionLabel.onclick = function () {
    // Kalau pemeriksaan masih berjalan dan kotaknya tadi ditutup,
    // tampilkan lagi status terakhir, jangan mulai pemeriksaan baru.
    if (!updateOverlay && lastUpdateStatus &&
        ['checking', 'downloading', 'installing'].indexOf(lastUpdateStatus.state) !== -1) {
      showUpdateDialog(lastUpdateStatus.state, lastUpdateStatus.message, lastUpdateStatus.percent);
      return;
    }
    showUpdateDialog('confirm');
  };

  const verTbRight = document.querySelector('.tb-right');
  if (verTbRight) {
    const verDivider = document.createElement('span');
    verDivider.style.cssText = 'opacity:0.3; margin:0 4px;';
    verDivider.textContent = '|';
    verTbRight.appendChild(verDivider);
    verTbRight.appendChild(versionLabel);
  }

  if (window.examUpdate && typeof window.examUpdate.onStatus === 'function') {
    window.examUpdate.onStatus(function (status) {
      if (!status || status.state === 'idle') return;
      lastUpdateStatus = status;
      if (!updateOverlay) return; // "Tidak" sudah dipilih: abaikan status
      showUpdateDialog(status.state, status.message, status.percent);
    });
  }

  // --- 4. FUNGSI PEMBUAT MODAL DINAMIS ---
  // Alamat portal diambil dari konfigurasi Supabase (lihat config.js),
  // bukan ditulis di sini lagi. Fallback hanya untuk jaga-jaga.
  const CFG = window.__EXAM_CONFIG__ || {};
  const HOME_URL = CFG.homeUrl || 'https://tka.smp-kotasurabaya.org/ujian';
  const TRIGGER_SWITCH_URL = 'https://exambro-switch.local';

  function showModal(config) {
    const overlay = document.createElement('div');
    overlay.id = 'exam-modal-overlay';

    overlay.innerHTML = `
      <div class="exam-modal-box">
        <div class="modal-icon-container">
          ${config.icon}
        </div>
        <div class="modal-title">${config.title}</div>
        <div class="modal-desc">${config.desc}</div>

        <div class="modal-alert ${config.alertClass}">
          <div>${config.alertIcon}</div>
          <div>${config.alertText}</div>
        </div>

        <div class="modal-actions">
          <button class="btn-modal btn-cancel" id="modal-btn-cancel">Batal</button>
          <button class="btn-modal ${config.confirmBtnClass}" id="modal-btn-confirm">${config.confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('modal-btn-cancel').onclick = () => overlay.remove();
    document.getElementById('modal-btn-confirm').onclick = () => {
      window.onbeforeunload = null; // Matikan peringatan leave site bawaan browser
      window.location.href = config.actionUrl;
    };
  }

  // --- 5. EVENT LISTENER TOMBOL ---

  // Tombol Ganti Akun (Sesuai Gambar 3)
  document.getElementById('btn-switch-account').onclick = () => {
    showModal({
      icon: `<svg width="50" height="50" viewBox="0 0 24 24" fill="#64748b"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z"/></svg>`,
      title: 'Ganti Akun Google?',
      desc: 'Anda akan diarahkan ke halaman pemilihan akun Google untuk login dengan akun yang berbeda.',
      alertClass: 'alert-blue',
      alertIcon: '📋',
      alertText: 'Pastikan jawaban ujian sudah disimpan sebelum melanjutkan!',
      confirmBtnClass: 'btn-primary',
      confirmText: 'Ganti Akun',
      actionUrl: TRIGGER_SWITCH_URL
    });
  };

  // Tombol Halaman Awal (Sesuai Gambar 2)
  document.getElementById('btn-go-home').onclick = () => {
    showModal({
      icon: `<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      title: 'Kembali ke Halaman Awal?',
      desc: 'Anda akan diarahkan kembali ke halaman awal portal ujian Spenforty.',
      alertClass: 'alert-red',
      alertIcon: '🚨',
      alertText: 'Perhatian: Jawaban yang belum disimpan pada formulir ujian akan <b>HILANG!</b>',
      confirmBtnClass: 'btn-danger',
      confirmText: 'Ya, Kembali',
      actionUrl: HOME_URL
    });
  };

})();
