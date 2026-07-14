import { useAuth } from '../context/AuthContext'

export default function DashboardTrabajador() {
  const { usuario, logout } = useAuth()
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mis Trabajos Asignados</h1>
        <button onClick={logout} className="text-red-600">Cerrar sesión</button>
      </div>
      <p>Hola, {usuario.username} 👋</p>
    </div>
  )
}