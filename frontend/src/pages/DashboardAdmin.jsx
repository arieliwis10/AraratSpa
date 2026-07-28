import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import AdminUsuarios from '../components/admin/AdminUsuarios'
import AdminMaestranza from '../components/admin/AdminMaestranza'
import AdminMaquinas from '../components/admin/AdminMaquinas'
import AdminCompras from '../components/admin/AdminCompras'
import AdminEmpresas from '../components/admin/AdminEmpresas'
import AdminFerreteria from '../components/admin/AdminFerreteria'
import fondoPanel from '../assets/fondo-panel.jpg'
import AdminFlexibles from '../components/admin/AdminFlexibles'
import AdminCotizaciones from '../components/admin/AdminCotizaciones'
import AdminAgenda from '../components/admin/AdminAgenda'
import api from '../api/axios'

const TABS = [
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'maestranza', label: 'Maestranza' },
  { id: 'ferreteria', label: 'Ferretería' },
  { id: 'flexibles', label: 'Flexibles' },
  { id: 'maquinas', label: 'Máquinas' },
  { id: 'compras', label: 'Compras' },
  { id: 'cotizaciones', label: 'Cotizaciones' },
  { id: 'agenda', label: 'Agenda' },
]

export default function DashboardAdmin() {
  const { usuario, logout } = useAuth()
  const [tab, setTab] = useState('usuarios')
  const [pendientes, setPendientes] = useState({})

  async function cargarPendientes() {
    try {
      const res = await api.get('/resumen-pendientes/')
      setPendientes(res.data)
    } catch {}
  }

  useEffect(() => {
    cargarPendientes()
  }, [])

  return (
    <div className="relative min-h-screen w-full">
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${fondoPanel})` }}
      />

      <header className="relative z-10 w-full bg-dark text-white px-4 md:px-8 py-4 flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold">Panel Admin</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300 hidden sm:inline">Hola, {usuario.username}</span>
          <button
            onClick={logout}
            className="bg-danger text-white px-3 py-1.5 rounded text-sm hover:bg-danger-light"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <nav className="relative z-10 w-full bg-white border-b-2 border-black grid grid-cols-4">
        {TABS.map((t, i) => {
          const count = pendientes[t.id] || 0
          const isActive = tab === t.id
          const isFirstRow = i < 4 // ← los primeros 4 tabs son la fila de arriba

          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-3 text-sm font-medium
                border-b-1
                border-r-1 border-black [&:nth-child(4n)]:border-r-0
                whitespace-nowrap
                ${
                  isActive
                    ? 'border-b-primary text-primary' // ← tab activo: línea azul
                    : isFirstRow
                      ? 'border-b-black text-gray-500 hover:text-dark' // ← fila 1 inactiva: línea gris = divisor entre filas
                      : 'border-b-transparent text-gray-500 hover:text-dark' // ← fila 2 inactiva: invisible (ya está el borde del nav ahí)
                }`}
            >
              {t.label}
              {count > 0 && (
                <span className="absolute -top-0.5 -right-1 bg-danger text-white text-[10px] leading-none rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <main className="relative z-10 w-full min-h-[calc(100dvh-64px-49px)]">
        <div className="relative max-w-5xl mx-auto p-4 md:p-8">
          {tab === 'usuarios' && <AdminUsuarios />}
          {tab === 'maestranza' && <AdminMaestranza onActualizarPendientes={cargarPendientes} />}
          {tab === 'ferreteria' && <AdminFerreteria onActualizarPendientes={cargarPendientes} />}
          {tab === 'flexibles' && <AdminFlexibles />}
          {tab === 'maquinas' && <AdminMaquinas onActualizarPendientes={cargarPendientes} />}
          {tab === 'compras' && <AdminCompras />}
          {tab === 'cotizaciones' && <AdminCotizaciones />}
          {tab === 'agenda' && <AdminAgenda />}
        </div>
      </main>
    </div>
  )
}