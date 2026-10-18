/**
 * config.js
 * Mengambil konfigurasi aplikasi (alamat portal ujian, dll) dari Supabase.
 *
 * Prioritas sumber konfigurasi:
 *   1. Supabase (tabel public.app_config)  -> selalu jadi acuan utama
 *   2. Cache lokal (userData/portal-config.json) -> dipakai kalau internet mati
 *   3. DEFAULT_CONFIG di bawah             -> cadangan terakhir
 *
 * Ganti alamat portal TIDAK perlu build ulang aplikasi.
 * Cukup edit baris 'exam_portal_url' di Table Editor Supabase.
 */

const fs = require('fs');
const path = require('path');
const { app, net } = require('electron');

const SUPABASE_URL = 'https://homtgjcruyffvdqzcnca.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvbXRnamNydXlmZnZkcXpjbmNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMjI5MjIsImV4cCI6MjEwNzg5ODkyMn0.jqfV_GWAwBakPofdUifgSbbXgPjbwPlGXnEasG99Bkk';

// Anon key aman ditanam di aplikasi: RLS hanya mengizinkan SELECT.
// Aplikasi tidak mungkin mengubah isi tabel (ditolak 401).

const FETCH_TIMEOUT_MS = 6000;

// Dipakai HANYA kalau Supabase tidak terjangkau DAN belum ada cache sama sekali.
const DEFAULT_CONFIG = {
  exam_portal_url: 'https://tka.smp-kotasurabaya.org/ujian',
  exam_portal_fallback: 'https://ujikom.pakkar.my.id/2026/10/try-out-tka-sby.html',
  maintenance: 'false',
  maintenance_message: '',
  min_app_version: '2.1.0',
  extra_allowed_hosts: ''
};

function cacheFilePath() {
  return path.join(app.getPath('userData'), 'portal-config.json');
}

function isValidUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch (err) {
    return false;
  }
}

function readCache() {
  try {
    const raw = fs.readFileSync(cacheFilePath(), 'utf8');
    const data = JSON.parse(raw);
    if (data && data.config && isValidUrl(data.config.exam_portal_url)) {
      return data.config;
    }
  } catch (err) {
    // cache belum ada / rusak -> abaikan
  }
  return null;
}

function writeCache(config) {
  try {
    const dir = path.dirname(cacheFilePath());
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      cacheFilePath(),
      JSON.stringify({ savedAt: new Date().toISOString(), config }, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error('[config] gagal menyimpan cache:', err.message);
  }
}

async function fetchRemoteConfig() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await net.fetch(
      `${SUPABASE_URL}/rest/v1/app_config?select=key,value`,
      {
        signal: controller.signal,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Accept: 'application/json'
        }
      }
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('tabel app_config kosong');
    }

    const config = {};
    for (const row of rows) {
      if (row && typeof row.key === 'string') {
        config[row.key] = row.value;
      }
    }
    return config;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveConfig() {
  let config = null;
  let source = 'default';

  try {
    const remote = await fetchRemoteConfig();
    if (isValidUrl(remote.exam_portal_url)) {
      config = { ...DEFAULT_CONFIG, ...remote };
      source = 'supabase';
      writeCache(config);
    } else {
      console.warn('[config] exam_portal_url dari Supabase tidak valid, dilewati');
    }
  } catch (err) {
    console.warn('[config] Supabase tidak terjangkau:', err.message);
  }

  if (!config) {
    const cached = readCache();
    if (cached) {
      config = { ...DEFAULT_CONFIG, ...cached };
      source = 'cache';
    }
  }

  if (!config) {
    config = { ...DEFAULT_CONFIG };
    source = 'default';
  }

  // Kalau URL utama rusak/kosong tapi fallback valid, pakai fallback.
  if (!isValidUrl(config.exam_portal_url) && isValidUrl(config.exam_portal_fallback)) {
    console.warn('[config] memakai URL cadangan');
    config.exam_portal_url = config.exam_portal_fallback;
  }

  console.log(`[config] sumber=${source} portal=${config.exam_portal_url}`);
  return config;
}

module.exports = { resolveConfig, DEFAULT_CONFIG, isValidUrl };
