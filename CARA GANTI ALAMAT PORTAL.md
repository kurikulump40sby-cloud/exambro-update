# Panduan Pengaturan Spenforty ExamBrowser

Sejak versi **2.1.0**, alamat portal ujian tidak lagi ditulis di dalam aplikasi.
Alamat diambil dari database Supabase setiap kali aplikasi dibuka.

Artinya: **ganti alamat = edit 1 baris di Supabase, tanpa build ulang, tanpa update aplikasi.**

---

## Langkah mengganti alamat

1. Buka https://supabase.com/dashboard
2. Pilih project **homtgjcruyffvdqzcnca**
3. Menu kiri: **Table Editor** → tabel **app_config**
4. Cari baris dengan key `exam_portal_url`
5. Ubah kolom `value` menjadi alamat baru, contoh:
   `https://tka.smp-kotasurabaya.org/ujian`
6. Tekan **Save** (Ctrl+S)

Selesai. Semua komputer akan memakai alamat baru pada pembukaan aplikasi berikutnya.

---

## Daftar pengaturan yang tersedia

| Key | Isi | Keterangan |
|---|---|---|
| `exam_portal_url` | URL | Alamat portal ujian utama |
| `exam_portal_fallback` | URL | Dipakai otomatis kalau `exam_portal_url` kosong/rusak |
| `maintenance` | `true` / `false` | `true` = aplikasi berhenti di layar splash dengan pesan, portal tidak dibuka |
| `maintenance_message` | teks | Pesan yang tampil saat maintenance |
| `min_app_version` | contoh `2.1.0` | Versi minimum aplikasi. Versi lebih lama akan menolak dibuka |
| `extra_allowed_hosts` | `domain1.com,domain2.com` | Domain tambahan yang boleh dibuka dari dalam halaman ujian (pisahkan dengan koma) |
| `exit_code_hash` | *(otomatis)* | Hash kode keluar. **Jangan diedit manual** — terisi sendiri saat kode diubah |

> **Penting:** `min_app_version` jangan dinaikkan sebelum versi barunya benar-benar
> terpasang di komputer lab. Kalau dinaikkan terlalu cepat, aplikasi lama akan menolak dibuka.

---

## Mengganti kode keluar aplikasi

Kode keluar disimpan di tabel **`app_secret`** (bukan `app_config`), supaya tidak bisa
dibaca siswa meskipun mereka membongkar file aplikasi.

1. Supabase → **Table Editor** → tabel **`app_secret`**
2. Baris dengan key `exit_code` → ubah kolom `value`
3. **Save**

Selesai. Hash untuk mode offline (`exit_code_hash` di `app_config`) ikut ter-update
otomatis oleh trigger database — tidak perlu diisi manual.

**Cara memakai di komputer lab:**

1. Tekan `Ctrl + K + L`
2. Muncul jendela "Kode Keluar"
3. Masukkan kode → aplikasi tertutup

Kalau salah 5 kali, dialog terkunci 60 detik. Tekan `Esc` untuk membatalkan.

> **Saran:** pakai kode yang panjang (minimal 10 karakter, campur huruf dan angka).
> Kode pendek seperti `1234` bisa ditebak, karena verifikasi bisa dicoba berulang.

> **Kalau kode lupa:** buka Supabase, lihat/ubah di tabel `app_secret`.
> Kalau sedang offline dan kode lupa, satu-satunya jalan adalah install ulang aplikasi.
> Jadi catat kodenya di tempat aman.

---

## Kalau internet mati saat ujian

Aplikasi tetap bisa dibuka. Alamat terakhir yang berhasil diambil disimpan di:

```
%APPDATA%\Spenforty-ExamBrowser\portal-config.json
```

Urutan yang dipakai aplikasi:

1. Ambil dari Supabase
2. Kalau gagal → pakai cache terakhir di file di atas
3. Kalau cache belum ada → pakai alamat bawaan di dalam aplikasi

---

## Keamanan

- Kunci yang tertanam di aplikasi adalah **anon public key**. Ini memang dirancang publik.
- Row Level Security hanya mengizinkan **SELECT**.
- Percobaan menulis/mengubah data dari aplikasi akan ditolak (`permission denied`).
- Mengubah isi tabel hanya bisa lewat dashboard Supabase (akun pemilik project).

---

## Alur pembaruan aplikasi

Setiap kali dibuka, aplikasi:

1. Menampilkan splash
2. Cek rilis terbaru di https://github.com/kurikulump40sby-cloud/exambro-update/releases
3. Kalau ada versi baru → unduh (progress bar di splash) → pasang → aplikasi restart sendiri
4. Kalau tidak ada / server tidak merespons → lanjut ambil konfigurasi dari Supabase
5. Buka portal ujian

### Merilis versi baru

```bash
# 1. naikkan nomor versi di package.json (wajib, kalau tidak updater tidak jalan)
# 2. build + upload otomatis ke GitHub Releases
set GH_TOKEN=<token github>
npm run publish
```

Yang harus terunggah di setiap rilis: `latest.yml`, `Spenforty-ExamBrowser-Setup-<versi>.exe`,
dan file `.exe.blockmap`.

### Keluar dari aplikasi

`Ctrl + K + L` → masukkan kode keluar. Berlaku saat jendela ujian aktif maupun saat macet di splash.

### Verifikasi kode keluar

| Kondisi | Cara verifikasi |
|---|---|
| Online | Aplikasi bertanya ke server Supabase. Kode asli tidak pernah dikirim ke aplikasi. |
| Offline | Dibandingkan dengan hash terakhir yang tersimpan di cache |
| Belum pernah ada cache | Memakai kode bawaan `UJIAN-SMPN40-2026` |

Kode bawaan hanya berlaku sekali, sebelum aplikasi pernah berhasil mengambil konfigurasi
dari Supabase. Setelah itu selalu memakai kode dari database.
