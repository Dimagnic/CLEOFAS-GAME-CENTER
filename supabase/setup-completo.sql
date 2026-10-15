-- =====================================================================
-- Cleofas Game Center · BASE DE DATOS COMPLETA (un solo script)
-- Pégalo TODO en Supabase → SQL Editor → New query → Run.
-- Es seguro repetirlo: no borra reservaciones, cierres ni estados de estaciones.
-- Reemplaza a schema.sql, migration-pagos.sql, migration-estaciones*.sql.
-- =====================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- 1) TABLAS
-- ---------------------------------------------------------------------

-- Reservaciones en línea (las crea SOLO el servidor /api/checkout)
create table if not exists reservaciones (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  cliente text not null,
  estacion text not null,
  fecha date not null,
  hora time not null,
  duracion_h int not null default 1,
  estado text not null default 'pendiente',
  created_at timestamptz not null default now()
);
alter table reservaciones add column if not exists email text;
alter table reservaciones add column if not exists telefono text;
alter table reservaciones add column if not exists inicio timestamptz;
alter table reservaciones add column if not exists fin timestamptz;
alter table reservaciones add column if not exists monto numeric not null default 0;
alter table reservaciones add column if not exists expires_at timestamptz;
alter table reservaciones add column if not exists paid_at timestamptz;
alter table reservaciones add column if not exists stripe_session_id text unique;
alter table reservaciones add column if not exists stripe_payment_intent_id text;

alter table reservaciones drop constraint if exists reservaciones_estado_check;
alter table reservaciones add constraint reservaciones_estado_check
  check (estado in ('pendiente', 'pendiente_pago', 'confirmada', 'cancelada', 'expirada'));

-- Imposible reservar la misma estación dos veces en el mismo horario
alter table reservaciones drop constraint if exists reservaciones_sin_traslape;
alter table reservaciones add constraint reservaciones_sin_traslape
  exclude using gist (estacion with =, tstzrange(inicio, fin) with &&)
  where (estado in ('pendiente_pago', 'confirmada') and inicio is not null);

create index if not exists reservaciones_estacion_fecha on reservaciones (estacion, fecha);
create index if not exists reservaciones_estado_inicio on reservaciones (estado, inicio);

-- Cierres de caja / sesiones cobradas en mostrador
create table if not exists cierres (
  id uuid primary key default gen_random_uuid(),
  estacion text not null,
  cliente text,
  precio numeric not null default 0,
  hora text not null,
  created_at timestamptz not null default now()
);
create index if not exists cierres_created_at on cierres (created_at desc);

-- Estado en vivo de cada estación (lo maneja el panel)
create table if not exists estaciones (
  id text primary key,
  tipo text not null,
  specs text,
  estado text not null default 'libre' check (estado in ('libre', 'sesion', 'mantenimiento')),
  cliente text,
  tarifa_id text,
  precio numeric,
  fin_sesion timestamptz,
  updated_at timestamptz not null default now()
);

-- Personas autorizadas para entrar al panel
create table if not exists equipo (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  rol text not null default 'admin',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) ESTACIONES REALES (5 PC + 6 Xbox)
-- ---------------------------------------------------------------------
insert into estaciones (id, tipo, specs) values
  ('PC-01', 'PC gaming',    'RTX 5070 Ti · Monitor 500 Hz'),
  ('PC-02', 'PC gaming',    'RTX 5070 · Monitor 280 Hz'),
  ('PC-03', 'PC gaming',    'RTX 5070 · Monitor 360 Hz'),
  ('PC-04', 'PC gaming',    'RTX 5060 · Monitor 240 Hz'),
  ('PC-05', 'PC gaming',    'RTX 3090 · Monitor 480 Hz'),
  ('XB-01', 'Consola Xbox', 'Xbox Series X'),
  ('XB-02', 'Consola Xbox', 'Xbox Series X'),
  ('XB-03', 'Consola Xbox', 'Xbox Series X'),
  ('XB-04', 'Consola Xbox', 'Xbox Series S'),
  ('XB-05', 'Consola Xbox', 'Xbox Series X'),
  ('XB-06', 'Consola Xbox', 'Xbox Series S')
on conflict (id) do update set tipo = excluded.tipo, specs = excluded.specs;

delete from estaciones where id in ('PC-06', 'PC-07', 'PC-08', 'PS-01', 'PS-02');

-- ---------------------------------------------------------------------
-- 3) SEGURIDAD (RLS)
--    Regla: el navegador público NO toca las tablas. Solo ve la vista
--    estaciones_publicas. Las reservas pasan por el servidor (service role).
--    El panel solo funciona para usuarios que estén en la tabla "equipo".
-- ---------------------------------------------------------------------
create or replace function es_equipo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.equipo where user_id = auth.uid());
$$;
revoke all on function es_equipo() from public;
grant execute on function es_equipo() to authenticated;

alter table reservaciones enable row level security;
alter table cierres       enable row level security;
alter table estaciones    enable row level security;
alter table equipo        enable row level security;

-- limpiar políticas anteriores (versiones viejas del esquema)
drop policy if exists "cualquiera puede reservar"      on reservaciones;
drop policy if exists "equipo lee reservaciones"       on reservaciones;
drop policy if exists "equipo actualiza reservaciones" on reservaciones;
drop policy if exists "equipo gestiona cierres"        on cierres;
drop policy if exists "equipo gestiona estaciones"     on estaciones;
drop policy if exists "equipo ve equipo"               on equipo;

create policy "equipo lee reservaciones"
  on reservaciones for select to authenticated using (es_equipo());
create policy "equipo actualiza reservaciones"
  on reservaciones for update to authenticated using (es_equipo()) with check (es_equipo());

create policy "equipo gestiona cierres"
  on cierres for all to authenticated using (es_equipo()) with check (es_equipo());

create policy "equipo gestiona estaciones"
  on estaciones for all to authenticated using (es_equipo()) with check (es_equipo());

create policy "equipo ve equipo"
  on equipo for select to authenticated using (es_equipo());

-- Vista pública: solo estado y hora de fin, sin nombres ni precios
create or replace view estaciones_publicas as
  select id, tipo, specs, estado, fin_sesion from estaciones;
grant select on estaciones_publicas to anon, authenticated;

-- Quitar permisos directos de las tablas al público
revoke all on reservaciones, cierres, estaciones, equipo from anon;

-- Permisos explícitos (RLS decide después quién puede qué)
grant select, update on reservaciones to authenticated;
grant select, insert, update, delete on cierres, estaciones to authenticated;
grant select on equipo to authenticated;
grant all on reservaciones, cierres, estaciones, equipo to service_role;

-- ---------------------------------------------------------------------
-- 4) DAR ACCESO AL PANEL
--    1. En Authentication → Users crea (Add user) la cuenta del dueño/equipo.
--    2. Escribe aquí sus correos y vuelve a correr SOLO este bloque.
-- ---------------------------------------------------------------------
insert into equipo (user_id, email)
select id, email from auth.users
where lower(email) in (
  'gontarosintinicolasisrael@gmail.com'
  -- , 'duenio@correo.com'
  -- , 'encargado@correo.com'
)
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------
-- 5) COMPROBACIÓN (no cambia nada, solo muestra el resultado)
-- ---------------------------------------------------------------------
select 'estaciones' as tabla, count(*) as filas from estaciones
union all select 'reservaciones', count(*) from reservaciones
union all select 'cierres', count(*) from cierres
union all select 'equipo (con acceso al panel)', count(*) from equipo;
