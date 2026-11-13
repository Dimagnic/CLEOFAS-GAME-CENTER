-- =====================================================================
-- Cleofas Game Center · POS, INVENTARIO Y VENTAS UNIFICADAS
--   Una sola tabla de ventas para: POS (mostrador), tienda del socio y productos de reservas.
--   · Inventario: existencias, apartados por pedidos pendientes, movimientos, costos, alertas.
--   · Pagos: efectivo, terminal, QR (transferencia) y en línea (Stripe). Confirmación manual o automática.
--   · Puntos SOLO cuando la venta está pagada; si se cancela/devuelve, se restan.
-- Requiere: migration-socios, fase2, fase3 y pedidos. Se puede repetir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) CONFIGURACIÓN DEL NEGOCIO
-- ---------------------------------------------------------------------
create table if not exists config_negocio (
  clave text primary key,
  valor jsonb not null,
  updated_at timestamptz not null default now()
);
insert into config_negocio (clave, valor) values
  ('venta_sin_stock', 'false'),          -- true = permite vender aunque no haya existencias
  ('pedido_vigencia_horas', '24'),       -- pedidos de la tienda para pagar en mostrador
  ('ticket', '{"ancho": 80, "encabezado": "CLEOFAS GAME CENTER", "pie": "¡Gracias por tu visita! Vuelve pronto."}')
on conflict (clave) do nothing;

create or replace function cfg(p_clave text)
returns jsonb language sql stable security definer set search_path = public
as $$ select valor from config_negocio where clave = p_clave $$;

-- ---------------------------------------------------------------------
-- 1) PRODUCTOS E INVENTARIO
-- ---------------------------------------------------------------------
alter table productos add column if not exists descripcion text;
alter table productos add column if not exists codigo_barras text;
alter table productos add column if not exists imagen_url text;
alter table productos add column if not exists stock int not null default 0;
alter table productos add column if not exists apartado int not null default 0;     -- reservado por pedidos pendientes
alter table productos add column if not exists stock_minimo int not null default 0; -- alerta de stock bajo
alter table productos add column if not exists controla_stock boolean not null default true;
alter table productos add column if not exists updated_at timestamptz not null default now();
alter table productos drop constraint if exists productos_apartado_check;
alter table productos add constraint productos_apartado_check check (apartado >= 0);
create unique index if not exists productos_codigo_barras on productos (codigo_barras) where codigo_barras is not null and codigo_barras <> '';

-- El costo es privado (solo equipo): va en su propia tabla
create table if not exists producto_costos (
  producto_id uuid primary key references productos (id) on delete cascade,
  costo numeric not null default 0 check (costo >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists inventario_movs (
  id bigserial primary key,
  producto_id uuid not null references productos (id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'venta', 'devolucion', 'ajuste', 'merma')),
  cantidad int not null,               -- positiva entra, negativa sale
  stock_antes int not null,
  stock_despues int not null,
  venta_id uuid,
  nota text,
  creado_por text,
  created_at timestamptz not null default now()
);
create index if not exists inventario_movs_producto on inventario_movs (producto_id, created_at desc);

-- ---------------------------------------------------------------------
-- 2) VENTAS (POS, tienda del socio y productos de reservas)
-- ---------------------------------------------------------------------
create or replace function nuevo_folio_venta()
returns text language plpgsql as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := 'V-';
    for i in 1..6 loop c := c || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1); end loop;
    exit when not exists (select 1 from public.ventas where folio = c);
  end loop;
  return c;
end; $$;

create table if not exists ventas (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  origen text not null check (origen in ('pos', 'tienda', 'reserva')),
  reservacion_id uuid references reservaciones (id) on delete set null,
  socio_id uuid references socios (user_id) on delete set null,
  cliente text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagada', 'cancelada')),
  entrega text not null default 'pendiente' check (entrega in ('pendiente', 'entregada')),
  pago_preferido text check (pago_preferido in ('en_linea', 'presencial')),
  metodo_pago text check (metodo_pago in ('efectivo', 'terminal', 'qr', 'en_linea')),
  subtotal numeric not null default 0,
  descuento_socio numeric not null default 0,
  descuento_cupon numeric not null default 0,
  total numeric not null default 0 check (total >= 0),
  cupon_id uuid references cupones (id) on delete set null,
  recibido numeric,               -- efectivo recibido
  cambio numeric,
  referencia_pago text,           -- autorización de terminal / referencia de transferencia
  stripe_session_id text,
  vence_at timestamptz,           -- si sigue pendiente después de esto, se libera
  pagada_at timestamptz,
  entregada_at timestamptz,
  cancelada_at timestamptz,
  motivo_cancelacion text,
  cobrado_por text,
  created_at timestamptz not null default now()
);
alter table ventas alter column folio set default nuevo_folio_venta();
create index if not exists ventas_estado on ventas (estado, created_at desc);
create index if not exists ventas_socio on ventas (socio_id, created_at desc);
create index if not exists ventas_pagada on ventas (pagada_at desc) where estado = 'pagada';
create index if not exists ventas_reserva on ventas (reservacion_id);

