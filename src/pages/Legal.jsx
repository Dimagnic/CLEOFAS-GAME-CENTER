import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { NEGOCIO, LEGAL, MAPA_LINK, whatsappUrl } from '../data/negocio'
import './Legal.css'

// Muestra un dato pendiente de completar de forma visible, para que no se publique vacío por descuido.
function Dato({ valor, etiqueta }) {
  return valor ? <>{valor}</> : <mark className="legal__pendiente">[{etiqueta}: pendiente]</mark>
}

function Marco({ titulo, children }) {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return (
    <div className="legal">
      <header className="legal__top">
        <div className="legal__wrap">
          <Link to="/" className="legal__brand">
            <img src="/logo.jpg" alt="" width="34" height="34" />
            <span>CLEOFAS <em>GAME CENTER</em></span>
          </Link>
          <Link to="/" className="legal__volver">← Volver al sitio</Link>
        </div>
      </header>

      <main className="legal__wrap legal__main">
        <h1>{titulo}</h1>
        <p className="legal__fecha">Última actualización: {LEGAL.actualizado}</p>
        {!LEGAL.revisadoPorAbogado && (
          <p className="legal__borrador" role="note">
            Borrador pendiente de revisión legal. Revísalo con un abogado y completa los datos marcados antes de darlo por definitivo.
          </p>
        )}
        {children}
      </main>

      <footer className="legal__pie">
        <div className="legal__wrap">
          <Link to="/privacidad">Aviso de privacidad</Link>
          <Link to="/politica-de-cancelacion">Cancelaciones y reembolsos</Link>
          <span>© {new Date().getFullYear()} {NEGOCIO.nombre}</span>
        </div>
      </footer>
    </div>
  )
}

export function Privacidad() {
  return (
    <Marco titulo="Aviso de privacidad">
      <h2>1. ¿Quién es responsable de tus datos?</h2>
      <p>
        <strong><Dato valor={LEGAL.responsable} etiqueta="nombre o razón social del responsable" /></strong>, con nombre comercial{' '}
        {NEGOCIO.nombre} y domicilio en {NEGOCIO.direccion}, es responsable del tratamiento de tus datos personales.
        Puedes contactarnos al teléfono y WhatsApp <a href={`tel:${NEGOCIO.telefonoLink}`}>{NEGOCIO.telefono}</a> o al correo{' '}
        <Dato valor={LEGAL.correoPrivacidad} etiqueta="correo para asuntos de privacidad" />.
      </p>

      <h2>2. ¿Qué datos personales recabamos?</h2>
      <ul>
        <li><strong>Identificación y contacto:</strong> tu nombre, tu correo electrónico y, si lo proporcionas, tu teléfono.</li>
        <li><strong>Datos de tu reservación:</strong> estación, fecha, horario, duración, monto pagado y folio.</li>
        <li>
          <strong>Datos de pago:</strong> los datos de tu tarjeta los captura directamente la plataforma de pagos Stripe.
          Nosotros no vemos ni guardamos el número completo de tu tarjeta.
        </li>
        <li>
          <strong>Datos técnicos:</strong> como en cualquier sitio, nuestros proveedores de hospedaje pueden registrar tu dirección IP y la
          fecha y hora de acceso con fines de seguridad y funcionamiento.
        </li>
      </ul>
      <p>No recabamos datos personales sensibles.</p>

      <h2>3. ¿Para qué usamos tus datos?</h2>
      <p>Usamos tus datos para estas finalidades, necesarias para darte el servicio:</p>
      <ul>
        <li>Crear, confirmar y administrar tu reservación.</li>
        <li>Procesar tu pago.</li>
        <li>Enviarte tu folio, tu confirmación y avisos relacionados con tu reservación.</li>
        <li>Atender dudas, cambios, cancelaciones, reembolsos y aclaraciones.</li>
        <li>Cumplir obligaciones legales y fiscales, y prevenir fraudes y abusos.</li>
      </ul>
      <p>
        Por ahora no usamos tus datos para publicidad ni para fines comerciales. Si en el futuro enviamos promociones, te pediremos tu
        consentimiento por separado y podrás negarte sin que eso afecte tu reservación.
      </p>

      <h2>4. ¿Con quién compartimos tus datos?</h2>
      <p>
        No vendemos tus datos. Para operar el sitio nos apoyamos en proveedores que los tratan por nuestra cuenta y solo reciben lo
        necesario: <strong>Stripe</strong> (cobro de pagos), <strong>Supabase</strong> (base de datos), <strong>Vercel</strong> (hospedaje del sitio),
        un proveedor de envío de correo electrónico (para tu confirmación) y <strong>Google</strong> (mapa de ubicación). Algunos pueden almacenar
        o procesar información fuera de México. También podemos entregar datos a una autoridad cuando la ley lo exija.
      </p>

      <h2>5. Tus derechos y cómo ejercerlos</h2>
      <p>
        Tienes derecho a acceder a tus datos, rectificarlos, cancelarlos u oponerte a su tratamiento (derechos ARCO), así como a revocar tu
        consentimiento y a limitar el uso o la divulgación de tus datos. Para ejercerlos, escribe a{' '}
        <Dato valor={LEGAL.correoPrivacidad} etiqueta="correo para asuntos de privacidad" /> indicando tu nombre, un medio para responderte, una
        descripción clara de lo que solicitas y datos que permitan acreditar tu identidad (por ejemplo, tu folio de reservación). Te
        responderemos dentro de los plazos que marca la ley. Hay datos que debemos conservar por obligación legal, aunque pidas su cancelación.
      </p>

      <h2>6. ¿Cuánto tiempo conservamos tus datos?</h2>
      <p>
        El tiempo necesario para cumplir las finalidades de este aviso y las obligaciones legales aplicables. Después los eliminamos o
        bloqueamos.
      </p>

      <h2>7. Cookies y tecnologías similares</h2>
      <p>
        Este sitio no usa cookies de publicidad ni de seguimiento propias. Servicios incorporados, como el mapa de Google y la página de pago de
        Stripe, pueden usar las suyas conforme a sus propias políticas.
      </p>

      <h2>8. Menores de edad</h2>
      <p>Las personas menores de edad deben reservar con la autorización y supervisión de su madre, padre o tutor.</p>

      <h2>9. Cambios a este aviso</h2>
      <p>Publicaremos cualquier modificación en esta misma página, con su fecha de actualización.</p>

      <h2>10. Autoridad</h2>
      <p>
        Si consideras que tu derecho a la protección de datos personales fue vulnerado, puedes acudir a la Secretaría Anticorrupción y Buen
        Gobierno, que es la autoridad en esta materia.
      </p>
    </Marco>
  )
}

