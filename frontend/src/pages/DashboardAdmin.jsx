import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import AdminUsuarios from '../components/admin/AdminUsuarios'
import AdminMaestranza from '../components/admin/AdminMaestranza'
import AdminMaquinas from '../components/admin/AdminMaquinas'
import AdminReservas from '../components/admin/AdminReservas'
import AdminCompras from '../components/admin/AdminCompras'
import AdminEmpresas from '../components/admin/AdminEmpresas'
import AdminFerreteria from '../components/admin/AdminFerreteria'
import fondoPanel from '../assets/fondo-panel.jpg'

const TABS = [
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'maestranza', label: 'Maestranza' },
  { id: 'ferreteria', label: 'Ferretería' },
  { id: 'maquinas', label: 'Máquinas' },
  { id: 'reservas', label: 'Reservas' },
  { id: 'compras', label: 'Compras' },
]

export default function DashboardAdmin() {
  const { usuario, logout } = useAuth()
  const [tab, setTab] = useState('usuarios')

  return (
    <div className="min-h-screen bg-gray-100 w-full">
      <header className="w-full bg-dark text-white px-4 md:px-8 py-4 flex justify-between items-center">
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

      <nav className="w-full bg-white border-b border-gray-200 px-4 md:px-8 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-dark'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main
        className="relative w-full min-h-[calc(100dvh-64px-49px)] bg-gray-100 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `url(${fondoPanel})` }}
      >
        {/* Fondo de imagen, sin overlay */}
        <div className="relative z-10 max-w-5xl mx-auto p-4 md:p-8">
          {tab === 'usuarios' && <AdminUsuarios />}
          {tab === 'maestranza' && <AdminMaestranza />}
          {tab === 'ferreteria' && <AdminFerreteria />}
          {tab === 'maquinas' && <AdminMaquinas />}
          {tab === 'reservas' && <AdminReservas />}
          {tab === 'compras' && <AdminCompras />}
        </div>
      </main>
    </div>
  )
}