-- Cleofas Game Center · pagos en línea y anti-traslape
-- Ejecuta esto en el SQL Editor de Supabase DESPUÉS de schema.sql. Es seguro repetirlo.

create extension if not exists btree_gist;

alter table reservaciones add column if not exists email text;
alter table reservaciones add column if not exists telefono text;
alter table reservaciones add column if not exists inicio timestamptz;
alter table reservaciones add column if not exists fin timestamptz;
alter table reservaciones add column if not exists monto numeric not null default 0;
alter table reservaciones add column if not exists expires_at timestamptz;
alter table reservaciones add column if not exists paid_at timestamptz;
alter table reservaciones add column if not exists stripe_session_id text unique;
alter table reservaciones add column if not exists stripe_payment_intent_id text;

-- Nuevos estados: pendiente_pago (horario apartado mientras paga) y expirada
alter table reservaciones drop constraint if exists reservaciones_estado_check;
alter table reservaciones add constraint reservaciones_estado_check
  check (estado in ('pendiente', 'pendiente_pago', 'confirmada', 'cancelada', 'expirada'));

-- Imposible reservar la misma estación dos veces en el mismo horario.
-- (Las reservas antiguas sin "inicio" no participan.)
alter table reservaciones drop constraint if exists reservaciones_sin_traslape;
alter table reservaciones add constraint reservaciones_sin_traslape
  exclude using gist (estacion with =, tstzrange(inicio, fin) with &&)
  where (estado in ('pendiente_pago', 'confirmada') and inicio is not null);

create index if not exists reservaciones_estacion_fecha on reservaciones (estacion, fecha);

-- Seguridad: ya NO se permite insertar desde el navegador. Toda reservación
-- pasa por /api/checkout (servidor), que valida datos y calcula el precio.
drop policy if exists "cualquiera puede reservar" on reservaciones;
