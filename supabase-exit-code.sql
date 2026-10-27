-- ============================================================
-- Spenforty ExamBrowser v2.2.0
-- Tabel kode keluar aplikasi (4 digit angka)
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

-- 3. Jaga format kode: harus tepat 4 digit angka.
--    Kalau salah ketik (3 digit, 5 digit, atau ada huruf), Supabase menolak simpan.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'app_secret_exit_code_format'
  ) then
    alter table public.app_secret
      add constraint app_secret_exit_code_format
      check (key <> 'exit_code' or value ~ '^[0-9]{4}$');
  end if;
end $$;

-- 4. Kode keluar awal: 4817
--    GANTI lewat Table Editor -> app_secret -> baris exit_code.
insert into public.app_secret (key, value, keterangan)
values ('exit_code', '4817', 'Kode keluar aplikasi (4 digit angka)')
on conflict (key) do nothing;

-- 5. Sinkronkan hash ke app_config setiap kali kode berubah.
--    Aplikasi hanya menerima hash ini, bukan kode aslinya.
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

-- 6. Isi hash pertama kali (trigger di atas baru aktif setelah dibuat)
update public.app_secret set value = value where key = 'exit_code';

-- 7. Muat ulang cache skema PostgREST
notify pgrst, 'reload schema';

-- ============================================================
-- Verifikasi
-- ============================================================
select value as kode_keluar from public.app_secret where key = 'exit_code';
select value as hash_tersimpan from public.app_config where key = 'exit_code_hash';