create table if not exists venta_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references ventas (id) on delete cascade,
  producto_id uuid references productos (id) on delete set null,
  nombre text not null,
  precio_unit numeric not null check (precio_unit >= 0),
  cantidad int not null check (cantidad between 1 and 99),
  subtotal numeric not null
);
create index if not exists venta_items_venta on venta_items (venta_id);
create index if not exists venta_items_producto on venta_items (producto_id);

alter table reservaciones add column if not exists venta_id uuid references ventas (id) on delete set null;
-- Método de pago de las sesiones cobradas en mostrador
alter table cierres add column if not exists metodo_pago text not null default 'efectivo';
alter table cierres drop constraint if exists cierres_metodo_pago_check;
alter table cierres add constraint cierres_metodo_pago_check check (metodo_pago in ('efectivo', 'terminal', 'qr', 'en_linea'));

-- ---------------------------------------------------------------------
-- 3) LÓGICA DE INVENTARIO (interna)
-- ---------------------------------------------------------------------
-- accion: 'apartar' (pedido pendiente), 'liberar' (pendiente cancelado),
--         'confirmar' (venta pagada: sale del stock), 'devolver' (venta pagada cancelada)
create or replace function _stock_venta(p_venta uuid, p_accion text, p_usuario text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  it record;
  p productos;
  sin_stock boolean := coalesce((cfg('venta_sin_stock'))::text::boolean, false);
  v_estado_previo text;
begin
  for it in
    select producto_id, sum(cantidad)::int as cant, min(nombre) as nombre
    from venta_items where venta_id = p_venta and producto_id is not null
    group by producto_id order by producto_id     -- orden fijo: evita bloqueos cruzados
  loop
    select * into p from productos where id = it.producto_id for update;
    if p.id is null or not p.controla_stock then continue; end if;

    if p_accion = 'apartar' then
      if not sin_stock and p.stock - p.apartado < it.cant then
        raise exception 'Sin existencias suficientes de "%": quedan % disponibles', p.nombre, greatest(p.stock - p.apartado, 0)
          using errcode = 'P0001';
      end if;
      update productos set apartado = apartado + it.cant, updated_at = now() where id = p.id;

    elsif p_accion = 'liberar' then
      update productos set apartado = greatest(apartado - it.cant, 0), updated_at = now() where id = p.id;

    elsif p_accion in ('confirmar', 'confirmar_apartado') then
      if p_accion = 'confirmar' and not sin_stock and p.stock - p.apartado < it.cant then
        raise exception 'Sin existencias suficientes de "%": quedan % disponibles', p.nombre, greatest(p.stock - p.apartado, 0)
          using errcode = 'P0001';
      end if;
      update productos set
        stock = stock - it.cant,
        apartado = case when p_accion = 'confirmar_apartado' then greatest(apartado - it.cant, 0) else apartado end,
        updated_at = now()
      where id = p.id;
      insert into inventario_movs (producto_id, tipo, cantidad, stock_antes, stock_despues, venta_id, nota, creado_por)
      values (p.id, 'venta', -it.cant, p.stock, p.stock - it.cant, p_venta,
              (select 'Venta ' || folio from ventas where id = p_venta), p_usuario);

    elsif p_accion = 'devolver' then
      update productos set stock = stock + it.cant, updated_at = now() where id = p.id;
      insert into inventario_movs (producto_id, tipo, cantidad, stock_antes, stock_despues, venta_id, nota, creado_por)
      values (p.id, 'devolucion', it.cant, p.stock, p.stock + it.cant, p_venta,
              (select 'Cancelación ' || folio from ventas where id = p_venta), p_usuario);
    end if;
  end loop;
end;
$$;
revoke all on function _stock_venta(uuid, text, text) from public, anon, authenticated;

-- Crea una venta con sus artículos. Precios y descuentos SIEMPRE desde la base de datos.
-- p_items = [{"producto_id": "...", "cantidad": 2}, ...]
create or replace function _crear_venta(
  p_origen text, p_items jsonb, p_socio uuid, p_cliente text, p_cupon uuid,
  p_pago_preferido text, p_reservacion uuid default null
)
returns ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v ventas;
  it jsonb;
  p productos;
  cant int;
  sub numeric := 0;
  pct int := 0;
  desc_socio numeric := 0;
  desc_cupon numeric := 0;
  c cupones;
  n int := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido está vacío' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) > 40 then raise exception 'Demasiados productos en un pedido' using errcode = 'P0001'; end if;

  insert into ventas (origen, socio_id, cliente, pago_preferido, reservacion_id)
  values (p_origen, p_socio, left(nullif(trim(coalesce(p_cliente, '')), ''), 80), p_pago_preferido, p_reservacion)
  returning * into v;

  for it in select * from jsonb_array_elements(p_items) loop
    cant := (it ->> 'cantidad')::int;
    if cant is null or cant < 1 or cant > 99 then raise exception 'Cantidad inválida' using errcode = 'P0001'; end if;
    select * into p from productos where id = (it ->> 'producto_id')::uuid and activo;
    if p.id is null then raise exception 'Un producto ya no está disponible' using errcode = 'P0001'; end if;
    insert into venta_items (venta_id, producto_id, nombre, precio_unit, cantidad, subtotal)
    values (v.id, p.id, p.nombre, p.precio, cant, p.precio * cant);
    sub := sub + p.precio * cant;
    n := n + 1;
  end loop;

  if p_socio is not null then
    select r.desc_snacks into pct from socios s join rangos r on r.id = s.rango_id where s.user_id = p_socio;
    desc_socio := round(sub * coalesce(pct, 0) / 100.0);
  end if;

  if p_cupon is not null then
    select * into c from cupones where id = p_cupon and socio_id = p_socio and estado = 'disponible'
      and (vence_at is null or vence_at > now()) and aplica in ('snacks', 'todo');
    if c.id is null then raise exception 'Ese cupón no está disponible' using errcode = 'P0001'; end if;
    desc_cupon := least(sub - desc_socio,
      case when c.tipo = 'porcentaje' then round((sub - desc_socio) * c.valor / 100.0) else c.valor end);
  end if;

  update ventas set subtotal = sub, descuento_socio = desc_socio, descuento_cupon = desc_cupon,
    total = greatest(sub - desc_socio - desc_cupon, 0), cupon_id = c.id
  where id = v.id returning * into v;
  return v;
end;
$$;
revoke all on function _crear_venta(text, jsonb, uuid, text, uuid, text, uuid) from public, anon, authenticated;

-- Marca una venta como pagada: descuenta stock, canjea el cupón. Los puntos los suma el trigger.
create or replace function _pagar_venta(p_venta uuid, p_metodo text, p_recibido numeric, p_referencia text, p_usuario text)
returns ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v ventas;
  c cupones;
begin
  select * into v from ventas where id = p_venta for update;
  if v.id is null then raise exception 'Venta no encontrada' using errcode = 'P0001'; end if;
  if v.estado = 'pagada' then return v; end if;              -- idempotente (webhook repetido)
  if v.estado = 'cancelada' then raise exception 'La venta % está cancelada', v.folio using errcode = 'P0001'; end if;

  -- Si el cupón ya no sirve al momento de cobrar en mostrador, se cobra sin él
  if v.cupon_id is not null and p_metodo <> 'en_linea' then
    select * into c from cupones where id = v.cupon_id and estado = 'disponible' and (vence_at is null or vence_at > now());
    if c.id is null then
      update ventas set cupon_id = null, descuento_cupon = 0, total = greatest(subtotal - descuento_socio, 0)
      where id = v.id returning * into v;
    end if;
  end if;

  if p_metodo = 'efectivo' and p_recibido is not null and p_recibido < v.total then
    raise exception 'El efectivo recibido ($%) es menor al total ($%)', p_recibido, v.total using errcode = 'P0001';
  end if;

  -- Pendiente → el stock ya estaba apartado. Venta directa de POS → sale del stock disponible.
  perform _stock_venta(v.id, case when v.origen = 'pos' and v.vence_at is null and v.pago_preferido is null then 'confirmar' else 'confirmar_apartado' end, p_usuario);

  if v.cupon_id is not null then
    update cupones set estado = 'usado', usado_at = now(), usado_en = 'Venta ' || v.folio, descuento_aplicado = v.descuento_cupon
    where id = v.cupon_id and estado = 'disponible';
  end if;

  update ventas set estado = 'pagada', metodo_pago = p_metodo, pagada_at = now(), vence_at = null,
    recibido = case when p_metodo = 'efectivo' then coalesce(p_recibido, v.total) end,
    cambio = case when p_metodo = 'efectivo' then coalesce(p_recibido, v.total) - v.total end,
    referencia_pago = nullif(trim(coalesce(p_referencia, '')), ''), cobrado_por = p_usuario
  where id = v.id returning * into v;
  return v;
end;
$$;
revoke all on function _pagar_venta(uuid, text, numeric, text, text) from public, anon, authenticated;

create or replace function _cancelar_venta(p_venta uuid, p_motivo text, p_usuario text)
returns ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v ventas;
begin
  select * into v from ventas where id = p_venta for update;
  if v.id is null or v.estado = 'cancelada' then return v; end if;
  if v.estado = 'pendiente' then
    perform _stock_venta(v.id, 'liberar', p_usuario);
  else
    perform _stock_venta(v.id, 'devolver', p_usuario);
    -- el cupón usado regresa al socio
    if v.cupon_id is not null then
      update cupones set estado = 'disponible', usado_at = null, usado_en = null, descuento_aplicado = null
      where id = v.cupon_id and estado = 'usado' and (vence_at is null or vence_at > now());
    end if;
  end if;
  update ventas set estado = 'cancelada', cancelada_at = now(), motivo_cancelacion = left(p_motivo, 200), vence_at = null
  where id = v.id returning * into v;
  return v;
end;
$$;
revoke all on function _cancelar_venta(uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) PUNTOS: solo ventas pagadas
-- ---------------------------------------------------------------------
create or replace function trg_ventas_puntos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mult numeric;
  detalle text;
begin
  if new.socio_id is null or coalesce(current_setting('cleofas.sin_puntos', true), '') = '1' then return null; end if;

  if new.estado = 'pagada' and (tg_op = 'INSERT' or old.estado is distinct from 'pagada') and new.total > 0 then
    mult := multiplicador_puntos('snacks', coalesce(new.pagada_at, now()));
    select string_agg(cantidad || '× ' || nombre, ', ' order by nombre) into detalle from venta_items where venta_id = new.id;
    insert into movimientos (socio_id, tipo, descripcion, monto, puntos, ref, creado_por)
    values (new.socio_id, 'snack',
            (case new.origen when 'reserva' then 'Pedido con reserva' when 'tienda' then 'Pedido en tienda' else 'Compra en mostrador' end)
              || ' ' || new.folio || ': ' || coalesce(detalle, 'productos')
              || case when mult > 1 then ' · puntos x' || rtrim(to_char(mult, 'FM9.9'), '.') else '' end,
            new.total, floor(new.total * mult)::int, 'venta:' || new.folio, coalesce(new.cobrado_por, 'sistema'))
    on conflict (ref) do nothing;

  elsif tg_op = 'UPDATE' and old.estado = 'pagada' and new.estado = 'cancelada' then
    insert into movimientos (socio_id, tipo, descripcion, monto, puntos, ref, creado_por)
    select new.socio_id, 'ajuste', 'Venta cancelada ' || new.folio, 0, -m.puntos, 'venta-cancelada:' || new.folio, 'sistema'
    from movimientos m where m.ref = 'venta:' || new.folio and m.puntos > 0
    on conflict (ref) do nothing;
  end if;
  return null;
end;
$$;
drop trigger if exists ventas_puntos on ventas;
create trigger ventas_puntos after insert or update of estado on ventas
  for each row execute function trg_ventas_puntos();

-- Reservas: los puntos de las HORAS los da la reserva; los de los productos, su venta (al pagarse).
create or replace function trg_reservas_puntos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mult numeric;
  productos_en_linea numeric := 0;
  horas numeric;
  v ventas;
begin
  if new.venta_id is not null then select * into v from ventas where id = new.venta_id; end if;
  if v.id is not null and v.pago_preferido = 'en_linea' then productos_en_linea := v.total;
  elsif v.id is null and new.snacks_pago = 'en_linea' then productos_en_linea := coalesce(new.snacks_total, 0); -- pedidos anteriores
  end if;

  if new.estado = 'confirmada' and old.estado is distinct from 'confirmada' then
    if new.cupon_id is not null then
      update cupones set estado = 'usado', usado_at = now(), usado_en = 'Reserva ' || new.folio, descuento_aplicado = new.descuento_cupon
      where id = new.cupon_id and estado = 'disponible';
    end if;
    -- Productos pagados en línea junto con la reserva → su venta queda pagada (y da sus puntos)
    if v.id is not null and v.pago_preferido = 'en_linea' and v.estado = 'pendiente' then
      perform _pagar_venta(v.id, 'en_linea', null, to_jsonb(new) ->> 'stripe_payment_intent_id', 'en línea');
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
    end if;

  elsif new.estado in ('expirada', 'cancelada') and old.estado is distinct from new.estado then
    -- Reserva que no se pagó o se canceló: su pedido se cancela (libera o devuelve stock y puntos)
    if v.id is not null and v.estado <> 'cancelada' then
      perform _cancelar_venta(v.id, 'Reserva ' || new.folio || ' ' || new.estado, 'sistema');
    end if;
    if old.estado = 'confirmada' and new.estado = 'cancelada' and new.socio_id is not null then
      insert into movimientos (socio_id, tipo, descripcion, monto, puntos, ref, creado_por)
      select new.socio_id, 'ajuste', 'Reserva cancelada ' || new.folio, 0, -sum(m.puntos), 'reserva-cancelada:' || new.folio, 'sistema'
      from movimientos m where m.ref in ('reserva:' || new.folio, 'reserva-snacks:' || new.folio)
      having sum(m.puntos) > 0
      on conflict (ref) do nothing;
    end if;
  end if;
  return null;
end;
$$;

-- Los cierres de mostrador ya solo dan puntos por SESIONES (las ventas de tienda dan los suyos).
create or replace function trg_cierres_puntos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mult numeric;
begin
  if new.socio_id is not null and coalesce(new.precio, 0) > 0 and coalesce(new.tipo, 'sesion') = 'sesion' then
    mult := multiplicador_puntos('horas', now());
    insert into movimientos (socio_id, tipo, descripcion, monto, puntos, ref, creado_por)
    values (new.socio_id, 'sesion',
            'Sesión en ' || new.estacion || case when mult > 1 then ' · puntos x' || rtrim(to_char(mult, 'FM9.9'), '.') else '' end,
            new.precio, floor(new.precio * mult)::int, 'cierre:' || new.id, 'mostrador')
    on conflict (ref) do nothing;
  elsif new.socio_id is not null and coalesce(new.precio, 0) > 0 and new.tipo = 'snack' then
    -- compatibilidad: cobros de tienda anteriores al POS
    insert into movimientos (socio_id, tipo, descripcion, monto, puntos, ref, creado_por)
    values (new.socio_id, 'snack', 'Tienda: ' || coalesce(new.detalle, 'snacks'), new.precio,
            floor(new.precio * multiplicador_puntos('snacks', now()))::int, 'cierre:' || new.id, 'mostrador')
    on conflict (ref) do nothing;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) FUNCIONES PÚBLICAS
