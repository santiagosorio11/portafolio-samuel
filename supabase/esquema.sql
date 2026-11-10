-- Galería Sam Velásquez: tabla de obras, bucket de fotos y permisos.
-- Pegar completo en Supabase > SQL Editor y ejecutar una sola vez.

-- 1. Quién puede administrar -------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

drop policy if exists "cada admin se ve a si mismo" on public.admins;
create policy "cada admin se ve a si mismo" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to anon, authenticated;

-- 2. Obras ------------------------------------------------------------------
create table if not exists public.obras (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titulo text not null check (char_length(titulo) between 1 and 120),
  tecnica text not null default '' check (char_length(tecnica) <= 160),
  soporte text not null default 'lienzo' check (soporte in ('lienzo', 'madera', 'escultura', 'otro')),
  ancho_cm numeric(6, 1) check (ancho_cm > 0),
  alto_cm numeric(6, 1) check (alto_cm > 0),
  anio integer check (anio between 1990 and 2100),
  historia text not null default '' check (char_length(historia) <= 3000),
  precio text check (char_length(precio) <= 60),
  vendida boolean not null default false,
  visible boolean not null default true,
  destacada boolean not null default false,
  orden integer not null default 0,
  imagen_path text not null,
  imagen_ancho integer not null check (imagen_ancho > 0),
  imagen_alto integer not null check (imagen_alto > 0),
  paleta text[] not null default '{}',
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists obras_orden_idx on public.obras (orden);

create or replace function public.tocar_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado := now();
  return new;
end;
$$;
drop trigger if exists obras_actualizado on public.obras;
create trigger obras_actualizado before update on public.obras
  for each row execute function public.tocar_actualizado();

alter table public.obras enable row level security;

drop policy if exists "todos ven las obras visibles" on public.obras;
create policy "todos ven las obras visibles" on public.obras
  for select to anon, authenticated using (visible or (select public.es_admin()));

drop policy if exists "admin crea obras" on public.obras;
create policy "admin crea obras" on public.obras
  for insert to authenticated with check ((select public.es_admin()));

drop policy if exists "admin edita obras" on public.obras;
create policy "admin edita obras" on public.obras
  for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));

drop policy if exists "admin borra obras" on public.obras;
create policy "admin borra obras" on public.obras
  for delete to authenticated using ((select public.es_admin()));

-- 3. Bucket de fotos (lectura pública, escritura solo admin) ------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('obras', 'obras', true, 10485760, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin lista fotos de obras" on storage.objects;
create policy "admin lista fotos de obras" on storage.objects
  for select to authenticated using (bucket_id = 'obras' and (select public.es_admin()));

drop policy if exists "admin sube fotos de obras" on storage.objects;
create policy "admin sube fotos de obras" on storage.objects
  for insert to authenticated with check (bucket_id = 'obras' and (select public.es_admin()));

drop policy if exists "admin cambia fotos de obras" on storage.objects;
create policy "admin cambia fotos de obras" on storage.objects
  for update to authenticated using (bucket_id = 'obras' and (select public.es_admin()));

drop policy if exists "admin borra fotos de obras" on storage.objects;
create policy "admin borra fotos de obras" on storage.objects
  for delete to authenticated using (bucket_id = 'obras' and (select public.es_admin()));

-- 4. Dar acceso a Samuel -----------------------------------------------------
-- Primero crea su usuario en Authentication > Users > Add user (marca "Auto Confirm User").
-- Luego cambia el correo y ejecuta solo esta línea:
-- insert into public.admins (user_id) select id from auth.users where email = 'CORREO-DE-SAMUEL';
