-- =====================================================================
-- Cleofas Game Center · CLUB FASE 3: AUTOMATIZACIÓN
--   · Cupones automáticos: bienvenida, ascenso de rango, cumpleaños, reactivación
--   · Campañas de puntos (x1.5, x2, x3) por fechas y días de la semana
--   · Cupones en reservas en línea
--   · Preferencia de correos y fecha de nacimiento del socio
-- Requiere migration-socios.sql y migration-fase2.sql. Se puede repetir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) DATOS NUEVOS
-- ---------------------------------------------------------------------
alter table socios        add column if not exists fecha_nacimiento date;
alter table socios        add column if not exists acepta_correos boolean not null default true;
alter table cupones       add column if not exists notificado_at timestamptz;
alter table publicaciones add column if not exists notificado_at timestamptz;
alter table publicaciones add column if not exists notificados int;
alter table reservaciones add column if not exists cupon_id uuid references cupones (id) on delete set null;
alter table reservaciones add column if not exists descuento_cupon numeric not null default 0;

-- Los cupones que ya existían no se vuelven a avisar por correo
update cupones set notificado_at = coalesce(notificado_at, created_at) where notificado_at is null and created_at < now() - interval '1 minute';

-- Reglas de cupones automáticos (se editan en el panel → Automatización)
create table if not exists reglas (
  clave text primary key,          -- bienvenida | cumpleanos | reactivacion | ascenso:<id del rango>
  activo boolean not null default false,
  titulo text not null,
  descripcion text,
  tipo text not null default 'monto' check (tipo in ('monto', 'porcentaje')),
  valor numeric not null default 35 check (valor > 0),
  aplica text not null default 'horas' check (aplica in ('horas', 'snacks', 'todo')),
  dias int not null default 30 check (dias >= 0),   -- vigencia del cupón (0 = sin vencimiento)
  parametro int,                                     -- reactivación: días sin venir
  updated_at timestamptz not null default now()
);

insert into reglas (clave, activo, titulo, descripcion, tipo, valor, aplica, dias, parametro) values
  ('bienvenida',   true,  'Regalo de bienvenida', '¡Gracias por unirte al Club Cleofas! Media hora de juego por nuestra cuenta.', 'monto', 20, 'horas', 30, null),
  ('cumpleanos',   true,  'Feliz cumpleaños',     'Celebra con nosotros: una hora y un snack por nuestra cuenta.',               'monto', 60, 'todo',  15, null),
  ('reactivacion', false, 'Te extrañamos',        'Vuelve a jugar: te regalamos una hora.',                                      'monto', 35, 'horas', 15, 45)
on conflict (clave) do nothing;

insert into reglas (clave, activo, titulo, descripcion, tipo, valor, aplica, dias)
select 'ascenso:' || r.id, true, '¡Subiste a ' || r.nombre || '!',
       'Premio por alcanzar el rango ' || r.nombre || '.', 'monto',
       case when r.min_puntos >= 4000 then 90 when r.min_puntos >= 1500 then 70 else 35 end, 'horas', 30
from rangos r where r.min_puntos > 0
on conflict (clave) do nothing;

-- Campañas de puntos: "puntos dobles los martes", "x3 en diciembre"…
create table if not exists campanas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  multiplicador numeric not null check (multiplicador > 1 and multiplicador <= 5),
  aplica text not null default 'todo' check (aplica in ('horas', 'snacks', 'todo')),
  desde date,
  hasta date,
  dias_semana int[],                 -- 0 = domingo … 6 = sábado; null = todos los días
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Bitácora de la automatización diaria
create table if not exists automatizaciones_log (
  id bigserial primary key,
  ran_at timestamptz not null default now(),
  origen text,
  resultado jsonb
);

-- ---------------------------------------------------------------------
-- 2) FUNCIONES
-- ---------------------------------------------------------------------

-- Multiplicador de puntos vigente para un tipo de consumo ('horas' o 'snacks') en un momento dado
create or replace function multiplicador_puntos(p_aplica text, p_ts timestamptz default now())
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(c.multiplicador), 1)
  from campanas c, lateral (select (p_ts at time zone 'America/Mexico_City') as l) t
  where c.activo
    and (c.aplica = 'todo' or c.aplica = p_aplica)
    and (c.desde is null or t.l::date >= c.desde)
    and (c.hasta is null or t.l::date <= c.hasta)
    and (c.dias_semana is null or cardinality(c.dias_semana) = 0 or extract(dow from t.l)::int = any (c.dias_semana));
$$;
grant execute on function multiplicador_puntos(text, timestamptz) to anon, authenticated;