-- ---------------------------------------------------------------------
create or replace function _usuario() returns text language sql stable as $$ select coalesce(auth.jwt() ->> 'email', 'sistema') $$;

-- POS: venta presencial pagada en el momento
create or replace function pos_vender(
  p_items jsonb, p_metodo text, p_socio uuid default null, p_cupon uuid default null,
  p_recibido numeric default null, p_referencia text default null, p_cliente text default null
)
returns ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v ventas;
begin
  if not es_equipo() then raise exception 'Solo el equipo puede vender' using errcode = '42501'; end if;
  if p_metodo not in ('efectivo', 'terminal', 'qr') then raise exception 'Método de pago inválido' using errcode = 'P0001'; end if;
  v := _crear_venta('pos', p_items, p_socio, coalesce(p_cliente, (select nombre from socios where user_id = p_socio), 'Mostrador'), p_cupon, null);
  v := _pagar_venta(v.id, p_metodo, p_recibido, p_referencia, _usuario());
  -- En mostrador el cliente se lleva sus productos en el momento
  update ventas set entrega = 'entregada', entregada_at = now() where id = v.id returning * into v;
  return v;
end;
$$;

-- Cobrar en mostrador un pedido pendiente (tienda del socio o productos de una reserva)
create or replace function cobrar_venta(p_venta uuid, p_metodo text, p_recibido numeric default null, p_referencia text default null)
returns ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v ventas;
begin
  if not es_equipo() then raise exception 'Solo el equipo puede cobrar' using errcode = '42501'; end if;
  if p_metodo not in ('efectivo', 'terminal', 'qr') then raise exception 'Método de pago inválido' using errcode = 'P0001'; end if;
  select * into v from ventas where id = p_venta;
  if v.estado = 'pagada' then raise exception 'La venta % ya está pagada', v.folio using errcode = 'P0001'; end if;
  if v.reservacion_id is not null and not exists (select 1 from reservaciones where id = v.reservacion_id and estado = 'confirmada') then
    raise exception 'La reserva de este pedido no está confirmada' using errcode = 'P0001';
  end if;
  return _pagar_venta(p_venta, p_metodo, p_recibido, p_referencia, _usuario());
