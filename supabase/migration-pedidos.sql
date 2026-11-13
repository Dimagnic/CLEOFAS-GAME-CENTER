-- =====================================================================
-- Cleofas Game Center · PRODUCTOS DE TIENDA EN LA RESERVA
--   El cliente agrega snacks/bebidas al reservar y elige:
--     · en_linea  → se cobran con la reserva en Stripe
--     · efectivo  → se pagan el día de la visita (el encargado los cobra desde el panel)
--   Los puntos del socio se suman al pagar (en línea) o al cobrar en efectivo.
-- Requiere migration-socios.sql, migration-fase2.sql y migration-fase3.sql. Se puede repetir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) DATOS
-- ---------------------------------------------------------------------
create table if not exists reserva_productos (
  id uuid primary key default gen_random_uuid(),
  reservacion_id uuid not null references reservaciones (id) on delete cascade,
  producto_id uuid references productos (id) on delete set null,
  nombre text not null,                 -- se guarda el nombre y el precio del momento
  precio_unit numeric not null check (precio_unit >= 0),
  cantidad int not null check (cantidad between 1 and 20),
  created_at timestamptz not null default now()
);
create index if not exists reserva_productos_reserva on reserva_productos (reservacion_id);

alter table reservaciones add column if not exists snacks_subtotal  numeric not null default 0;
alter table reservaciones add column if not exists snacks_descuento numeric not null default 0;
alter table reservaciones add column if not exists snacks_total     numeric not null default 0;  -- lo que paga por los productos
alter table reservaciones add column if not exists snacks_pago      text;                        -- en_linea | efectivo | null (sin productos)
alter table reservaciones add column if not exists snacks_estado    text;                        -- pendiente | pagado | null
alter table reservaciones add column if not exists snacks_cobrado_at   timestamptz;
alter table reservaciones add column if not exists snacks_entregado_at timestamptz;

alter table reservaciones drop constraint if exists reservaciones_snacks_pago_check;
alter table reservaciones add constraint reservaciones_snacks_pago_check check (snacks_pago is null or snacks_pago in ('en_linea', 'efectivo'));
alter table reservaciones drop constraint if exists reservaciones_snacks_estado_check;
alter table reservaciones add constraint reservaciones_snacks_estado_check check (snacks_estado is null or snacks_estado in ('pendiente', 'pagado'));

-- ---------------------------------------------------------------------
-- 2) PUNTOS AL CONFIRMAR LA RESERVA
--    monto = lo que se cobró en línea (horas + productos si eligió pagar en línea)
-- ---------------------------------------------------------------------
create or replace function trg_reservas_puntos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mult numeric;
  mult_s numeric;
  productos_en_linea numeric := case when new.snacks_pago = 'en_linea' then coalesce(new.snacks_total, 0) else 0 end;
  horas numeric;
  detalle text;
begin
  if new.estado = 'confirmada' and old.estado is distinct from 'confirmada' then
    if new.cupon_id is not null then
      update cupones set estado = 'usado', usado_at = now(), usado_en = 'Reserva ' || new.folio, descuento_aplicado = new.descuento_cupon
      where id = new.cupon_id and estado = 'disponible';
    end if;
    -- Productos pagados en línea: quedan pagados con la reserva
    if new.snacks_pago = 'en_linea' and new.snacks_estado is distinct from 'pagado' then
      update reservaciones set snacks_estado = 'pagado', snacks_cobrado_at = now() where id = new.id;
    end if;

    if new.socio_id is not null then
      horas := greatest(coalesce(new.monto, 0) - productos_en_linea, 0);
      if horas > 0 then
        mult := multiplicador_puntos('horas', coalesce(new.paid_at, now()));
        insert into movimientos (socio_id, tipo, descripcion, monto, puntos, ref, creado_por)
        values (new.socio_id, 'reserva',
                'Reserva en línea ' || new.folio || ' · ' || new.estacion || case when mult > 1 then ' · puntos x' || rtrim(to_char(mult, 'FM9.9'), '.') else '' end,
                horas, floor(horas * mult)::int, 'reserva:' || new.folio, 'en línea')
        on conflict (ref) do nothing;
      end if;
      if productos_en_linea > 0 then
        mult_s := multiplicador_puntos('snacks', coalesce(new.paid_at, now()));
        select string_agg(cantidad || '× ' || nombre, ', ' order by nombre) into detalle from reserva_productos where reservacion_id = new.id;
        insert into movimientos (socio_id, tipo, descripcion, monto, puntos, ref, creado_por)
        values (new.socio_id, 'snack',
                'Pedido con reserva ' || new.folio || ': ' || coalesce(detalle, 'productos') || case when mult_s > 1 then ' · puntos x' || rtrim(to_char(mult_s, 'FM9.9'), '.') else '' end,
                productos_en_linea, floor(productos_en_linea * mult_s)::int, 'reserva-snacks:' || new.folio, 'en línea')
        on conflict (ref) do nothing;
      end if;
    end if;
  elsif old.estado = 'confirmada' and new.estado = 'cancelada' and new.socio_id is not null then
    -- Se restan exactamente los puntos que dio (horas y productos en línea)
    insert into movimientos (socio_id, tipo, descripcion, monto, puntos, ref, creado_por)
    select new.socio_id, 'ajuste', 'Reserva cancelada ' || new.folio, 0, -sum(m.puntos), 'reserva-cancelada:' || new.folio, 'sistema'
    from movimientos m where m.ref in ('reserva:' || new.folio, 'reserva-snacks:' || new.folio)
    having sum(m.puntos) > 0
    on conflict (ref) do nothing;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- 3) ACCIONES DEL PANEL