export function Cancelacion() {
  const h = LEGAL.horasSinCostoCancelacion
  return (
    <Marco titulo="Política de cancelación y reembolso">
      <h2>1. Tu reservación</h2>
      <p>
        Cuando reservas, pagas por adelantado el tiempo de una estación en una fecha y horario específicos, y recibes un folio. El horario
        corre desde la hora reservada, por lo que si llegas tarde el tiempo no se extiende.
      </p>

      <h2>2. Pago pendiente</h2>
      <p>
        Tu horario se aparta durante 30 minutos mientras pagas. Si no completas el pago en ese tiempo, el horario se libera y no se te cobra.
      </p>

      <h2>3. Si quieres cancelar o cambiar tu reservación</h2>
      <ul>
        <li>
          <strong>Con {h} horas o más de anticipación:</strong> puedes cancelar sin costo y te devolvemos el 100&nbsp;% de lo que pagaste, o
          cambiarla a otro horario disponible.
        </li>
        <li>
          <strong>Con menos de {h} horas, o si no te presentas:</strong> la reservación no es reembolsable. Aun así, escríbenos y haremos lo posible
          por reprogramarla según la disponibilidad.
        </li>
      </ul>

      <h2>4. Si cancelamos nosotros</h2>
      <p>
        Si no podemos darte el servicio (por una falla del equipo, cierre u otra causa de nuestra parte), puedes elegir entre cambiar tu
        reservación a otro horario o recibir el reembolso total.
      </p>

      <h2>5. Cómo solicitarlo</h2>
      <p>
        Escríbenos por <a href={whatsappUrl('Hola, quiero cancelar o cambiar mi reservación. Mi folio es: ')} target="_blank" rel="noopener noreferrer">WhatsApp</a>{' '}
        o llámanos al <a href={`tel:${NEGOCIO.telefonoLink}`}>{NEGOCIO.telefono}</a>, con tu folio. Te daremos una confirmación o folio de tu
        cancelación; guárdala como comprobante.
      </p>

      <h2>6. Cómo se hace el reembolso</h2>
      <p>
        Se devuelve al mismo medio de pago con el que reservaste. Una vez aprobado, iniciamos el reembolso de inmediato; tu banco puede tardar
        varios días hábiles en reflejarlo.
      </p>

      <h2>7. Cobros duplicados o errores</h2>
      <p>Si ves un cargo repetido o incorrecto, escríbenos con tu folio y lo revisamos de inmediato.</p>

      <h2>8. Tus derechos como consumidor</h2>
      <p>
        Esta política no limita los derechos que te otorga la Ley Federal de Protección al Consumidor. También puedes acudir a la Procuraduría
        Federal del Consumidor (Profeco).
      </p>

      <h2>9. Dónde atendemos quejas y aclaraciones</h2>
      <p>
        {NEGOCIO.nombre}, {NEGOCIO.direccion} (<a href={MAPA_LINK} target="_blank" rel="noopener noreferrer">ver mapa</a>). Teléfono y WhatsApp:{' '}
        <a href={`tel:${NEGOCIO.telefonoLink}`}>{NEGOCIO.telefono}</a>. Horario: {NEGOCIO.horarioLineas.join(' · ')}.
      </p>
    </Marco>
  )
}
