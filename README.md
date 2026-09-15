# Cleofas Game Center

Sitio público + panel de gestión para un centro de renta de estaciones gaming
(PC y consolas por hora). Hecho con **React + Vite**, CSS puro y **Supabase**
como backend opcional.

## Qué incluye

**Sitio público**
- Hero con disponibilidad de estaciones en vivo.
- Tablero completo de estaciones (libre / en sesión / mantenimiento).
- Tarifas por hora y paquetes.
- Reservación en línea + consulta de folio (para no llamar ni hacer fila).
- Ubicación y contacto por WhatsApp.

**Panel del negocio** (`/panel`, protegido con inicio de sesión)
- Control de estaciones: iniciar sesión, cronómetro automático, cerrar y
  cobrar, enviar a mantenimiento — reemplaza el cuaderno o pizarrón físico.
- Reservaciones hechas desde la página, en una sola tabla.
- Caja del día, que se llena sola conforme se cierran sesiones.

El sitio funciona **sin Supabase configurado** (modo demo, con datos de
ejemplo en `src/data/mockData.js`). Al conectar Supabase, las reservaciones
y los cierres de caja se guardan de verdad.

## Instalación local

```bash
npm install
cp .env.example .env   # opcional, solo si ya tienes Supabase
npm run dev
```

Abre `http://localhost:5173`. El panel está en `/panel` — en modo demo entra
con cualquier correo y la contraseña `cleofas2026`.

## Conectar Supabase (opcional pero recomendado)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, pega y ejecuta el contenido de `supabase/schema.sql`.
3. En **Authentication → Users**, crea un usuario para cada persona del
   equipo que use el panel (correo + contraseña).
4. En **Project Settings → API**, copia la URL y la `anon key`.
5. Pégalas en tu archivo `.env`:
   ```
   VITE_SUPABASE_URL=https://tuproyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key
   ```
6. Reinicia `npm run dev`. El login del panel y el formulario de
   reservación ahora usan Supabase de verdad.

## Subir a GitHub

```bash
git init
git add .
git commit -m "Sitio Cleofas Game Center"
git branch -M main
git remote add origin https://github.com/tu-usuario/cleofas-game-center.git
git push -u origin main
```

## Desplegar en Vercel

1. Entra a [vercel.com](https://vercel.com) → **Add New Project** → importa
   el repositorio de GitHub.
2. Vercel detecta Vite automáticamente (build: `npm run build`, salida: `dist`).
3. Si usas Supabase, agrega las variables de entorno en
   **Settings → Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Despliega. Cada `git push` a `main` vuelve a desplegar solo.

## Siguientes pasos sugeridos

- Reemplazar los datos de ejemplo de estaciones (`mockData.js`) por una
  tabla `estaciones` en Supabase con **Realtime** activado, para que el
  tablero público se actualice solo entre varios dispositivos.
- Agregar notificación por WhatsApp automática cuando una reservación se
  confirma.
- Reportes de ocupación por semana en el panel, usando los datos ya
  guardados en `cierres`.
