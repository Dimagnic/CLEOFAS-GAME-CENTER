export const TARIFAS = [
  { id: 'hora', nombre: '1 hora', precio: 35, detalle: 'Tarifa sencilla, sin compromiso' },
  { id: 'paq3', nombre: 'Paquete 3 horas', precio: 90, detalle: 'Ahorras $15 vs. por hora', destacado: true },
  { id: 'paq5', nombre: 'Paquete 5 horas', precio: 140, detalle: 'Ahorras $35 vs. por hora' },
  { id: 'mensual', nombre: 'Pase entre semana', precio: 650, detalle: 'Acceso lunes a viernes, 3–8 pm' },
]

// Estado de cada estación en piso, tal como lo vería el encargado en el panel.
// 'libre' = disponible ahora · 'sesion' = con cliente y tiempo corriendo ·
// 'mantenimiento' = fuera de servicio temporalmente.
export const ESTACIONES = [
  { id: 'PC-01', tipo: 'PC gaming', estado: 'sesion', cliente: 'Iker M.', restanteMin: 42, specs: 'RTX 4060 · 165Hz' },
  { id: 'PC-02', tipo: 'PC gaming', estado: 'sesion', cliente: 'Dana R.', restanteMin: 8, specs: 'RTX 4060 · 165Hz' },
  { id: 'PC-03', tipo: 'PC gaming', estado: 'libre', specs: 'RTX 4060 · 165Hz' },
  { id: 'PC-04', tipo: 'PC gaming', estado: 'libre', specs: 'RTX 3060 · 144Hz' },
  { id: 'PC-05', tipo: 'PC gaming', estado: 'sesion', cliente: 'Grupo (4)', restanteMin: 95, specs: 'RTX 3060 · 144Hz' },
  { id: 'PC-06', tipo: 'PC gaming', estado: 'mantenimiento', specs: 'RTX 3060 · 144Hz' },
  { id: 'PC-07', tipo: 'PC gaming', estado: 'libre', specs: 'RTX 4060 · 165Hz' },
  { id: 'PC-08', tipo: 'PC gaming', estado: 'sesion', cliente: 'Marco L.', restanteMin: 21, specs: 'RTX 3060 · 144Hz' },
  { id: 'PS-01', tipo: 'Consola PS5', estado: 'libre', specs: 'Sala consolas' },
  { id: 'PS-02', tipo: 'Consola PS5', estado: 'sesion', cliente: 'Ale V.', restanteMin: 15, specs: 'Sala consolas' },
]

export const RESERVACIONES = [
  { folio: 'CL-3081', cliente: 'Emilio S.', estacion: 'PC-03', fecha: '2026-09-15', hora: '17:00', duracionH: 2, estado: 'confirmada' },
  { folio: 'CL-3082', cliente: 'Familia Torres', estacion: 'PS-01', fecha: '2026-09-15', hora: '18:30', duracionH: 1, estado: 'confirmada' },
  { folio: 'CL-3083', cliente: 'Torneo Valorant — 4 equipos', estacion: 'PC-01 a PC-08', fecha: '2026-09-20', hora: '10:00', duracionH: 6, estado: 'pendiente' },
]

export const RESUMEN_HOY = {
  ocupacion: 0.7,
  sesionesActivas: 5,
  proximasReservas: 2,
  ticketPromedio: 68,
}
