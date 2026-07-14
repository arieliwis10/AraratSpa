import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTrabajos, crearTrabajo } from '../api/maestranza'
import { CATEGORIAS } from '../constants/categorias'
import FormularioTrabajo from '../components/FormularioTrabajo'
import BadgeEstado from '../components/BadgeEstado'

export default function ClienteMaestranza() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [trabajos, setTrabajos] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarTrabajos()
  }, [])

  async function cargarTrabajos() {
    setCargando(true)
    try {
      const res = await getTrabajos()
      setTrabajos(res.data)
    } finally {
      setCargando(false)
    }
  }

  async function handleGuardar(formData) {
    try {
      await crearTrabajo(formData)
      setCategoriaActiva(null)
      cargarTrabajos()
    } catch (err) {
      alert('Error al crear el trabajo')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 w-full">
      <header className="w-full bg-dark text-white px-4 md:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/cliente')} className="text-gray-300 hover:text-white">
            ←
          </button>
          <h1 className="text-xl md:text-2xl font-bold">Maestranza</h1>
        </div>
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

      <main className="w-full max-w-4xl mx-auto p-4 md:p-8">
        {categoriaActiva ? (
          <FormularioTrabajo
            categoria={categoriaActiva.valor}
            categoriaLabel={categoriaActiva.etiqueta}
            onGuardar={handleGuardar}
            onCancelar={() => setCategoriaActiva(null)}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {/* Categorías */}
            <div>
              <h2 className="text-dark font-medium mb-3">Elige una categoría</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {CATEGORIAS.map((cat) => (
                  <button
                    key={cat.valor}
                    onClick={() => setCategoriaActiva(cat)}
                    className="bg-white rounded-lg shadow p-4 flex flex-col items-center gap-2 hover:shadow-md hover:-translate-y-0.5 transition"
                  >
                    <span className="text-3xl">{cat.icono}</span>
                    <span className="text-xs font-medium text-dark text-center">{cat.etiqueta}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Historial de trabajos */}
            <div>
              <h2 className="text-dark font-medium mb-3">Tus trabajos</h2>
              {cargando ? (
                <p className="text-dark">Cargando...</p>
              ) : trabajos.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                  Todavía no has creado ningún trabajo.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {trabajos.map((t) => (
                    <div key={t.id} className="bg-white rounded-lg shadow p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-xs font-bold text-primary uppercase">
                            {t.categoria_display}
                          </span>
                          <p className="text-sm text-gray-600 mt-1">{t.descripcion}</p>
                        </div>
                        <BadgeEstado estado={t.estado} />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
                        <span>Centro de costo: {t.centro_costo}</span>
                        {t.tiempo_entrega && <span>Entrega: {t.tiempo_entrega}</span>}
                        <span>Avance: {t.avance}%</span>
                        {t.modalidad_entrega && (
                          <span>
                            {t.modalidad_entrega === 'RETIRO' ? 'Retiro en local' : 'Delivery'}
                          </span>
                        )}
                      </div>
                      {t.foto && (
                        <img
                          src={t.foto}
                          alt="evidencia"
                          className="mt-2 w-20 h-20 object-cover rounded border"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}