-- ---------------------------------------------------------------------

-- Cobrar en efectivo el pedido de una reserva: entra a la caja del día y suma puntos al socio.
create or replace function cobrar_pedido(p_reserva uuid)
returns reservaciones
language plpgsql
security definer
set search_path = public
as $$
declare
  r reservaciones;
  detalle text;
begin
  if not es_equipo() then raise exception 'Solo el equipo puede cobrar pedidos'; end if;
  update reservaciones set snacks_estado = 'pagado', snacks_cobrado_at = now()
  where id = p_reserva and snacks_pago = 'efectivo' and snacks_estado = 'pendiente' and estado = 'confirmada'
  returning * into r;
  if r.id is null then raise exception 'Ese pedido ya se cobró o la reserva no está confirmada'; end if;

  select string_agg(cantidad || '× ' || nombre, ', ' order by nombre) into detalle from reserva_productos where reservacion_id = r.id;
  -- El trigger de cierres suma los puntos del socio (con campañas).
  insert into cierres (estacion, cliente, precio, hora, tipo, detalle, descuento, socio_id)
  values ('TIENDA', r.cliente, r.snacks_total,
          to_char(now() at time zone 'America/Mexico_City', 'HH24:MI'),
          'snack', 'Reserva ' || r.folio || ': ' || coalesce(detalle, 'productos'), r.snacks_descuento, r.socio_id);
  return r;
end;
$$;
revoke all on function cobrar_pedido(uuid) from public;
grant execute on function cobrar_pedido(uuid) to authenticated;

-- Marcar el pedido como entregado al cliente (o deshacerlo)
create or replace function entregar_pedido(p_reserva uuid, p_entregado boolean default true)
returns reservaciones
language plpgsql
security definer
set search_path = public
as $$
declare
  r reservaciones;
begin
  if not es_equipo() then raise exception 'Solo el equipo puede entregar pedidos'; end if;
  update reservaciones set snacks_entregado_at = case when p_entregado then now() end
  where id = p_reserva and snacks_pago is not null
  returning * into r;
  if r.id is null then raise exception 'Esa reserva no tiene pedido'; end if;
  return r;
end;
$$;
revoke all on function entregar_pedido(uuid, boolean) from public;
grant execute on function entregar_pedido(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 4) SEGURIDAD
-- ---------------------------------------------------------------------
alter table reserva_productos enable row level security;
drop policy if exists "equipo ve pedidos" on reserva_productos;
drop policy if exists "socio ve sus pedidos" on reserva_productos;
create policy "equipo ve pedidos" on reserva_productos for all to authenticated using (es_equipo()) with check (es_equipo());
create policy "socio ve sus pedidos" on reserva_productos for select to authenticated using (
  exists (select 1 from reservaciones r where r.id = reservacion_id and r.socio_id = auth.uid())
);
revoke all on reserva_productos from anon;
grant select on reserva_productos to authenticated;
grant all on reserva_productos to service_role;

-- ---------------------------------------------------------------------
-- 5) COMPROBACIÓN
-- ---------------------------------------------------------------------
select 'reserva_productos' as tabla, count(*)::text as filas from reserva_productos
union all select 'productos a la venta', count(*)::text from productos where activo;
