-- Apartman Plaka Sistemi — Supabase şeması
-- Supabase panelinde: SQL Editor → New query → bu dosyanın tamamını yapıştır → Run.
-- Birden çok kez çalıştırmak güvenlidir (idempotent).

create extension if not exists pgcrypto;

-- ===================== Tablolar =====================
create table if not exists public.profiles (
  id        uuid primary key references auth.users on delete cascade,
  email     text,
  full_name text not null default '',
  role      text not null default 'none' check (role in ('admin', 'guard', 'none'))
);

create table if not exists public.units (
  id         uuid primary key default gen_random_uuid(),
  no         text not null unique,
  owner_name text,
  phone      text,
  note       text
);

create table if not exists public.vehicles (
  id      uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units on delete cascade,
  plate   text not null unique check (plate ~ '^[A-Z0-9]{4,10}$'),
  brand   text,
  color   text,
  note    text,
  active  boolean not null default true
);

create table if not exists public.visitors (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references public.units on delete cascade,
  plate       text not null check (plate ~ '^[A-Z0-9]{4,10}$'),
  name        text,
  valid_from  timestamptz not null,
  valid_until timestamptz not null,
  note        text,
  created_by  uuid references auth.users on delete set null default auth.uid(),
  check (valid_until > valid_from)
);
create index if not exists visitors_plate_idx on public.visitors (plate);

create table if not exists public.lookups (
  id         uuid primary key default gen_random_uuid(),
  plate      text not null,
  status     text not null,
  unit_no    text,
  source     text not null check (source in ('public', 'staff', 'camera')),
  user_id    uuid,
  user_name  text,
  created_at timestamptz not null default now()
);
create index if not exists lookups_created_idx on public.lookups (created_at desc);

create table if not exists public.settings (
  key   text primary key,
  value jsonb not null
);
insert into public.settings (key, value) values
  ('building_name', to_jsonb('Apartmanım'::text)),
  ('public_lookup', to_jsonb(true))
on conflict (key) do nothing;

-- Yeni Auth kullanıcısı gelince profil satırı açılır; rolü yönetici verene kadar 'none' (hiçbir yetkisi yok).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===================== Yetki yardımcıları =====================
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() in ('admin', 'guard'), false)
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() = 'admin', false)
$$;

-- ===================== Tablo yetkileri =====================
-- Yeni Supabase projeleri tablolara otomatik yetki vermeyebilir. Yalnızca GİRİŞ YAPMIŞ kullanıcıya verilir;
-- hangi satırı görüp değiştirebileceğini aşağıdaki RLS kuralları belirler. "anon" (anonim) hiçbir tabloya erişemez.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.units, public.vehicles, public.visitors, public.lookups, public.settings to authenticated;
revoke all on public.profiles, public.units, public.vehicles, public.visitors, public.lookups, public.settings from anon;

-- ===================== Satır güvenliği (RLS) =====================
alter table public.profiles enable row level security;
alter table public.units    enable row level security;
alter table public.vehicles enable row level security;
alter table public.visitors enable row level security;
alter table public.lookups  enable row level security;
alter table public.settings enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read   on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists units_read on public.units;
create policy units_read  on public.units for select to authenticated using (public.is_staff());
drop policy if exists units_write on public.units;
create policy units_write on public.units for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists vehicles_read on public.vehicles;
create policy vehicles_read  on public.vehicles for select to authenticated using (public.is_staff());
drop policy if exists vehicles_write on public.vehicles;
create policy vehicles_write on public.vehicles for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists visitors_read on public.visitors;
create policy visitors_read   on public.visitors for select to authenticated using (public.is_staff());
drop policy if exists visitors_insert on public.visitors;
create policy visitors_insert on public.visitors for insert to authenticated with check (public.is_staff() and created_by = auth.uid());
drop policy if exists visitors_delete on public.visitors;
create policy visitors_delete on public.visitors for delete to authenticated using (public.is_admin() or created_by = auth.uid());
drop policy if exists visitors_update on public.visitors;
create policy visitors_update on public.visitors for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Sorgu geçmişi: yönetici hepsini, görevli yalnızca kendi sorgularını görür. Yazma yalnızca aşağıdaki fonksiyonlarla.
drop policy if exists lookups_read on public.lookups;
create policy lookups_read on public.lookups for select to authenticated
  using (public.is_admin() or (public.is_staff() and user_id = auth.uid()));
drop policy if exists lookups_clear on public.lookups;
create policy lookups_clear on public.lookups for delete to authenticated using (public.is_admin());

drop policy if exists settings_read on public.settings;
create policy settings_read  on public.settings for select to authenticated using (public.is_staff());
drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===================== Sorgu fonksiyonları =====================
create or replace function public._norm(p text) returns text language sql immutable as $$
  select regexp_replace(upper(translate(coalesce(p, ''), 'ıİşŞğĞüÜöÖçÇ', 'iIsSgGuUoOcC')), '[^A-Z0-9]', '', 'g')
