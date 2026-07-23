import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import fondoPanel from '../assets/fondo-panel.jpg'

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

      <main
        className="relative w-full min-h-[calc(100dvh-64px)] bg-gray-100 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `url(${fondoPanel})` }}
      >
        <div className="relative z-10 max-w-3xl mx-auto p-4 md:p-8">
          <h2 className="inline-block bg-white rounded-lg shadow px-3 py-1.5 text-dark font-medium mb-6">
            ¿Qué necesitas hoy?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <button
              onClick={() => navigate('/cliente/maestranza')}
              className="max-w-xs mx-auto bg-white rounded-lg shadow overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition border-4 border-[#00AEEF]"
            >
              <img src="/logos/ararat.png" alt="Maestranza" className="w-full h-auto block" />
            </button>

            <button
              onClick={() => navigate('/cliente/arriendo')}
              className="max-w-xs mx-auto bg-white rounded-lg shadow overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition border-4 border-[#8DC63F]"
            >
              <img src="/logos/kairos.png" alt="Arriendo Maquinaria" className="w-full h-auto block" />
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}