end;
$$;

create or replace function entregar_venta(p_venta uuid, p_entregada boolean default true)
returns ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v ventas;
begin
  if not es_equipo() then raise exception 'Solo el equipo puede entregar' using errcode = '42501'; end if;
  update ventas set entrega = case when p_entregada then 'entregada' else 'pendiente' end,
    entregada_at = case when p_entregada then now() end
  where id = p_venta and estado <> 'cancelada' returning * into v;
  if v.id is null then raise exception 'Venta no encontrada o cancelada' using errcode = 'P0001'; end if;
  return v;
end;
$$;

create or replace function cancelar_venta(p_venta uuid, p_motivo text)
returns ventas
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_equipo() then raise exception 'Solo el equipo puede cancelar ventas' using errcode = '42501'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribe el motivo de la cancelación' using errcode = 'P0001'; end if;
  return _cancelar_venta(p_venta, p_motivo, _usuario());
end;
$$;

-- El socio cancela su propio pedido pendiente
create or replace function cancelar_mi_pedido(p_venta uuid)
returns ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v ventas;
begin
  select * into v from ventas where id = p_venta and socio_id = auth.uid();
  if v.id is null then raise exception 'Pedido no encontrado' using errcode = 'P0001'; end if;
  if v.estado <> 'pendiente' then raise exception 'Solo puedes cancelar pedidos que aún no se pagan' using errcode = 'P0001'; end if;
  if v.reservacion_id is not null then raise exception 'Este pedido va con tu reserva; escríbenos para cambiarlo' using errcode = 'P0001'; end if;
  return _cancelar_venta(p_venta, 'Cancelado por el socio', 'socio');