$$;

-- Çekirdek: tüm bilgiyi döndürür; yalnızca diğer fonksiyonlar çağırır (dışarıya açık değil).
create or replace function public._lookup_core(p text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  pl text := public._norm(p);
  v record; z record; u record;
begin
  select * into v from public.vehicles where plate = pl;
  if found then
    select * into u from public.units where id = v.unit_id;
    return jsonb_build_object('status', case when v.active then 'resident' else 'inactive' end,
      'unit_no', u.no, 'unit_id', u.id, 'brand', v.brand, 'color', v.color,
      'owner_name', u.owner_name, 'phone', u.phone, 'note', v.note);
  end if;

  select * into z from public.visitors
   where plate = pl and valid_from <= now() and now() <= valid_until order by valid_until desc limit 1;
  if found then
    select * into u from public.units where id = z.unit_id;
    return jsonb_build_object('status', 'visitor', 'unit_no', u.no, 'unit_id', u.id, 'valid_until', z.valid_until,
      'visitor_name', z.name, 'owner_name', u.owner_name, 'phone', u.phone, 'note', z.note);
  end if;

  select * into z from public.visitors where plate = pl order by valid_until desc limit 1;
  if found then
    select * into u from public.units where id = z.unit_id;
    return jsonb_build_object('status', 'expired', 'unit_no', u.no, 'unit_id', u.id, 'valid_until', z.valid_until,
      'visitor_name', z.name, 'owner_name', u.owner_name, 'phone', u.phone, 'note', z.note);
  end if;

  return jsonb_build_object('status', 'unknown');
end $$;

-- Herkese açık sorgu (giriş gerekmez): ad ve telefon ASLA dönmez. Dakikada en çok 30 sorgu (toplam) — tarama saldırısını yavaşlatır.
create or replace function public.public_lookup(p text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; pl text := public._norm(p);
begin
  if not coalesce((select (value)::boolean from public.settings where key = 'public_lookup'), false) then
    raise exception 'public_disabled';
  end if;
  if length(pl) < 4 or length(pl) > 10 then raise exception 'bad_plate'; end if;
  if (select count(*) from public.lookups where source = 'public' and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited';
  end if;
  r := public._lookup_core(pl);
  insert into public.lookups (plate, status, unit_no, source) values (pl, r->>'status', r->>'unit_no', 'public');
  return jsonb_build_object(
    'status', r->>'status',
    'unit_no', r->'unit_no',
    'brand', case when r->>'status' = 'resident' then r->'brand' end,
    'color', case when r->>'status' = 'resident' then r->'color' end,
    'valid_until', r->'valid_until');
end $$;

-- Görevli/yönetici sorgusu: ad ve telefon dahil.
create or replace function public.staff_lookup(p text, src text default 'staff') returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; pl text := public._norm(p); nm text;
begin
  if not public.is_staff() then raise exception 'not_allowed'; end if;
  r := public._lookup_core(pl);
  select coalesce(nullif(full_name, ''), email) into nm from public.profiles where id = auth.uid();
  insert into public.lookups (plate, status, unit_no, source, user_id, user_name)
  values (pl, r->>'status', r->>'unit_no', case when src = 'camera' then 'camera' else 'staff' end, auth.uid(), nm);
  return r;
end $$;

create or replace function public.public_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'building_name', coalesce((select value #>> '{}' from public.settings where key = 'building_name'), 'Apartmanım'),
    'public_lookup', coalesce((select (value)::boolean from public.settings where key = 'public_lookup'), false))
$$;

-- Fonksiyon yetkileri: varsayılan "herkes çalıştırır" kaldırılır, gerekenlere verilir.
revoke all on function public._lookup_core(text), public._norm(text), public.staff_lookup(text, text),
  public.public_lookup(text), public.public_settings(), public.app_role(), public.is_staff(), public.is_admin() from public;
grant execute on function public.public_lookup(text), public.public_settings() to anon, authenticated;
grant execute on function public.staff_lookup(text, text) to authenticated;
grant execute on function public.app_role(), public.is_staff(), public.is_admin() to authenticated;
grant execute on function public._norm(text) to authenticated, anon;

-- ===================== İlk yönetici =====================
-- 1) Supabase → Authentication → Users → "Add user" ile kendi e-posta/şifrenle kullanıcı oluştur (Auto Confirm işaretli).
-- 2) Aşağıdaki satırı kendi e-postanla çalıştır:
--    update public.profiles set role = 'admin', full_name = 'Adınız' where email = 'sizin@eposta.com';
-- Kapıcı/güvenlik hesapları da aynı şekilde açılır; uygulamadaki "Kullanıcılar" ekranından rolleri 'guard' yapılır.
-- Ayrıca Authentication → Sign In / Providers → "Allow new users to sign up" KAPALI olmalı.