-- Emite el cupón de una regla a un socio (si la regla está activa). Devuelve el cupón o null.
create or replace function emitir_por_regla(p_clave text, p_socio uuid, p_lote text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r reglas;
  nuevo uuid;
begin
  select * into r from reglas where clave = p_clave and activo;
  if r.clave is null then return null; end if;
  insert into cupones (socio_id, titulo, descripcion, tipo, valor, aplica, vence_at, origen, lote, creado_por)
  values (p_socio, r.titulo, r.descripcion, r.tipo, r.valor, r.aplica,
          case when r.dias > 0 then now() + make_interval(days => r.dias) end,
          split_part(p_clave, ':', 1), coalesce(p_lote, p_clave), 'automático')
  returning id into nuevo;
  return nuevo;
end;
$$;
revoke all on function emitir_por_regla(text, uuid, text) from public;

-- Puntos y rango (ahora con premio automático al subir de rango)
create or replace function sincronizar_socio(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total int;
  antes int;
  nuevo_rango int;
  nivel_antes int;
  nivel_nuevo int;
begin
  select coalesce(sum(puntos), 0) into total from movimientos where socio_id = uid;
  select rango_id into antes from socios where user_id = uid;
  update socios s set
    puntos = greatest(total, 0),
    rango_id = case when s.rango_manual then s.rango_id else
      (select r.id from rangos r where r.min_puntos <= greatest(total, 0) order by r.min_puntos desc limit 1) end
  where s.user_id = uid
  returning rango_id into nuevo_rango;

  if nuevo_rango is distinct from antes and nuevo_rango is not null then
    select min_puntos into nivel_antes from rangos where id = antes;
    select min_puntos into nivel_nuevo from rangos where id = nuevo_rango;
    -- Solo al SUBIR, y una sola vez por rango en la vida del socio
    if nivel_nuevo > coalesce(nivel_antes, -1)
       and not exists (select 1 from cupones where socio_id = uid and lote = 'ascenso:' || nuevo_rango) then
      perform emitir_por_regla('ascenso:' || nuevo_rango, uid, 'ascenso:' || nuevo_rango);
    end if;
  end if;
end;
$$;
revoke all on function sincronizar_socio(uuid) from public;

-- Cuenta nueva → socio (con cumpleaños, preferencia de correos y regalo de bienvenida)
create or replace function trg_nuevo_socio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nac date;
begin
  begin
    nac := nullif(new.raw_user_meta_data ->> 'fecha_nacimiento', '')::date;
    if nac < date '1920-01-01' or nac > current_date then nac := null; end if;
  exception when others then nac := null;
  end;

  insert into socios (user_id, nombre, email, telefono, codigo, rango_id, fecha_nacimiento, acepta_correos)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'nombre', ''), 80),
    lower(new.email),
    nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'telefono', ''), '\D', '', 'g'), ''),
    nuevo_codigo_socio(),
    (select id from rangos order by min_puntos limit 1),
    nac,
    coalesce((new.raw_user_meta_data ->> 'acepta_correos')::boolean, true)
  )
  on conflict (user_id) do nothing;

  if found then perform emitir_por_regla('bienvenida', new.id, 'bienvenida'); end if;
  return new;
exception when others then
  raise warning 'No se pudo crear el socio de %: %', new.email, sqlerrm;
  return new;
end;
$$;

-- El socio puede capturar su cumpleaños UNA vez y cambiar si recibe correos; lo demás lo controla el sistema.
create or replace function trg_socios_proteger()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated' and not es_equipo() then
    new.user_id := old.user_id;
    new.email := old.email;
    new.codigo := old.codigo;
    new.puntos := old.puntos;
    new.rango_id := old.rango_id;
    new.rango_manual := old.rango_manual;
    new.notas := old.notas;
    new.created_at := old.created_at;
    if old.fecha_nacimiento is not null then new.fecha_nacimiento := old.fecha_nacimiento; end if;
    if new.fecha_nacimiento is not null and (new.fecha_nacimiento < date '1920-01-01' or new.fecha_nacimiento > current_date) then
      new.fecha_nacimiento := old.fecha_nacimiento;
    end if;
  end if;
  return new;
end;
$$;

-- Cobro en mostrador → puntos (con campañas)
create or replace function trg_cierres_puntos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mult numeric;
  es_snack boolean := new.tipo = 'snack';
begin
  if new.socio_id is not null and coalesce(new.precio, 0) > 0 then
    mult := multiplicador_puntos(case when es_snack then 'snacks' else 'horas' end, now());
    insert into movimientos (socio_id, tipo, descripcion, monto, puntos, ref, creado_por)
    values (
      new.socio_id,
      case when es_snack then 'snack' else 'sesion' end,
      (case when es_snack then 'Tienda: ' || coalesce(new.detalle, 'snacks') else 'Sesión en ' || new.estacion end)
        || case when mult > 1 then ' · puntos x' || rtrim(to_char(mult, 'FM9.9'), '.') else '' end,
      new.precio,
      floor(new.precio * mult)::int,
      'cierre:' || new.id,
      'mostrador'
    )
    on conflict (ref) do nothing;
  end if;
  return null;
end;
$$;

