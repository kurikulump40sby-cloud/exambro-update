-- ============================================================
-- Spenforty ExamBrowser v2.2.0
-- Tabel kode keluar aplikasi
-- Jalankan di Supabase -> SQL Editor (project homtgjcruyffvdqzcnca)
-- ============================================================

-- 1. Pastikan pgcrypto tersedia (dipakai untuk membuat hash SHA-256)
create extension if not exists pgcrypto with schema extensions;

-- 2. Tabel private untuk menyimpan kode asli.
--    RLS aktif TANPA policy + grant dicabut => anon key tidak bisa membaca
--    maupun menulis tabel ini sama sekali.
create table if not exists public.app_secret (
  key        text primary key,
  value      text not null,
  keterangan text,
  updated_at timestamptz not null default now()
);

alter table public.app_secret enable row level security;
revoke all on public.app_secret from anon, authenticated;

-- 2. Kode keluar awal. GANTI nilainya lewat Table Editor kapan saja.
insert into public.app_secret (key, value, keterangan)
values ('exit_code', 'UJIAN-SMPN40-2026', 'Kode keluar aplikasi (bisa diubah kapan saja)')
on conflict (key) do nothing;

-- 3. Fungsi verifikasi. Aplikasi mengirim kode, server yang membandingkan.
--    Kode asli tidak pernah dikirim balik ke aplikasi.
create or replace function public.check_exit_code(pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  kode text;
begin
  select value into kode from public.app_secret where key = 'exit_code';
  if kode is null then
    return false;
  end if;
  return kode = pin;
end;
$$;

revoke all on function public.check_exit_code(text) from public;
grant execute on function public.check_exit_code(text) to anon, authenticated;

-- 4. Sinkronkan hash ke app_config supaya aplikasi tetap bisa memverifikasi
--    saat internet mati (memakai cache). Otomatis, tidak perlu diisi manual.
create or replace function public.sync_exit_code_hash()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.app_config (key, value, keterangan)
  values ('exit_code_hash', encode(digest(new.value, 'sha256'), 'hex'), 'Hash kode keluar (otomatis)')
  on conflict (key) do update
    set value = excluded.value,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_exit_code_hash on public.app_secret;

create trigger trg_sync_exit_code_hash
after insert or update of value on public.app_secret
for each row
when (new.key = 'exit_code')
execute function public.sync_exit_code_hash();

-- 5. Isi hash pertama kali (trigger di atas baru aktif setelah dibuat)
update public.app_secret set value = value where key = 'exit_code';

-- 6. Muat ulang cache skema PostgREST
notify pgrst, 'reload schema';

-- ============================================================
-- Verifikasi
-- ============================================================
select key, value from public.app_config where key = 'exit_code_hash';
select public.check_exit_code('UJIAN-SMPN40-2026') as kode_benar,
       public.check_exit_code('salah') as kode_salah;
