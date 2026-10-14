(function () {
  if (document.getElementById('exam-toolbar')) return;

  // URL Pemicu (akan ditangkap oleh main.js)
  const TRIGGER_SWITCH_URL = 'http://exambro-switch.local';
  const TRIGGER_HOME_URL = 'https://portalujian-smpn40sby.blogspot.com/';

  // --- 1. INJEKSI CSS UNTUK TAMPILAN ---
  const style = document.createElement('style');
  style.id = 'exam-toolbar-style';
  style.textContent = `
    /* Style Toolbar Atas */
    #exam-toolbar {
      position: fixed; top: 0; left: 0; right: 0; height: 46px;
      background: #333947;
      color: #fff; display: flex; justify-content: space-between; align-items: center;
      padding: 0 20px; z-index: 2147483647; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3); user-select: none; -webkit-user-select: none;
    }
    .tb-left { display: flex; align-items: center; gap: 12px; }
    .tb-logo { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 14px; opacity: 0.9; margin-right: 15px; }
    .tb-btn {
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.05);
      color: #fff; padding: 6px 14px; border-radius: 6px; cursor: pointer;
      font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px;
      transition: all 0.2s ease;
    }
    .tb-btn:hover { background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.15); }
    
    /* PERBAIKAN: Layout Waktu & Tanggal Sejajar (Kiri ke Kanan) */
    .tb-right { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    #tb-time { font-size: 14px; font-weight: bold; font-variant-numeric: tabular-nums; letter-spacing: 0.5px; }
    .tb-divider { opacity: 0.4; margin: 0 2px; }
    #tb-date { font-size: 13px; opacity: 0.8; }

    /* Style Modal / Popup Konfirmasi */
    #exam-modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
      z-index: 2147483646; display: flex; justify-content: center; align-items: center;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      animation: fadeIn 0.2s ease;
    }
    .exam-modal-box {
      background: #fff; color: #334155; padding: 30px; border-radius: 12px;
      text-align: center; max-width: 420px; width: 90%;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
      animation: slideUp 0.3s ease;
    }
    .modal-icon { margin-bottom: 15px; }
    .modal-title { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 10px; }
    .modal-desc { font-size: 14px; color: #64748b; line-height: 1.5; margin-bottom: 20px; }
    .modal-alert {
      padding: 12px 15px; border-radius: 8px; font-size: 13px; margin-bottom: 25px;
      display: flex; align-items: flex-start; gap: 10px; text-align: left;
    }
    .alert-red { background: #fef2f2; color: #b91c1c; border: 1px dashed #fca5a5; }
    .alert-blue { background: #eff6ff; color: #1d4ed8; border: 1px dashed #bfdbfe; }
    .modal-actions { display: flex; gap: 12px; justify-content: center; }
    .btn-modal { padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s; flex: 1; }
    .btn-cancel { background: #e2e8f0; color: #475569; }
    .btn-cancel:hover { background: #cbd5e1; }
    .btn-danger { background: #ef4444; color: #fff; }
    .btn-danger:hover { background: #dc2626; }
    .btn-primary { background: #3b82f6; color: #fff; }
    .btn-primary:hover { background: #2563eb; }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

    body { padding-top: 46px !important; }
  `;
  document.head.appendChild(style);

  // --- 2. BUAT ELEMEN TOOLBAR ---
  const toolbar = document.createElement('div');
  toolbar.id = 'exam-toolbar';
  
  toolbar.innerHTML = `
    <div class="tb-left">
      <div class="tb-logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>
        SPENFORTY EXAM
      </div>
      <button class="tb-btn" id="btn-go-home">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
        Halaman Awal
      </button>
      <button class="tb-btn" id="btn-switch-account">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
        Ganti Akun
      </button>
    </div>
    <div class="tb-right">
      <span id="tb-time">--:--:--</span>
      <span class="tb-divider">|</span>
      <span id="tb-date">Memuat...</span>
    </div>
  `;
  document.body.appendChild(toolbar);

  // --- 3. FUNGSI WAKTU (JAM & TANGGAL) ---
  function updateTime() {
    const now = new Date();
    // Jam (Contoh: 09:30:15)
    const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });
    document.getElementById('tb-time').textContent = timeStr.replace(/\./g, ':'); 
    
    // Tanggal (Contoh: Sabtu, 25 April 2026)
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById('tb-date').textContent = now.toLocaleDateString('id-ID', options);
  }
  setInterval(updateTime, 1000);
  updateTime();

  // --- 4. FUNGSI MODAL POPUP MULTIGUNA ---
  function showModal(config) {
    if (document.getElementById('exam-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'exam-modal-overlay';
    
    overlay.innerHTML = `
      <div class="exam-modal-box">
        <div class="modal-icon">${config.icon}</div>
        <div class="modal-title">${config.title}</div>
        <div class="modal-desc">${config.desc}</div>
        <div class="modal-alert ${config.alertClass}">
          <div style="font-size:16px;">${config.alertIcon}</div>
          <div>${config.alertText}</div>
        </div>
        <div class="modal-actions">
          <button class="btn-modal btn-cancel" id="m-cancel">Batal</button>
          <button class="btn-modal ${config.confirmBtnClass}" id="m-confirm">${config.confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('m-cancel').onclick = () => overlay.remove();
    document.getElementById('m-confirm').onclick = () => {
      window.location.href = config.actionUrl;
    };
  }

  // --- 5. EVENT LISTENER TOMBOL ---
  
  // Tombol Ganti Akun (Modal Biru)
  document.getElementById('btn-switch-account').onclick = () => {
    showModal({
      icon: `<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
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

  // Tombol Halaman Awal (Modal Merah)
  document.getElementById('btn-go-home').onclick = () => {
    showModal({
      icon: `<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
      title: 'Kembali ke Beranda?',
      desc: 'Anda akan keluar dari halaman ujian ini dan kembali ke menu utama Spenforty Exam.',
      alertClass: 'alert-red',
      alertIcon: '⚠️',
      alertText: '<b>PENTING:</b> Pastikan Anda sudah menekan tombol SUBMIT pada Google Form agar jawaban tidak hilang!',
      confirmBtnClass: 'btn-danger',
      confirmText: 'Ya, Ke Halaman Awal',
      actionUrl: TRIGGER_HOME_URL
    });
  };

})();