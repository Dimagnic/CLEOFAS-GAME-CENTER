-- Cleofas Game Center · esquema inicial de Supabase
-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.

create table if not exists reservaciones (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  cliente text not null,
  estacion text not null,
  fecha date not null,
  hora time not null,
  duracion_h int not null default 1,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmada', 'cancelada')),
  created_at timestamptz not null default now()
);

create table if not exists cierres (
  id uuid primary key default gen_random_uuid(),
  estacion text not null,
  cliente text,
  precio numeric not null default 0,
  hora text not null,
  created_at timestamptz not null default now()
);

alter table reservaciones enable row level security;
alter table cierres enable row level security;

-- Cualquier visitante puede crear una reservación desde la página pública.
create policy "cualquiera puede reservar"
  on reservaciones for insert
  to anon
  with check (true);

-- Solo el equipo (usuarios autenticados en el panel) puede ver y actualizar.
create policy "equipo lee reservaciones"
  on reservaciones for select
  to authenticated
  using (true);

create policy "equipo actualiza reservaciones"
  on reservaciones for update
  to authenticated
  using (true);

-- Los cierres de caja solo los crea y lee el equipo desde el panel.
create policy "equipo gestiona cierres"
  on cierres for all
  to authenticated
  using (true)
  with check (true);
