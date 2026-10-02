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

## Pagos en línea (Stripe) y reservas sin traslapes

La reservación ahora se **paga en línea**: el cliente elige estación, día y hora
(solo ve horarios libres), paga con tarjeta en Stripe y recibe su folio. El pago
lo maneja Stripe; nosotros nunca vemos datos de tarjeta.

Cómo funciona: `Booking.jsx` → `/api/checkout` (función en Vercel) crea la reservación
como `pendiente_pago` (horario apartado 31 min) y manda al cliente a Stripe →
Stripe avisa a `/api/stripe-webhook` → la reservación pasa a `confirmada` (pagada).
Si no paga, el horario se libera solo. El precio siempre lo calcula el servidor.

### Puesta en marcha
1. En Supabase → SQL Editor, ejecuta `supabase/migration-pagos.sql` (después de `schema.sql`).
   Además quita la posibilidad de insertar reservas desde el navegador y evita
   dobles reservas a nivel de base de datos.
2. Crea tu cuenta en [stripe.com](https://stripe.com) (México, MXN). Copia la *Secret key* (`sk_test_...` para probar).
3. En Vercel → Settings → Environment Variables agrega: `SUPABASE_SERVICE_ROLE_KEY`
   (Supabase → Project Settings → API → service_role; **secreta, sin prefijo VITE_**),
   `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`, además de las dos `VITE_SUPABASE_*` que ya tienes.
4. En Stripe → Developers → Webhooks → *Add endpoint*:
   URL `https://TU-DOMINIO/api/stripe-webhook`, eventos `checkout.session.completed`,
   `checkout.session.expired`, `checkout.session.async_payment_succeeded` y
   `checkout.session.async_payment_failed`. Copia el *Signing secret* (`whsec_...`) a `STRIPE_WEBHOOK_SECRET`.
5. `npm install` y sube a GitHub; Vercel despliega solo. Prueba con la tarjeta `4242 4242 4242 4242`
   (cualquier fecha futura y CVC) antes de cambiar a las llaves reales (`sk_live_...`).

Las funciones `/api` no corren con `npm run dev`. Para probar en local usa `npx vercel dev`.

### Ajustes rápidos
- Horario, estaciones, máximo de horas y tarifas: `api/_lib/reglas.js` (y lo mismo en `src/lib/reservas.js`).
- Reembolsos: se hacen desde el panel de Stripe. Cancelar en `/panel/reservaciones` solo libera el horario.
- `vercel.json` hace que `/panel` funcione al recargar la página.

## Reservas sin minutos perdidos

La página ofrece, además de las horas en punto, el **minuto exacto** en que se libera cada estación
(por ejemplo 12:10 cuando hay una sesión en curso que termina a esa hora, redondeado a 5 minutos).
- La sesión que el encargado tiene en curso en el panel cuenta como ocupada para las reservas en línea.
- Al iniciar una sesión sobre una estación con reserva en línea, el panel avisa cuántos minutos hay libres
  y pide confirmación si la sesión se empalmaría.
- `MARGEN_MIN` (en `api/_lib/reglas.js` y `src/lib/reservas.js`) agrega un descanso entre clientes. Hoy es 0.
- No requiere cambios en la base de datos.
