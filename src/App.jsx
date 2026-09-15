import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/admin/Login'
import AdminLayout from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import StationsControl from './pages/admin/StationsControl'
import Reservations from './pages/admin/Reservations'
import Cashbox from './pages/admin/Cashbox'
import { AuthProvider } from './lib/AuthContext'
import { StationsProvider } from './lib/StationsStore'

export default function App() {
  return (
    <AuthProvider>
      <StationsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/panel/login" element={<Login />} />
            <Route path="/panel" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="estaciones" element={<StationsControl />} />
              <Route path="reservaciones" element={<Reservations />} />
              <Route path="caja" element={<Cashbox />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </StationsProvider>
    </AuthProvider>
  )
}