-- Reserva en línea pagada → puntos (con campañas) y canje del cupón usado; cancelada → resta puntos
create or replace function trg_reservas_puntos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mult numeric;
begin
  if new.estado = 'confirmada' and old.estado is distinct from 'confirmada' then
    if new.cupon_id is not null then
      update cupones set estado = 'usado', usado_at = now(), usado_en = 'Reserva ' || new.folio, descuento_aplicado = new.descuento_cupon
      where id = new.cupon_id and estado = 'disponible';
    end if;
    if new.socio_id is not null and coalesce(new.monto, 0) > 0 then
      mult := multiplicador_puntos('horas', coalesce(new.paid_at, now()));
      insert into movimientos (socio_id, tipo, descripcion, monto, puntos, ref, creado_por)
      values (new.socio_id, 'reserva',
              'Reserva en línea ' || new.folio || ' · ' || new.estacion || case when mult > 1 then ' · puntos x' || rtrim(to_char(mult, 'FM9.9'), '.') else '' end,
              new.monto, floor(new.monto * mult)::int, 'reserva:' || new.folio, 'en línea')
      on conflict (ref) do nothing;
    end if;
  elsif old.estado = 'confirmada' and new.estado = 'cancelada' and new.socio_id is not null then
    insert into movimientos (socio_id, tipo, descripcion, monto, puntos, ref, creado_por)
    select new.socio_id, 'ajuste', 'Reserva cancelada ' || new.folio, 0, -m.puntos, 'reserva-cancelada:' || new.folio, 'sistema'
    from movimientos m where m.ref = 'reserva:' || new.folio
    on conflict (ref) do nothing;
  end if;
  return null;
end;
$$;

-- Tarea diaria: cumpleaños y reactivación. La llama /api/cron (Vercel) una vez al día.
create or replace function procesar_automatizaciones(p_origen text default 'cron')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hoy date := (now() at time zone 'America/Mexico_City')::date;
  n_cumple int := 0;
  n_react int := 0;
  r_react reglas;
  s record;
  res jsonb;
begin
  -- Cumpleaños (el 29 de febrero se celebra el 28 en años no bisiestos)
  for s in
    select user_id from socios
    where fecha_nacimiento is not null
      and (to_char(fecha_nacimiento, 'MM-DD') = to_char(hoy, 'MM-DD')
           or (to_char(fecha_nacimiento, 'MM-DD') = '02-29' and to_char(hoy, 'MM-DD') = '02-28'
               and extract(day from (date_trunc('year', hoy) + interval '2 months' - interval '1 day')) = 28))
      and not exists (select 1 from cupones c where c.socio_id = socios.user_id and c.lote = 'cumpleanos:' || extract(year from hoy))
  loop
    if emitir_por_regla('cumpleanos', s.user_id, 'cumpleanos:' || extract(year from hoy)) is not null then n_cumple := n_cumple + 1; end if;
  end loop;

  -- Reactivación: socios sin consumo en N días (máximo un cupón cada N días)
  select * into r_react from reglas where clave = 'reactivacion' and activo;
  if r_react.clave is not null and coalesce(r_react.parametro, 0) > 0 then
    for s in
      select so.user_id from socios so
      where so.created_at < now() - make_interval(days => r_react.parametro)
        and coalesce((select max(m.created_at) from movimientos m where m.socio_id = so.user_id and m.tipo <> 'ajuste'), so.created_at)
            < now() - make_interval(days => r_react.parametro)
        and not exists (select 1 from cupones c where c.socio_id = so.user_id and c.origen = 'reactivacion'
                        and c.created_at > now() - make_interval(days => r_react.parametro))
    loop
      if emitir_por_regla('reactivacion', s.user_id, 'reactivacion:' || hoy) is not null then n_react := n_react + 1; end if;
    end loop;
  end if;

  res := jsonb_build_object('fecha', hoy, 'cumpleanos', n_cumple, 'reactivacion', n_react);
  insert into automatizaciones_log (origen, resultado) values (p_origen, res);
  return res;
end;
$$;
revoke all on function procesar_automatizaciones(text) from public, anon, authenticated;
grant execute on function procesar_automatizaciones(text) to service_role;

-- ---------------------------------------------------------------------
-- 3) SEGURIDAD
-- ---------------------------------------------------------------------
alter table reglas               enable row level security;
alter table campanas             enable row level security;
alter table automatizaciones_log enable row level security;

drop policy if exists "equipo gestiona reglas" on reglas;
create policy "equipo gestiona reglas" on reglas for all to authenticated using (es_equipo()) with check (es_equipo());

drop policy if exists "socios ven campanas activas" on campanas;
drop policy if exists "equipo gestiona campanas" on campanas;
create policy "socios ven campanas activas" on campanas for select to anon, authenticated using (activo or es_equipo());
create policy "equipo gestiona campanas" on campanas for all to authenticated using (es_equipo()) with check (es_equipo());

drop policy if exists "equipo ve bitacora" on automatizaciones_log;
create policy "equipo ve bitacora" on automatizaciones_log for select to authenticated using (es_equipo());

revoke all on reglas, automatizaciones_log from anon;
grant select on campanas to anon;
grant select, insert, update, delete on reglas, campanas to authenticated;
grant select on automatizaciones_log to authenticated;
grant all on reglas, campanas, automatizaciones_log to service_role;
grant usage, select on sequence automatizaciones_log_id_seq to service_role;

-- ---------------------------------------------------------------------
-- 4) COMPROBACIÓN
-- ---------------------------------------------------------------------
select clave as regla, case when activo then 'activa' else 'apagada' end as estado, titulo
from reglas order by clave;