end;
$$;

-- Movimiento manual de inventario: entrada, ajuste (+/-) o merma
create or replace function mover_inventario(p_producto uuid, p_tipo text, p_cantidad int, p_nota text default null)
returns productos
language plpgsql
security definer
set search_path = public
as $$
declare
  p productos;
  delta int;
begin
  if not es_equipo() then raise exception 'Solo el equipo puede mover inventario' using errcode = '42501'; end if;
  if p_tipo not in ('entrada', 'ajuste', 'merma') then raise exception 'Tipo de movimiento inválido' using errcode = 'P0001'; end if;
  if p_cantidad is null or p_cantidad = 0 then raise exception 'La cantidad no puede ser 0' using errcode = 'P0001'; end if;
  delta := case when p_tipo = 'entrada' then abs(p_cantidad) when p_tipo = 'merma' then -abs(p_cantidad) else p_cantidad end;
  select * into p from productos where id = p_producto for update;
  if p.id is null then raise exception 'Producto no encontrado' using errcode = 'P0001'; end if;
  if p.stock + delta < 0 then raise exception 'El stock no puede quedar negativo (hay %)', p.stock using errcode = 'P0001'; end if;
  update productos set stock = stock + delta, updated_at = now() where id = p.id returning * into p;
  insert into inventario_movs (producto_id, tipo, cantidad, stock_antes, stock_despues, nota, creado_por)
  values (p.id, p_tipo, delta, p.stock - delta, p.stock, left(p_nota, 200), _usuario());
  return p;
