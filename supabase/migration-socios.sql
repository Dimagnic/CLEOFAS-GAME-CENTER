-- =====================================================================
-- Cleofas Game Center · SOCIOS Y FIDELIZACIÓN (Fase 1)
-- Supabase → SQL Editor → New query → pega TODO → Run.
-- Es seguro repetirlo: no borra socios, puntos, ventas ni reservaciones.
-- Requiere que ya existan: reservaciones, cierres, estaciones, equipo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) ¿Quién es del equipo? (por correo, como ya funciona tu base, o por user_id)
-- ---------------------------------------------------------------------
alter table equipo add column if not exists user_id uuid references auth.users (id) on delete cascade;

create or replace function es_equipo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.equipo
    where user_id = auth.uid()
       or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function es_equipo() from public;
grant execute on function es_equipo() to authenticated;

-- ---------------------------------------------------------------------
-- 1) RANGOS (se editan desde el panel → Rangos)
-- ---------------------------------------------------------------------
create table if not exists rangos (
  id serial primary key,
  nombre text not null unique,
  min_puntos int not null unique check (min_puntos >= 0),
  desc_horas int not null default 0 check (desc_horas between 0 and 50),
  desc_snacks int not null default 0 check (desc_snacks between 0 and 50),
  color text not null default '#9FB0CC',
  beneficios text[] not null default '{}',
  created_at timestamptz not null default now()
);

insert into rangos (nombre, min_puntos, desc_horas, desc_snacks, color, beneficios) values
  ('Novato',  0,    0,  0,  '#9FB0CC', array['Acumulas 1 punto por cada $1 que gastas', 'Historial de tus partidas y compras', 'Código QR de socio para sumar puntos en mostrador']),
  ('Pro',     500,  5,  5,  '#2EC4FF', array['5% de descuento en horas y paquetes', '5% de descuento en snacks y bebidas', 'Todo lo de Novato']),
  ('Élite',   1500, 10, 10, '#B46BFF', array['10% de descuento en horas y paquetes', '10% de descuento en snacks y bebidas', 'Acceso anticipado a torneos y eventos']),
  ('Leyenda', 4000, 15, 15, '#FFB238', array['15% de descuento en horas y paquetes', '15% de descuento en snacks y bebidas', 'Lugar asegurado en torneos', 'Trato preferente en reservas'])
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------
-- 2) SOCIOS (uno por cuenta creada en la página)
-- ---------------------------------------------------------------------
create table if not exists socios (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  email text not null,
  telefono text,
  codigo text not null unique,            -- va en el QR del socio, ej. S-7K3MQ2
  puntos int not null default 0,          -- puntos acumulados (se calculan solos)
  rango_id int references rangos (id) on delete set null,
  rango_manual boolean not null default false, -- true = el rango lo fijó el admin, no se recalcula
  notas text,
  created_at timestamptz not null default now()
);
create index if not exists socios_email on socios (lower(email));

-- Historial de puntos: consumo, reservas, ventas de snacks y ajustes manuales.
create table if not exists movimientos (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references socios (user_id) on delete cascade,
  tipo text not null check (tipo in ('reserva', 'sesion', 'snack', 'ajuste')),
  descripcion text,
  monto numeric not null default 0,       -- lo que pagó (0 en ajustes)
  puntos int not null,
  ref text unique,                        -- evita sumar dos veces el mismo pago
  creado_por text,
  created_at timestamptz not null default now()
);
create index if not exists movimientos_socio on movimientos (socio_id, created_at desc);

-- Productos de la tienda (snacks y bebidas)
create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  precio numeric not null check (precio >= 0),
  categoria text not null default 'Snacks',
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

-- Ligar consumo con socios
alter table cierres       add column if not exists socio_id uuid references socios (user_id) on delete set null;
alter table cierres       add column if not exists tipo text not null default 'sesion';
alter table cierres       add column if not exists descuento numeric not null default 0;
alter table cierres       add column if not exists detalle text;
alter table estaciones    add column if not exists socio_id uuid references socios (user_id) on delete set null;
alter table estaciones    add column if not exists descuento numeric not null default 0;
alter table reservaciones add column if not exists socio_id uuid references socios (user_id) on delete set null;
alter table reservaciones add column if not exists descuento numeric not null default 0;

