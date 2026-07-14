import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import DashboardAdmin from './pages/DashboardAdmin'
import ClienteHome from './pages/ClienteHome'
import ClienteMaestranza from './pages/ClienteMaestranza'
import DashboardTrabajador from './pages/DashboardTrabajador'
import ClienteArriendo from './pages/ClienteArriendo'

function RutaPrivada({ children, rolesPermitidos }) {
  const { usuario, loading } = useAuth()

  if (loading) return <div className="p-8 text-center">Cargando...</div>
  if (!usuario) return <Navigate to="/login" replace />
  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to="/login" replace />
  }
  return children
}

function RutaSegunRol() {
  const { usuario, loading } = useAuth()
  if (loading) return <div className="p-8 text-center">Cargando...</div>
  if (!usuario) return <Navigate to="/login" replace />

  if (usuario.rol === 'ADMIN') return <Navigate to="/admin" replace />
  if (usuario.rol === 'TRABAJADOR') return <Navigate to="/trabajador" replace />
  return <Navigate to="/cliente" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RutaSegunRol />} />
      <Route
        path="/admin"
        element={
          <RutaPrivada rolesPermitidos={['ADMIN']}>
            <DashboardAdmin />
          </RutaPrivada>
        }
      />
      <Route
        path="/cliente"
        element={
          <RutaPrivada rolesPermitidos={['CLIENTE']}>
            <ClienteHome />
          </RutaPrivada>
        }
      />
      <Route
        path="/cliente/maestranza"
        element={
          <RutaPrivada rolesPermitidos={['CLIENTE']}>
            <ClienteMaestranza />
          </RutaPrivada>
        }
      />
      <Route
        path="/trabajador"
        element={
          <RutaPrivada rolesPermitidos={['TRABAJADOR']}>
            <DashboardTrabajador />
          </RutaPrivada>
        }
      />
      <Route
        path="/cliente/arriendo"
        element={
          <RutaPrivada rolesPermitidos={['CLIENTE']}>
            <ClienteArriendo />
          </RutaPrivada>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}