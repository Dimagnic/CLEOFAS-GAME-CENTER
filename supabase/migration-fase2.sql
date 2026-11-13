-- =====================================================================
-- Cleofas Game Center · CLUB FASE 2: CUPONES Y NOVEDADES
-- Requiere haber ejecutado antes supabase/migration-socios.sql.
-- Supabase → SQL Editor → New query → pega TODO → Run. Se puede repetir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) CUPONES
--    tipo 'monto'      → descuenta hasta $valor (ej. "1 hora gratis" = $35 en horas)
--    tipo 'porcentaje' → descuenta valor % (ej. 20% en snacks)
--    aplica: 'horas' (sesiones), 'snacks' (tienda) o 'todo'
-- ---------------------------------------------------------------------
create or replace function nuevo_codigo_cupon()
returns text
language plpgsql
as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := 'C-';
    for i in 1..6 loop
      c := c || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.cupones where codigo = c);
  end loop;
  return c;
end;
$$;

create table if not exists cupones (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references socios (user_id) on delete cascade,
  codigo text not null unique,
  titulo text not null,
  descripcion text,
  tipo text not null check (tipo in ('monto', 'porcentaje')),
  valor numeric not null check (valor > 0),
  aplica text not null default 'todo' check (aplica in ('horas', 'snacks', 'todo')),
  estado text not null default 'disponible' check (estado in ('disponible', 'usado', 'anulado')),
  vence_at timestamptz,
  usado_at timestamptz,
  usado_en text,             -- dónde se canjeó (ej. "Sesión PC-03", "Tienda")
  descuento_aplicado numeric,
  origen text not null default 'manual',   -- manual, masivo, bienvenida, ascenso…
  lote text,                                -- agrupa cupones emitidos juntos
  creado_por text,
  created_at timestamptz not null default now()
);
-- El código se genera solo (también funciona si la tabla ya existía)
alter table cupones alter column codigo set default nuevo_codigo_cupon();
alter table cupones drop constraint if exists cupones_porcentaje_max;
alter table cupones add constraint cupones_porcentaje_max check (tipo <> 'porcentaje' or valor <= 100);
create index if not exists cupones_socio on cupones (socio_id, estado);
create index if not exists cupones_lote on cupones (lote);

-- Canje seguro: solo una vez, solo si está vigente. Lo usa el panel (equipo).
create or replace function canjear_cupon(p_cupon uuid, p_usado_en text, p_descuento numeric)
returns cupones
language plpgsql
security definer
set search_path = public
as $$
declare
  c cupones;
begin
  if not es_equipo() then raise exception 'Solo el equipo puede canjear cupones'; end if;
  update cupones set estado = 'usado', usado_at = now(), usado_en = left(p_usado_en, 120), descuento_aplicado = p_descuento
  where id = p_cupon and estado = 'disponible' and (vence_at is null or vence_at > now())
  returning * into c;
  if c.id is null then raise exception 'Ese cupón ya se usó, venció o fue anulado'; end if;
  return c;
end;
$$;
revoke all on function canjear_cupon(uuid, text, numeric) from public;
grant execute on function canjear_cupon(uuid, text, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 2) PUBLICACIONES: noticias, eventos, promociones y comunicados
-- ---------------------------------------------------------------------
create table if not exists publicaciones (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'noticia' check (tipo in ('noticia', 'evento', 'promocion', 'comunicado')),
  titulo text not null,
  cuerpo text not null default '',
  imagen_url text,
  fecha_evento timestamptz,       -- para eventos y torneos
  lugar text,
  enlace text,                    -- botón opcional (ej. inscripción por WhatsApp)
  enlace_texto text,
  rango_min_id int references rangos (id) on delete set null, -- null = todos los socios
  destacado boolean not null default false,
  publicado boolean not null default true,
  visible_desde timestamptz,      -- programar
  visible_hasta timestamptz,      -- caducar
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists publicaciones_orden on publicaciones (publicado, destacado desc, created_at desc);

-- Puntos mínimos del rango del socio conectado (para publicaciones exclusivas)
create or replace function mi_nivel()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select r.min_puntos from socios s join rangos r on r.id = s.rango_id where s.user_id = auth.uid()), -1);
$$;
revoke all on function mi_nivel() from public;
grant execute on function mi_nivel() to authenticated;

-- ---------------------------------------------------------------------
-- 3) IMÁGENES de publicaciones (Supabase Storage, bucket público)
-- ---------------------------------------------------------------------
-- Si tu proyecto no permite crear esto desde el editor, el resto del script sigue
-- y en el panel puedes pegar el enlace de una imagen en lugar de subirla.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('publicaciones', 'publicaciones', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists "equipo sube imagenes de publicaciones" on storage.objects;
  drop policy if exists "equipo cambia imagenes de publicaciones" on storage.objects;
  drop policy if exists "equipo borra imagenes de publicaciones" on storage.objects;
  create policy "equipo sube imagenes de publicaciones" on storage.objects
    for insert to authenticated with check (bucket_id = 'publicaciones' and public.es_equipo());
  create policy "equipo cambia imagenes de publicaciones" on storage.objects
    for update to authenticated using (bucket_id = 'publicaciones' and public.es_equipo());
  create policy "equipo borra imagenes de publicaciones" on storage.objects
    for delete to authenticated using (bucket_id = 'publicaciones' and public.es_equipo());
exception when others then
  raise warning 'No se pudo preparar el almacenamiento de imágenes (%). Usa enlaces de imagen.', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) SEGURIDAD
-- ---------------------------------------------------------------------
alter table cupones       enable row level security;
alter table publicaciones enable row level security;

drop policy if exists "socio ve sus cupones" on cupones;
drop policy if exists "equipo gestiona cupones" on cupones;
create policy "socio ve sus cupones" on cupones for select to authenticated using (socio_id = auth.uid() or es_equipo());
create policy "equipo gestiona cupones" on cupones for all to authenticated using (es_equipo()) with check (es_equipo());

drop policy if exists "socio ve publicaciones" on publicaciones;
drop policy if exists "equipo gestiona publicaciones" on publicaciones;
create policy "socio ve publicaciones" on publicaciones for select to authenticated using (
  es_equipo() or (
    publicado
    and (visible_desde is null or visible_desde <= now())
    and (visible_hasta is null or visible_hasta > now())
    and (rango_min_id is null or (select min_puntos from rangos where id = rango_min_id) <= mi_nivel())
  )
);
create policy "equipo gestiona publicaciones" on publicaciones for all to authenticated using (es_equipo()) with check (es_equipo());

revoke all on cupones, publicaciones from anon;
grant select, insert, update, delete on cupones, publicaciones to authenticated;
grant all on cupones, publicaciones to service_role;

-- ---------------------------------------------------------------------
-- 5) COMPROBACIÓN
-- ---------------------------------------------------------------------
select 'cupones' as tabla, count(*)::text as filas from cupones
union all select 'publicaciones', count(*)::text from publicaciones
union all select 'bucket de imágenes', coalesce((select id from storage.buckets where id = 'publicaciones'), 'no creado: usa enlaces de imagen');