-- ---------------------------------------------------------------------
-- 3) AUTOMATIZACIÓN
-- ---------------------------------------------------------------------

-- Código único de socio para el QR
create or replace function nuevo_codigo_socio()
returns text
language plpgsql
as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := 'S-';
    for i in 1..6 loop
      c := c || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.socios where codigo = c);
  end loop;
  return c;
end;
$$;

-- Recalcula puntos y rango de un socio
create or replace function sincronizar_socio(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total int;
begin
  select coalesce(sum(puntos), 0) into total from movimientos where socio_id = uid;
  update socios s set
    puntos = greatest(total, 0),
    rango_id = case when s.rango_manual then s.rango_id else
      (select r.id from rangos r where r.min_puntos <= greatest(total, 0) order by r.min_puntos desc limit 1) end
  where s.user_id = uid;
end;
$$;
revoke all on function sincronizar_socio(uuid) from public;

create or replace function trg_movimientos_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then perform sincronizar_socio(new.socio_id); end if;
  if tg_op in ('UPDATE', 'DELETE') and old.socio_id is distinct from new.socio_id or tg_op = 'DELETE' then
    perform sincronizar_socio(old.socio_id);
  end if;
  return null;
end;
$$;
drop trigger if exists movimientos_sync on movimientos;
create trigger movimientos_sync after insert or update or delete on movimientos
  for each row execute function trg_movimientos_sync();

-- Si cambias los rangos en el panel, todos los socios se reacomodan
create or replace function trg_rangos_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update socios s set rango_id =
    (select r.id from rangos r where r.min_puntos <= s.puntos order by r.min_puntos desc limit 1)
  where not s.rango_manual;
  return null;
end;
$$;
drop trigger if exists rangos_sync on rangos;
create trigger rangos_sync after insert or update or delete on rangos
  for each statement execute function trg_rangos_sync();

-- Cada cuenta nueva de la página se vuelve socio (rango inicial automático)
create or replace function trg_nuevo_socio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into socios (user_id, nombre, email, telefono, codigo, rango_id)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'nombre', ''), 80),
    lower(new.email),
    nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'telefono', ''), '\D', '', 'g'), ''),
    nuevo_codigo_socio(),
    (select id from rangos order by min_puntos limit 1)
  )
  on conflict (user_id) do nothing;
  return new;
exception when others then
  -- Nunca impedir que la persona cree su cuenta; el socio se puede crear después.
  raise warning 'No se pudo crear el socio de %: %', new.email, sqlerrm;
  return new;
end;
$$;
drop trigger if exists auth_nuevo_socio on auth.users;
create trigger auth_nuevo_socio after insert on auth.users
  for each row execute function trg_nuevo_socio();

-- Mantener el correo del socio igual al de su cuenta
create or replace function trg_correo_socio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update socios set email = lower(new.email) where user_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists auth_correo_socio on auth.users;
create trigger auth_correo_socio after update of email on auth.users
  for each row execute function trg_correo_socio();

-- Un socio solo puede cambiar su nombre y teléfono; lo demás lo controla el sistema o el equipo.
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
  end if;
  return new;
end;
$$;
drop trigger if exists socios_proteger on socios;
create trigger socios_proteger before update on socios
  for each row execute function trg_socios_proteger();

-- Cuando el admin fija o libera el rango, se recalcula
create or replace function trg_socios_rango()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rango_manual is distinct from old.rango_manual and not new.rango_manual then
    perform sincronizar_socio(new.user_id);
  end if;
  return null;
end;
$$;
drop trigger if exists socios_rango on socios;
create trigger socios_rango after update of rango_manual on socios
  for each row execute function trg_socios_rango();

-- Cobro en mostrador (sesión o snacks) a un socio → suma puntos (1 por cada $1)
create or replace function trg_cierres_puntos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.socio_id is not null and coalesce(new.precio, 0) > 0 then
    insert into movimientos (socio_id, tipo, descripcion, monto, puntos, ref, creado_por)
    values (
      new.socio_id,
      case when new.tipo = 'snack' then 'snack' else 'sesion' end,
      case when new.tipo = 'snack' then 'Tienda: ' || coalesce(new.detalle, 'snacks')
           else 'Sesión en ' || new.estacion end,
      new.precio,
      floor(new.precio)::int,
      'cierre:' || new.id,
      'mostrador'
    )
    on conflict (ref) do nothing;
  end if;
  return null;
