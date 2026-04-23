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
    #exam-modal-overlay {
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

  // --- 4. FUNGSI PEMBUAT MODAL DINAMIS ---
  const HOME_URL = 'https://portalujian-smpn40sby.blogspot.com/';
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