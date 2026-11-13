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

## Correo de confirmación

Al confirmarse el pago, el cliente recibe un correo con su folio, equipo, fecha, horario, total y cómo llegar.
Se envía una sola vez por reservación (cuando pasa de "esperando pago" a "pagada"), desde el webhook de Stripe o,
si éste tarda, desde la pantalla de confirmación. Si el correo falla, el pago y la reservación no se afectan.

Variables en Vercel:
- `RESEND_API_KEY` (de resend.com → API Keys). Sin ella no se envía nada.
- `EMAIL_FROM`, por ejemplo `Cleofas Game Center <reservas@tudominio.mx>`. Requiere un **dominio verificado** en Resend
  (Domains → Add Domain y agregar los registros DNS que indica). Sin dominio, Resend solo permite enviar pruebas a tu propio correo.
- `EMAIL_COPIA` (opcional): correo del negocio que recibe copia de cada reservación pagada.

El diseño del correo está en `api/_lib/plantillaCorreo.js`; la dirección, el teléfono y las redes salen de `src/data/negocio.js`.

## Club Cleofas (socios y fidelización) — Fase 1

Clientes crean su cuenta en `/cuenta/registro`, la activan por correo y ven en `/cuenta` su rango, puntos,
progreso, QR de socio, beneficios e historial. Ganan **1 punto por cada $1** (reservas en línea pagadas,
sesiones en mostrador y compras en la Tienda). El rango sube solo y su descuento se aplica en mostrador
(al elegir al socio o escanear su QR) y en reservas en línea con sesión iniciada (el servidor lo recalcula).

Panel: **Tienda** (vender snacks y administrar productos), **Socios** (registro, detalle, ajuste de puntos,
rango manual, exportar CSV) y **Rangos** (niveles, puntos mínimos, descuentos y beneficios).

Puesta en marcha:
1. `npm install qrcode`
2. Supabase → SQL Editor: ejecuta `supabase/migration-socios.sql` (se puede repetir).
3. Supabase → Authentication → Sign In / Providers: activa *Allow new users to sign up* y *Confirm email*.
   El panel sigue protegido: solo entra quien está en la tabla `equipo`.
4. Supabase → Authentication → Emails → SMTP Settings: usa Resend (`smtp.resend.com`, puerto 465,
   usuario `resend`, contraseña = tu API key de Resend, remitente de tu dominio verificado).
5. Supabase → Authentication → Emails → Templates: pega `supabase/correos/confirmar-cuenta.html`
   (Confirm signup) y `supabase/correos/recuperar-contrasena.html` (Reset password).
6. Supabase → Authentication → URL Configuration: *Site URL* = tu dominio y en *Redirect URLs*
   agrega `https://TU-DOMINIO/cuenta` y `https://TU-DOMINIO/cuenta/nueva-contrasena` (y `http://localhost:5173/**` para pruebas).

Puntos: la base de datos los suma sola (triggers), así que no se pueden duplicar ni manipular desde el navegador.

## Club Cleofas — Fase 2: cupones y novedades

**Cupones** (panel → Cupones): se emiten a un socio, a un rango y superiores, o a todo el club, con plantillas
rápidas (1 hora gratis, snack gratis, 20% en snacks…). Tipo *monto* (hasta $X) o *porcentaje*, para horas, snacks
o todo, con vigencia. El socio los ve en su cuenta y se canjean en **Estaciones** y **Tienda** al elegirlo:
la base de datos garantiza que cada cupón se use una sola vez y nunca vencido. Se pueden anular.

**Publicaciones** (panel → Publicaciones): promociones, eventos/torneos, noticias y comunicados con imagen,
fecha del evento, botón (ej. inscripción por WhatsApp), exclusivas por rango, destacadas, programadas
(mostrar desde / ocultar después de) y borradores. Vista previa en vivo.

Puesta en marcha: en Supabase → SQL Editor ejecuta `supabase/migration-fase2.sql` (después de `migration-socios.sql`).
Crea el bucket público `publicaciones` para subir imágenes; si tu proyecto no lo permite, pega enlaces de imagen.

## Club Cleofas — Fase 3: automatización

- **Cupones automáticos** (panel → Automatización): bienvenida al crear cuenta, premio al subir a cada rango
  (una vez en la vida), cumpleaños (una vez al año; el socio captura su fecha una sola vez) y reactivación para
  socios que no vienen en N días. Cada regla se enciende/apaga y define su cupón.
- **Campañas de puntos**: x1.5, x2 o x3 por fechas, días de la semana y tipo de consumo. El socio ve el aviso en su cuenta.
- **Correos**: avisos de cupones nuevos (uno por socio) y envío de publicaciones a los socios que pueden verlas.
  El socio elige si recibe correos (registro y Mis datos).
- **Cupones en reservas en línea**: el socio elige un cupón al reservar; si cubre el total (o deja menos de $10,
  el mínimo de Stripe) la reserva se confirma sin pagar. El cupón se canjea al confirmarse el pago.
- **Tarea diaria**: `vercel.json` programa `/api/cron` a las 9:00 (Puebla). También hay botón "Ejecutar ahora".