end;
$$;
drop trigger if exists cierres_puntos on cierres;
create trigger cierres_puntos after insert on cierres
  for each row execute function trg_cierres_puntos();

-- Reserva en línea pagada por un socio → suma puntos; si se cancela después, se restan
create or replace function trg_reservas_puntos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.socio_id is null then return null; end if;
  if new.estado = 'confirmada' and old.estado is distinct from 'confirmada' then
    insert into movimientos (socio_id, tipo, descripcion, monto, puntos, ref, creado_por)
    values (new.socio_id, 'reserva', 'Reserva en línea ' || new.folio || ' · ' || new.estacion,
            new.monto, floor(new.monto)::int, 'reserva:' || new.folio, 'en línea')
    on conflict (ref) do nothing;
  elsif old.estado = 'confirmada' and new.estado = 'cancelada' then
    insert into movimientos (socio_id, tipo, descripcion, monto, puntos, ref, creado_por)
    values (new.socio_id, 'ajuste', 'Reserva cancelada ' || new.folio, 0, -floor(new.monto)::int,
            'reserva-cancelada:' || new.folio, 'sistema')
    on conflict (ref) do nothing;
  end if;
  return null;
end;
$$;
drop trigger if exists reservas_puntos on reservaciones;
create trigger reservas_puntos after update of estado on reservaciones
  for each row execute function trg_reservas_puntos();

-- ---------------------------------------------------------------------
-- 4) SEGURIDAD (RLS)
--    Socio: ve y edita SOLO lo suyo. Equipo: ve y gestiona todo.
-- ---------------------------------------------------------------------
alter table rangos      enable row level security;
alter table socios      enable row level security;
alter table movimientos enable row level security;
alter table productos   enable row level security;

drop policy if exists "todos ven rangos" on rangos;
drop policy if exists "equipo gestiona rangos" on rangos;
create policy "todos ven rangos" on rangos for select to anon, authenticated using (true);
create policy "equipo gestiona rangos" on rangos for all to authenticated using (es_equipo()) with check (es_equipo());

drop policy if exists "socio ve su perfil" on socios;
drop policy if exists "socio edita su perfil" on socios;
drop policy if exists "equipo gestiona socios" on socios;
create policy "socio ve su perfil" on socios for select to authenticated using (user_id = auth.uid() or es_equipo());
create policy "socio edita su perfil" on socios for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "equipo gestiona socios" on socios for all to authenticated using (es_equipo()) with check (es_equipo());

drop policy if exists "socio ve sus movimientos" on movimientos;
drop policy if exists "equipo gestiona movimientos" on movimientos;
create policy "socio ve sus movimientos" on movimientos for select to authenticated using (socio_id = auth.uid() or es_equipo());
create policy "equipo gestiona movimientos" on movimientos for all to authenticated using (es_equipo()) with check (es_equipo());

drop policy if exists "todos ven productos activos" on productos;
drop policy if exists "equipo gestiona productos" on productos;
create policy "todos ven productos activos" on productos for select to anon, authenticated using (activo or es_equipo());
create policy "equipo gestiona productos" on productos for all to authenticated using (es_equipo()) with check (es_equipo());

-- El socio puede ver sus propias reservaciones (además del equipo)
drop policy if exists "socio ve sus reservaciones" on reservaciones;
create policy "socio ve sus reservaciones" on reservaciones for select to authenticated using (socio_id = auth.uid());

revoke all on socios, movimientos from anon;
grant select on rangos, productos to anon;
grant select, insert, update, delete on rangos, productos, movimientos to authenticated;
grant select, update on socios to authenticated;
grant usage, select on sequence rangos_id_seq to authenticated;
grant all on rangos, socios, movimientos, productos to service_role;

-- ---------------------------------------------------------------------
-- 5) COMPROBACIÓN
-- ---------------------------------------------------------------------
select 'rangos' as tabla, count(*)::text as filas from rangos
union all select 'socios', count(*)::text from socios
union all select 'movimientos', count(*)::text from movimientos
union all select 'productos', count(*)::text from productos
union all select 'equipo puede entrar al panel', string_agg(email, ', ') from equipo;
