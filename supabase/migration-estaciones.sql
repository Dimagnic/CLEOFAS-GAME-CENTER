-- Cleofas Game Center · estado de estaciones compartido (panel ⇄ página pública)
-- Ejecuta esto en el SQL Editor de Supabase. Es seguro repetirlo.

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

insert into estaciones (id, tipo, specs) values
  ('PC-01', 'PC gaming', 'RTX 4060 · 165Hz'),
  ('PC-02', 'PC gaming', 'RTX 4060 · 165Hz'),
  ('PC-03', 'PC gaming', 'RTX 4060 · 165Hz'),
  ('PC-04', 'PC gaming', 'RTX 3060 · 144Hz'),
  ('PC-05', 'PC gaming', 'RTX 3060 · 144Hz'),
  ('PC-06', 'PC gaming', 'RTX 3060 · 144Hz'),
  ('PC-07', 'PC gaming', 'RTX 4060 · 165Hz'),
  ('PC-08', 'PC gaming', 'RTX 3060 · 144Hz'),
  ('PS-01', 'Consola PS5', 'Sala consolas'),
  ('PS-02', 'Consola PS5', 'Sala consolas')
on conflict (id) do nothing;

alter table estaciones enable row level security;

-- Solo el equipo (panel) puede ver y cambiar la tabla completa (incluye nombres de clientes y precios).
drop policy if exists "equipo gestiona estaciones" on estaciones;
create policy "equipo gestiona estaciones"
  on estaciones for all to authenticated using (true) with check (true);

-- El público solo ve esta vista: estado y hora de fin, sin nombres ni precios.
create or replace view estaciones_publicas as
  select id, tipo, specs, estado, fin_sesion from estaciones;
grant select on estaciones_publicas to anon, authenticated;