end;
$$;

-- Pedidos de clientes (los llama el servidor /api/pedido y /api/checkout con la llave de servicio)
create or replace function crear_pedido(
  p_socio uuid, p_items jsonb, p_pago_preferido text, p_cupon uuid default null,
  p_reservacion uuid default null, p_vence timestamptz default null, p_cliente text default null
)
returns ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v ventas;
begin
  if p_pago_preferido not in ('en_linea', 'presencial') then raise exception 'Elige cómo pagar' using errcode = 'P0001'; end if;
  v := _crear_venta(case when p_reservacion is null then 'tienda' else 'reserva' end, p_items, p_socio,
                    coalesce(p_cliente, (select nombre from socios where user_id = p_socio)), p_cupon, p_pago_preferido, p_reservacion);
  perform _stock_venta(v.id, 'apartar', 'cliente');
  update ventas set vence_at = coalesce(p_vence, now() + make_interval(hours => coalesce((cfg('pedido_vigencia_horas'))::text::int, 24)))
  where id = v.id returning * into v;
  if p_reservacion is not null then update reservaciones set venta_id = v.id where id = p_reservacion; end if;
  return v;
end;
$$;
revoke all on function crear_pedido(uuid, jsonb, text, uuid, uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function crear_pedido(uuid, jsonb, text, uuid, uuid, timestamptz, text) to service_role;

create or replace function confirmar_pago_en_linea(p_venta uuid, p_referencia text)
returns ventas
language sql
security definer
set search_path = public
as $$ select _pagar_venta(p_venta, 'en_linea', null, p_referencia, 'en línea') $$;
revoke all on function confirmar_pago_en_linea(uuid, text) from public, anon, authenticated;
grant execute on function confirmar_pago_en_linea(uuid, text) to service_role;

-- El servidor cancela un pedido cuyo pago en línea expiró o se canceló en Stripe
create or replace function cancelar_venta_sistema(p_venta uuid, p_motivo text)
returns ventas
language sql
security definer
set search_path = public
as $$ select _cancelar_venta(p_venta, p_motivo, 'sistema') $$;
revoke all on function cancelar_venta_sistema(uuid, text) from public, anon, authenticated;
grant execute on function cancelar_venta_sistema(uuid, text) to service_role;

-- Libera pedidos pendientes vencidos (los llama el servidor y la tarea diaria)
create or replace function liberar_pedidos_vencidos()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int := 0;
begin
  for r in select id from ventas where estado = 'pendiente' and vence_at is not null and vence_at < now() limit 500 loop
    perform _cancelar_venta(r.id, 'Venció sin pagarse', 'sistema');
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function liberar_pedidos_vencidos() from public, anon;
grant execute on function liberar_pedidos_vencidos() to authenticated, service_role;

-- Datos completos de productos para el panel (incluye costo, que el público no ve)
create or replace function productos_admin()
returns table (
  id uuid, nombre text, descripcion text, categoria text, precio numeric, costo numeric, codigo_barras text, imagen_url text,
  stock int, apartado int, stock_minimo int, controla_stock boolean, activo boolean, orden int, updated_at timestamptz,
  vendidos_30d bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nombre, p.descripcion, p.categoria, p.precio, coalesce(c.costo, 0), p.codigo_barras, p.imagen_url,
         p.stock, p.apartado, p.stock_minimo, p.controla_stock, p.activo, p.orden, p.updated_at,
         coalesce((select sum(vi.cantidad) from venta_items vi join ventas v on v.id = vi.venta_id
                   where vi.producto_id = p.id and v.estado = 'pagada' and v.pagada_at > now() - interval '30 days'), 0)
  from productos p left join producto_costos c on c.producto_id = p.id
  where es_equipo()
  order by p.categoria, p.orden, p.nombre
$$;

-- Reporte de ventas (equipo): totales por día, método, origen y productos más vendidos
create or replace function reporte_ventas(p_desde date, p_hasta date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with v as (
    select * from ventas
    where es_equipo() and estado = 'pagada'
      and (pagada_at at time zone 'America/Mexico_City')::date between p_desde and p_hasta
  ), items as (
    select vi.*, coalesce(c.costo, 0) as costo from venta_items vi
    join v on v.id = vi.venta_id left join producto_costos c on c.producto_id = vi.producto_id
  )
  select jsonb_build_object(
    'total', coalesce((select sum(total) from v), 0),
    'ventas', (select count(*) from v),
    'ticket_promedio', coalesce((select round(avg(total), 2) from v), 0),
    'descuentos', coalesce((select sum(descuento_socio + descuento_cupon) from v), 0),
    'costo', coalesce((select sum(costo * cantidad) from items), 0),
    'por_metodo', coalesce((select jsonb_object_agg(metodo_pago, t) from (select metodo_pago, sum(total) t from v group by 1) x), '{}'),
    'por_origen', coalesce((select jsonb_object_agg(origen, t) from (select origen, sum(total) t from v group by 1) x), '{}'),
    'por_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', d, 'total', t, 'ventas', n) order by d)
                from (select (pagada_at at time zone 'America/Mexico_City')::date d, sum(total) t, count(*) n from v group by 1) x), '[]'),
    'top', coalesce((select jsonb_agg(x order by x.unidades desc) from (
                select nombre, sum(cantidad) unidades, sum(subtotal) importe, sum(subtotal - costo * cantidad) utilidad
                from items group by nombre order by sum(cantidad) desc limit 10) x), '[]')
  )
