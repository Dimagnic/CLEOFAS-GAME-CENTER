-- Cleofas Game Center · estaciones reales (5 PC y 6 Xbox). Ejecuta TODO en el SQL Editor de Supabase.
-- Es seguro repetirlo.

-- 1) Crea las que falten y actualiza las especificaciones de las que ya existen (PC-01 a PC-05 conservan su estado).
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

-- 2) Quita las estaciones de ejemplo que ya no existen (PC-06 a PC-08 y las dos PS5).
delete from estaciones where id in ('PC-06', 'PC-07', 'PC-08', 'PS-01', 'PS-02');
