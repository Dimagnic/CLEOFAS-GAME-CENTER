import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import { Privacidad, Cancelacion } from './pages/Legal'
import Login from './pages/admin/Login'
import AdminLayout from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import StationsControl from './pages/admin/StationsControl'
import Reservations from './pages/admin/Reservations'
import Cashbox from './pages/admin/Cashbox'
import Socios from './pages/admin/Socios'
import Rangos from './pages/admin/Rangos'
import POS from './pages/admin/POS'
import Ventas from './pages/admin/Ventas'
import Cupones from './pages/admin/Cupones'
import Publicaciones from './pages/admin/Publicaciones'
import Automatizacion from './pages/admin/Automatizacion'
import Inventario from './pages/admin/Inventario'
import Hardware from './pages/admin/Hardware'
import PCs from './pages/admin/PCs'
import { Entrar, Registro, Recuperar, NuevaContrasena } from './pages/cuenta/Acceso'
import MiCuenta from './pages/cuenta/MiCuenta'
import Reservar from './pages/Reservar'
import TiendaSocio from './pages/cuenta/Tienda'
import { MisPedidos, DetallePedido } from './pages/cuenta/Pedidos'
import { AuthProvider } from './lib/AuthContext'
import { StationsProvider } from './lib/StationsStore'
import './styles/futuro.css'
import './styles/panel.css'

export default function App() {
  return (
    <AuthProvider>
      <StationsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/privacidad" element={<Privacidad />} />
            <Route path="/politica-de-cancelacion" element={<Cancelacion />} />
            <Route path="/reservar" element={<Reservar />} />
            <Route path="/cuenta" element={<MiCuenta />} />
            <Route path="/cuenta/tienda" element={<TiendaSocio />} />
            <Route path="/cuenta/pedidos" element={<MisPedidos />} />
            <Route path="/cuenta/pedidos/:folio" element={<DetallePedido />} />
            <Route path="/cuenta/entrar" element={<Entrar />} />
            <Route path="/cuenta/registro" element={<Registro />} />
            <Route path="/cuenta/recuperar" element={<Recuperar />} />
            <Route path="/cuenta/nueva-contrasena" element={<NuevaContrasena />} />
            <Route path="/panel/login" element={<Login />} />
            <Route path="/panel" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="estaciones" element={<StationsControl />} />
              <Route path="reservaciones" element={<Reservations />} />
              <Route path="caja" element={<Cashbox />} />
              <Route path="tienda" element={<POS />} />
              <Route path="pos" element={<POS />} />
              <Route path="ventas" element={<Ventas />} />
              <Route path="socios" element={<Socios />} />
              <Route path="rangos" element={<Rangos />} />
              <Route path="cupones" element={<Cupones />} />
              <Route path="publicaciones" element={<Publicaciones />} />
              <Route path="automatizacion" element={<Automatizacion />} />
              <Route path="inventario" element={<Inventario />} />
              <Route path="hardware" element={<Hardware />} />
              <Route path="pcs" element={<PCs />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </StationsProvider>
    </AuthProvider>
  )
}
