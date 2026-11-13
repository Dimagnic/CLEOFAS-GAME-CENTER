-- =====================================================================
-- Cleofas Game Center · PCs CON TEMPORIZADOR Y BLOQUEO (programa "Cleofas Agente")
--   Cada PC se vincula con un código que genera el panel. Con ese código solo puede
--   consultar el estado de SU estación (no ve clientes, ventas ni nada más).
-- Requiere las migraciones anteriores. Ejecutar DESPUÉS de migration-pos.sql. Se puede repetir.
-- =====================================================================

create table if not exists dispositivos (
  id uuid primary key default gen_random_uuid(),
  estacion_id text not null references estaciones (id) on delete cascade,
  nombre text,
  token_hash text not null unique,          -- solo se guarda el hash del código
  activo boolean not null default true,
  version text,
  ultimo_contacto timestamptz,
  mensaje text,                              -- aviso del encargado para mostrar en la pantalla
  mensaje_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists dispositivos_estacion on dispositivos (estacion_id);

-- Genera el código de vinculación para la PC de una estación (solo equipo).
-- Devuelve el código UNA vez; en la base queda solo su hash.
create or replace function vincular_dispositivo(p_estacion text, p_nombre text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not es_equipo() then raise exception 'Solo el equipo puede vincular PCs' using errcode = '42501'; end if;
  if not exists (select 1 from estaciones where id = p_estacion) then raise exception 'Estación no encontrada' using errcode = 'P0001'; end if;
  -- Una PC activa por estación: la vinculación anterior queda revocada
  update dispositivos set activo = false where estacion_id = p_estacion and activo;
  insert into dispositivos (estacion_id, nombre, token_hash)
  values (p_estacion, left(coalesce(nullif(trim(p_nombre), ''), p_estacion), 60), encode(sha256(convert_to(token, 'UTF8')), 'hex'));
  return token;
end;
$$;

-- Lo que consulta el programa de la PC cada pocos segundos (también sirve de "latido").
-- Responde solo lo necesario para el temporizador y el bloqueo.
create or replace function estado_dispositivo(p_token text, p_version text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d dispositivos;
  e estaciones;
begin
  if p_token is null or length(p_token) < 40 then raise exception 'Código inválido' using errcode = '28000'; end if;
  update dispositivos set ultimo_contacto = now(), version = left(coalesce(p_version, version), 20)
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') and activo
  returning * into d;
  if d.id is null then raise exception 'Esta PC no está vinculada o su código fue revocado' using errcode = '28000'; end if;
  select * into e from estaciones where id = d.estacion_id;
  return jsonb_build_object(
    'estacion', e.id,
    'tipo', e.tipo,
    'estado', e.estado,                                   -- libre | sesion | mantenimiento
    'fin', e.fin_sesion,
    'ahora', now(),                                        -- para corregir el reloj de la PC
    'cliente', nullif(split_part(coalesce(e.cliente, ''), ' ', 1), ''),
    'mensaje', d.mensaje,
    'mensaje_at', d.mensaje_at
  );
end;
$$;

-- Enviar o borrar un mensaje en la pantalla de una PC (solo equipo)
create or replace function mensaje_dispositivo(p_estacion text, p_mensaje text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_equipo() then raise exception 'Solo el equipo' using errcode = '42501'; end if;
  update dispositivos set mensaje = nullif(left(trim(coalesce(p_mensaje, '')), 140), ''), mensaje_at = now()
  where estacion_id = p_estacion and activo;
end;
$$;

-- Seguridad
alter table dispositivos enable row level security;
drop policy if exists "equipo ve dispositivos" on dispositivos;
create policy "equipo ve dispositivos" on dispositivos for select to authenticated using (es_equipo());
drop policy if exists "equipo revoca dispositivos" on dispositivos;
create policy "equipo revoca dispositivos" on dispositivos for update to authenticated using (es_equipo()) with check (es_equipo());
revoke all on dispositivos from anon, authenticated;
grant select, update (activo, nombre) on dispositivos to authenticated;
grant all on dispositivos to service_role;

revoke all on function vincular_dispositivo(text, text) from public, anon;
revoke all on function mensaje_dispositivo(text, text) from public, anon;
revoke all on function estado_dispositivo(text, text) from public;
grant execute on function vincular_dispositivo(text, text), mensaje_dispositivo(text, text) to authenticated;
grant execute on function estado_dispositivo(text, text) to anon, authenticated;  -- la PC no tiene sesión: entra con su código

-- Las PCs se ven en el panel en tiempo real (en línea / fuera de línea)
do $$ begin begin alter publication supabase_realtime add table dispositivos; exception when others then null; end; end $$;

select id as estacion, tipo, estado from estaciones where tipo ilike '%pc%' order by id;
