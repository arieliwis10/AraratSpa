import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getResumenCliente } from '../api/usuarios'
import fondoPanel from '../assets/fondo-panel.jpg'

function Badge({ cantidad }) {
  if (!cantidad) return null
  return (
    <span className="absolute -top-2 -right-2 bg-danger text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-md">
      {cantidad > 9 ? '9+' : cantidad}
    </span>
  )
}

export default function ClienteHome() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [resumen, setResumen] = useState({ maestranza: 0, arriendos: 0 })

  useEffect(() => {
    getResumenCliente()
      .then((res) => setResumen(res.data))
      .catch(() => {})
  }, [])

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
            <div className="relative max-w-xs mx-auto">
              <button
                onClick={() => navigate('/cliente/maestranza')}
                className="w-full bg-white rounded-lg shadow overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition border-4 border-[#00AEEF]"
              >
                <img src="/logos/ararat.png" alt="Maestranza" className="w-full h-auto block" />
              </button>
              <Badge cantidad={resumen.maestranza} />
            </div>

            <div className="relative max-w-xs mx-auto">
              <button
                onClick={() => navigate('/cliente/arriendo')}
                className="w-full bg-white rounded-lg shadow overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition border-4 border-[#8DC63F]"
              >
                <img src="/logos/kairos.png" alt="Arriendo Maquinaria" className="w-full h-auto block" />
              </button>
              <Badge cantidad={resumen.arriendos} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}