Puesta en marcha:
1. Supabase → SQL Editor: ejecuta `supabase/migration-fase3.sql` (después de las fases 1 y 2).
2. Vercel → Settings → Environment Variables: agrega `CRON_SECRET` (cualquier texto largo y secreto) y
   `SITE_URL=https://tu-dominio` (para los enlaces de los correos). Ya debes tener `RESEND_API_KEY` y `EMAIL_FROM`.
3. Despliega. En Vercel → Settings → Cron Jobs verás la tarea diaria.

Límites de Resend en plan gratis: 100 correos al día y 3,000 al mes. Si tu club crece, sube de plan.

## Productos de tienda en la reserva

Al reservar, el cliente puede agregar snacks y bebidas ("Deja listo tu snack") y elegir **pagar en línea** (se cobran
con la reserva en Stripe) o **en efectivo en su visita**. Antes de confirmar ve el desglose: lo que paga ahora y lo
que paga al llegar. Los socios tienen su descuento de snacks. Los productos quedan ligados a la reserva, salen en el
correo de confirmación, en la consulta de folio y en "Mis próximas reservas" del socio.

Panel: en **Reservaciones** (columna "Pedido de tienda", filtro y total por cobrar), en **Estaciones** al llegar el
cliente y en el **Resumen**. Botón **Cobrar $X** (efectivo: entra a la caja del día y suma puntos) y **Marcar entregado**.
Puntos: los productos pagados en línea suman al confirmarse el pago; los de efectivo, al cobrarlos.

Puesta en marcha: ejecuta `supabase/migration-pedidos.sql` (después de las fases 1, 2 y 3).

## POS, inventario, tienda del socio y ventas unificadas

Una sola tabla de **ventas** para el mostrador (POS), la tienda en línea del socio y los productos agregados a una reserva.

**Cliente**
- `/reservar`: página independiente para reservar (desde "Mi cuenta" o el menú), con la tienda integrada.
- `/cuenta/tienda`: catálogo con fotos, descripción, precio de socio y existencias en tiempo real; carrito;
  pagar en línea (Stripe) o al recoger (efectivo, tarjeta o transferencia).
- `/cuenta/pedidos`: pedidos con **QR** para identificarse en mostrador, estado en vivo, pagar en línea o cancelar.
- Los productos pendientes de pago **no dan puntos**; se acreditan al confirmarse el pago (en línea o en mostrador).

**Panel**
- **POS · Tienda**: lector de códigos de barras, búsqueda, socio por QR (S-…), cupones, efectivo con cambio,
  terminal y transferencia/QR con referencia, ticket térmico automático. Pestaña "Pedidos de clientes":
  escanear el QR del pedido (V-…) o la reserva (CL-…) para cobrar y entregar.
- **Ventas**: historial con filtros, detalle, reimpresión, cancelación/devolución (regresa existencias y resta puntos)
  y **Reportes** (ventas por día, por método y origen, ticket promedio, utilidad y productos más vendidos).
- **Inventario**: catálogo (nombre, descripción, categoría, precio, costo privado, código de barras, foto),
  existencias y apartados, entradas/ajustes/mermas con historial, alertas de stock bajo y agotados,
  opción de permitir o no vender sin existencias.
- **Hardware**: configuración del ticket (58/80 mm) y pruebas de impresora, lector y cámara.
- **Caja del día**: sesiones + ventas, separando efectivo, terminal, QR y en línea. "Cerrar y cobrar" pide el método.

**Hardware compatible**
- Lectores de códigos de barras y QR USB/Bluetooth en modo teclado (HID), configurados para enviar Enter al final.
- Cámara de celular, tableta o webcam (QR en cualquier navegador; códigos de barras en Android/Mac/ChromeOS).
- Impresoras térmicas de 58 u 80 mm instaladas en el equipo (Epson, Xprinter, 3nStar…). Para imprimir sin
  ventana, abre Chrome/Edge con `--kiosk-printing`.

**Puesta en marcha**
1. Supabase → SQL Editor: ejecuta `supabase/migration-pos.sql`. **Siempre al final**: si vuelves a correr un SQL
   anterior (socios, fase2, fase3, pedidos), corre después `migration-pos.sql` otra vez.
2. Supabase → Database → Replication: confirma que `productos` y `ventas` estén en `supabase_realtime`
   (el SQL las agrega; si no, actívalas ahí). Sin esto todo funciona, pero se actualiza cada 30–45 s en lugar de al instante.
3. `npm install` (agrega `jsqr` y `qrcode`), sube a GitHub y Vercel despliega.
4. Panel → Inventario: captura productos (o escanéalos para darlos de alta) y su existencia inicial.
5. Panel → Hardware: configura el ticket y prueba impresora, lector y cámara en el equipo del mostrador.

## PCs · Control de tiempo (Cleofas Agente)

- Migración: `supabase/migration-pcs.sql` (correr después de `migration-pos.sql`).
- Panel → **PCs · Tiempo**: vincular cada PC (genera un código de un solo uso), ver si está en línea, enviar mensajes, desvincular.
- Panel → **Estaciones → + Agregar tiempo**: +15 min de cortesía o tarifas cobradas; la PC se actualiza en segundos.
- El programa de Windows está en el proyecto aparte `cleofas-agente` (ver su README).
