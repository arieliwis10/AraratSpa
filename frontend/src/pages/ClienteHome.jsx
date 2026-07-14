import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ClienteHome() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-100 w-full">
      <header className="w-full bg-dark text-white px-4 md:px-8 py-4 flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold">Bienvenido</h1>
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

      <main className="w-full max-w-3xl mx-auto p-4 md:p-8">
        <h2 className="text-lg text-dark font-medium mb-6 text-center">
          ¿Qué necesitas hoy?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <button
            onClick={() => navigate('/cliente/maestranza')}
            className="bg-white rounded-lg shadow p-8 flex flex-col items-center gap-3 hover:shadow-lg hover:-translate-y-0.5 transition border-t-4 border-primary"
          >
            <span className="text-5xl">🔧</span>
            <span className="text-lg font-bold text-dark">Maestranza</span>
            <span className="text-sm text-gray-500 text-center">
              Solicita trabajos de soldadura, torno, repuestos y más
            </span>
          </button>

          <button
            onClick={() => navigate('/cliente/arriendo')}
            className="bg-white rounded-lg shadow p-8 flex flex-col items-center gap-3 hover:shadow-lg hover:-translate-y-0.5 transition border-t-4 border-danger"
          >
            <span className="text-5xl">🏗️</span>
            <span className="text-lg font-bold text-dark">Arriendo Maquinaria</span>
            <span className="text-sm text-gray-500 text-center">
              Reserva grúas, carros y maquinaria disponible
            </span>
          </button>
        </div>
      </main>
    </div>
  )
}