$$;

-- ---------------------------------------------------------------------
-- 6) PEDIDOS ANTERIORES (reserva_productos) → ventas, sin repetir puntos ni mover stock
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  v ventas;
begin
  perform set_config('cleofas.sin_puntos', '1', true);
  for r in select * from reservaciones where snacks_pago is not null and venta_id is null loop
    insert into ventas (origen, reservacion_id, socio_id, cliente, estado, entrega, pago_preferido, metodo_pago,
                        subtotal, descuento_socio, total, pagada_at, entregada_at, created_at)
    values ('reserva', r.id, r.socio_id, r.cliente,
            case when r.estado in ('cancelada', 'expirada') then 'cancelada' when r.snacks_estado = 'pagado' then 'pagada' else 'pendiente' end,
            case when r.snacks_entregado_at is not null then 'entregada' else 'pendiente' end,
            case when r.snacks_pago = 'efectivo' then 'presencial' else 'en_linea' end,
            case when r.snacks_estado = 'pagado' then (case when r.snacks_pago = 'efectivo' then 'efectivo' else 'en_linea' end) end,
            r.snacks_subtotal, r.snacks_descuento, r.snacks_total,
            r.snacks_cobrado_at, r.snacks_entregado_at, r.created_at)
    returning * into v;
    insert into venta_items (venta_id, producto_id, nombre, precio_unit, cantidad, subtotal)
    select v.id, producto_id, nombre, precio_unit, cantidad, precio_unit * cantidad from reserva_productos where reservacion_id = r.id;
    update reservaciones set venta_id = v.id where id = r.id;
  end loop;
  perform set_config('cleofas.sin_puntos', '', true);
end;
$$;

update ventas set entrega = 'entregada', entregada_at = coalesce(entregada_at, pagada_at) where origen = 'pos' and estado = 'pagada' and entrega = 'pendiente';

-- ---------------------------------------------------------------------
-- 7) SEGURIDAD
-- ---------------------------------------------------------------------
alter table config_negocio  enable row level security;
alter table producto_costos enable row level security;
alter table inventario_movs enable row level security;
alter table ventas          enable row level security;
alter table venta_items     enable row level security;

drop policy if exists "todos leen config" on config_negocio;
drop policy if exists "equipo cambia config" on config_negocio;
create policy "todos leen config" on config_negocio for select to anon, authenticated using (true);
create policy "equipo cambia config" on config_negocio for all to authenticated using (es_equipo()) with check (es_equipo());

drop policy if exists "equipo gestiona costos" on producto_costos;
create policy "equipo gestiona costos" on producto_costos for all to authenticated using (es_equipo()) with check (es_equipo());

drop policy if exists "equipo ve inventario" on inventario_movs;
create policy "equipo ve inventario" on inventario_movs for select to authenticated using (es_equipo());

drop policy if exists "socio ve sus ventas" on ventas;
drop policy if exists "equipo ve ventas" on ventas;
create policy "socio ve sus ventas" on ventas for select to authenticated using (socio_id = auth.uid() or es_equipo());

drop policy if exists "socio ve sus articulos" on venta_items;
create policy "socio ve sus articulos" on venta_items for select to authenticated using (
  exists (select 1 from ventas v where v.id = venta_id and (v.socio_id = auth.uid() or es_equipo()))
);

-- Las ventas e inventario SOLO cambian por las funciones de arriba (validan permisos, precios y existencias).
revoke all on config_negocio, producto_costos, inventario_movs, ventas, venta_items from anon, authenticated;
grant select on config_negocio to anon, authenticated;
grant insert, update, delete on config_negocio to authenticated;
grant select, insert, update, delete on producto_costos to authenticated;
grant select on inventario_movs, ventas, venta_items to authenticated;
grant all on config_negocio, producto_costos, inventario_movs, ventas, venta_items to service_role;
grant usage, select on sequence inventario_movs_id_seq to service_role;

