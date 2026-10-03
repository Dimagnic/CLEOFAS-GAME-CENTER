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
  { id: 'PC-01', tipo: 'PC gaming', estado: 'libre', specs: 'RTX 5070 Ti · Monitor 500 Hz' },
  { id: 'PC-02', tipo: 'PC gaming', estado: 'libre', specs: 'RTX 5070 · Monitor 280 Hz' },
  { id: 'PC-03', tipo: 'PC gaming', estado: 'libre', specs: 'RTX 5070 · Monitor 360 Hz' },
  { id: 'PC-04', tipo: 'PC gaming', estado: 'libre', specs: 'RTX 5060 · Monitor 240 Hz' },
  { id: 'PC-05', tipo: 'PC gaming', estado: 'libre', specs: 'RTX 3090 · Monitor 480 Hz' },
  { id: 'XB-01', tipo: 'Consola Xbox', estado: 'libre', specs: 'Xbox Series X' },
  { id: 'XB-02', tipo: 'Consola Xbox', estado: 'libre', specs: 'Xbox Series X' },
  { id: 'XB-03', tipo: 'Consola Xbox', estado: 'libre', specs: 'Xbox Series X' },
  { id: 'XB-04', tipo: 'Consola Xbox', estado: 'libre', specs: 'Xbox Series S' },
  { id: 'XB-05', tipo: 'Consola Xbox', estado: 'libre', specs: 'Xbox Series X' },
  { id: 'XB-06', tipo: 'Consola Xbox', estado: 'libre', specs: 'Xbox Series S' },
]

export const RESERVACIONES = [
  { folio: 'CL-3081', cliente: 'Emilio S.', estacion: 'PC-03', fecha: '2026-09-15', hora: '17:00', duracionH: 2, estado: 'confirmada' },
  { folio: 'CL-3082', cliente: 'Familia Torres', estacion: 'XB-01', fecha: '2026-09-15', hora: '18:30', duracionH: 1, estado: 'confirmada' },
  { folio: 'CL-3083', cliente: 'Torneo Valorant — 4 equipos', estacion: 'PC-01 a PC-05', fecha: '2026-09-20', hora: '10:00', duracionH: 6, estado: 'pendiente' },
]

export const RESUMEN_HOY = {
  ocupacion: 0.7,
  sesionesActivas: 5,
  proximasReservas: 2,
  ticketPromedio: 68,
}