-- El stock y lo apartado solo cambian por movimientos de inventario y ventas (no editando el producto a mano)
create or replace function trg_productos_proteger_stock()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated' then
    new.stock := old.stock;
    new.apartado := old.apartado;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists productos_proteger_stock on productos;
create trigger productos_proteger_stock before update on productos
  for each row execute function trg_productos_proteger_stock();

-- Alta de producto con existencia inicial: queda registrada como entrada
create or replace function trg_productos_stock_inicial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stock <> 0 then
    insert into inventario_movs (producto_id, tipo, cantidad, stock_antes, stock_despues, nota, creado_por)
    values (new.id, 'entrada', new.stock, 0, new.stock, 'Existencia inicial', _usuario());
  end if;
  return null;
end;
$$;
drop trigger if exists productos_stock_inicial on productos;
create trigger productos_stock_inicial after insert on productos
  for each row execute function trg_productos_stock_inicial();

-- Funciones que puede llamar el navegador (cada una revisa quién la llama)
revoke all on function pos_vender(jsonb, text, uuid, uuid, numeric, text, text) from public, anon;
revoke all on function cobrar_venta(uuid, text, numeric, text) from public, anon;
revoke all on function entregar_venta(uuid, boolean) from public, anon;
revoke all on function cancelar_venta(uuid, text) from public, anon;
revoke all on function cancelar_mi_pedido(uuid) from public, anon;
revoke all on function mover_inventario(uuid, text, int, text) from public, anon;
revoke all on function productos_admin() from public, anon;
revoke all on function reporte_ventas(date, date) from public, anon;
grant execute on function pos_vender(jsonb, text, uuid, uuid, numeric, text, text), cobrar_venta(uuid, text, numeric, text),
  entregar_venta(uuid, boolean), cancelar_venta(uuid, text), cancelar_mi_pedido(uuid), mover_inventario(uuid, text, int, text),
  productos_admin(), reporte_ventas(date, date) to authenticated;

-- ---------------------------------------------------------------------
-- 7b) BLINDAJE: en Supabase toda función nueva la puede ejecutar cualquiera (anon/authenticated)
--     salvo que se le quite explícitamente. Las internas quedan solo para el servidor.
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'emitir_por_regla(text, uuid, text)', 'sincronizar_socio(uuid)', 'procesar_automatizaciones(text)',
    '_stock_venta(uuid, text, text)', '_crear_venta(text, jsonb, uuid, text, uuid, text, uuid)',
    '_pagar_venta(uuid, text, numeric, text, text)', '_cancelar_venta(uuid, text, text)',
    'crear_pedido(uuid, jsonb, text, uuid, uuid, timestamptz, text)', 'confirmar_pago_en_linea(uuid, text)',
    'cancelar_venta_sistema(uuid, text)',
    'nuevo_codigo_socio()', 'nuevo_codigo_cupon()', 'nuevo_folio_venta()', 'cfg(text)', '_usuario()',
    'trg_nuevo_socio()', 'trg_correo_socio()', 'trg_socios_rango()', 'trg_cierres_puntos()', 'trg_reservas_puntos()',
    'trg_movimientos_sync()', 'trg_rangos_sync()', 'trg_ventas_puntos()', 'trg_productos_stock_inicial()'
  ] loop
    begin
      execute format('revoke all on function %s from public, anon, authenticated', f);
    exception when undefined_function then null;
    end;
  end loop;
end;
$$;
grant execute on function procesar_automatizaciones(text), crear_pedido(uuid, jsonb, text, uuid, uuid, timestamptz, text),
  confirmar_pago_en_linea(uuid, text), cancelar_venta_sistema(uuid, text), liberar_pedidos_vencidos() to service_role;
-- es_equipo() la usan las políticas también para visitantes sin sesión (responde false)
grant execute on function es_equipo() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 8) TIEMPO REAL (existencias y estado de pedidos al instante)
-- ---------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table productos; exception when others then null; end;
  begin alter publication supabase_realtime add table ventas; exception when others then null; end;
end;
$$;

-- ---------------------------------------------------------------------
-- 9) FOTOS DE PRODUCTOS (bucket público "productos")
-- ---------------------------------------------------------------------
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('productos', 'productos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = true;
  drop policy if exists "equipo sube fotos de productos" on storage.objects;
  drop policy if exists "equipo borra fotos de productos" on storage.objects;
  create policy "equipo sube fotos de productos" on storage.objects
    for insert to authenticated with check (bucket_id = 'productos' and public.es_equipo());
  create policy "equipo borra fotos de productos" on storage.objects
    for delete to authenticated using (bucket_id = 'productos' and public.es_equipo());
exception when others then
  raise warning 'No se pudo preparar el bucket de fotos (%). Usa enlaces de imagen.', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------
-- 10) COMPROBACIÓN
-- ---------------------------------------------------------------------
select 'productos' as que, count(*)::text as total from productos
union all select 'ventas', count(*)::text from ventas
union all select 'pedidos anteriores migrados', count(*)::text from ventas where origen = 'reserva'
union all select 'vender sin existencias', (cfg('venta_sin_stock'))::text;
