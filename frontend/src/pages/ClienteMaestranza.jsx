import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTrabajos, crearTrabajo, elegirEntrega, agregarComentario } from '../api/maestranza'
import { getResponsables } from '../api/usuarios'
import { CATEGORIAS } from '../constants/categorias'
import FormularioTrabajo from '../components/FormularioTrabajo'
import BadgeEstado from '../components/BadgeEstado'

function SelectorEntrega({ trabajo, onElegido }) {
  const [modalidad, setModalidad] = useState('RETIRO')
  const [direccion, setDireccion] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    if (modalidad === 'DELIVERY' && !direccion.trim()) {
      alert('Ingresa la dirección de entrega')
      return
    }
    setEnviando(true)
    try {
      await elegirEntrega(trabajo.id, {
        modalidad_entrega: modalidad,
        direccion_entrega: modalidad === 'DELIVERY' ? direccion : '',
      })
      onElegido()
    } catch (err) {
      alert('Error al confirmar la entrega')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mt-3 bg-primary/5 border border-primary/20 rounded p-3">
      <p className="text-sm font-medium text-dark mb-2">
        🎉 Tu trabajo está listo. ¿Cómo quieres recibirlo?
      </p>
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => setModalidad('RETIRO')}
          className={`flex-1 px-3 py-2 rounded text-sm font-medium ${
            modalidad === 'RETIRO' ? 'bg-primary text-white' : 'bg-white text-dark border'
          }`}
        >
          Retiro en local
        </button>
        <button
          type="button"
          onClick={() => setModalidad('DELIVERY')}
          className={`flex-1 px-3 py-2 rounded text-sm font-medium ${
            modalidad === 'DELIVERY' ? 'bg-primary text-white' : 'bg-white text-dark border'
          }`}
        >
          Delivery
        </button>
      </div>
      {modalidad === 'DELIVERY' && (
        <input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="Dirección de entrega"
          className="w-full border rounded p-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )}
      <button
        onClick={confirmar}
        disabled={enviando}
        className="w-full bg-primary text-white py-2 rounded text-sm font-medium hover:bg-primary-light disabled:opacity-50"
      >
        {enviando ? 'Confirmando...' : 'Confirmar'}
      </button>
    </div>
  )
}

export default function ClienteMaestranza() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [trabajos, setTrabajos] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [comentarioTexto, setComentarioTexto] = useState({})
  const [enviandoComentario, setEnviandoComentario] = useState(null)
  const [responsables, setResponsables] = useState([])
  const [responsableActivo, setResponsableActivo] = useState('')

  useEffect(() => {
    cargarTrabajos()
    getResponsables().then((res) => setResponsables(res.data))
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

  function handleComentarioChange(trabajoId, valor) {
    setComentarioTexto((prev) => ({ ...prev, [trabajoId]: valor }))
  }

  async function handleEnviarComentario(trabajoId) {
    const mensaje = (comentarioTexto[trabajoId] || '').trim()
    if (!mensaje) return
    if (!responsableActivo) {
      alert('Elige quién de la empresa está comentando')
      return
    }
    setEnviandoComentario(trabajoId)
    try {
      await agregarComentario(trabajoId, mensaje, responsableActivo)
      setComentarioTexto((prev) => ({ ...prev, [trabajoId]: '' }))
      cargarTrabajos()
    } catch (err) {
      alert('Error al enviar el comentario')
    } finally {
      setEnviandoComentario(null)
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
            <div>
              <h2 className="text-dark font-medium mb-3">Elige una categoría</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {CATEGORIAS.map((cat) => (
                  <button
                    key={cat.valor}
                    onClick={() => setCategoriaActiva(cat)}
                    className="bg-white rounded-lg shadow p-4 flex flex-col items-center gap-2 hover:shadow-md hover:-translate-y-0.5 transition"
                  >
                    {cat.imagen ? (
                      <img src={cat.imagen} alt={cat.etiqueta} className="w-30 h-30 object-contain" />
                    ) : (
                      <span className="text-3xl">{cat.icono}</span>
                    )}
                    <span className="text-xs font-medium text-dark text-center">{cat.etiqueta}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-dark font-medium mb-3">Tus trabajos</h2>

              {responsables.length > 0 && (
                <div className="bg-white rounded-lg shadow p-3 mb-3 flex items-center gap-2">
                  <label className="text-xs font-medium text-dark whitespace-nowrap">Comentando como:</label>
                  <select
                    value={responsableActivo}
                    onChange={(e) => setResponsableActivo(e.target.value)}
                    className="border rounded p-1.5 text-sm flex-1"
                  >
                    <option value="">Elige quién eres</option>
                    {responsables.map((r) => (
                      <option key={r.id} value={r.id}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

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
                            {t.categoria_display} #{t.correlativo}
                          </span>
                          <p className="text-sm text-gray-600 mt-1">{t.descripcion}</p>
                        </div>
                        <BadgeEstado estado={t.estado} />
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
                        <span>Centro de costo: {t.centro_costo}</span>
                        {t.tiempo_entrega && <span>Entrega estimada: {t.tiempo_entrega}</span>}
                        <span>Avance: {t.avance}%</span>
                      </div>

                      {t.foto && (
                        <img
                          src={t.foto}
                          alt="evidencia"
                          className="mt-2 w-20 h-20 object-cover rounded border"
                        />
                      )}

                      {t.materiales?.length > 0 && (
                        <div className="mt-3 border rounded p-2 bg-gray-50">
                          <p className="text-xs font-bold text-dark mb-1">Materiales usados:</p>
                          <ul className="text-xs text-gray-600 list-disc pl-4">
                            {t.materiales.map((mat) => (
                              <li key={mat.id}>{mat.nombre} — {mat.cantidad}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Comentarios: solo una vez que el admin aprobó el trabajo */}
                      {t.aprobado && (
                        <div className="mt-3 border-t pt-3">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-xs font-bold text-dark">
                              Comentarios — pídele al admin lo que te haya faltado agregar
                            </p>
                            <button onClick={cargarTrabajos} className="text-xs text-primary hover:underline whitespace-nowrap">
                              🔄 Actualizar
                            </button>
                          </div>

                          {t.comentarios?.length > 0 ? (
                            <div className="flex flex-col gap-2 mb-2 max-h-48 overflow-y-auto">
                              {t.comentarios.map((c) => (
                                <div key={c.id} className="bg-gray-50 rounded p-2 text-sm">
                                  <p className="text-xs font-medium text-dark">
                                    {c.autor_rol === 'ADMIN' ? c.autor_nombre : (c.responsable_nombre || 'Tú')}
                                    {c.autor_rol === 'ADMIN' && (
                                      <span className="text-gray-400 font-normal"> (Admin)</span>
                                    )}
                                  </p>
                                  <p className="text-gray-700">{c.mensaje}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 mb-2">Todavía no hay comentarios.</p>
                          )}

                          {responsables.length === 0 && (
                            <p className="text-xs text-danger mb-2">
                              Tu empresa todavía no tiene responsables cargados. Pide al administrador que agregue uno para poder comentar.
                            </p>
                          )}

                          <div className="flex gap-2">
                            <input
                              value={comentarioTexto[t.id] || ''}
                              onChange={(e) => handleComentarioChange(t.id, e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleEnviarComentario(t.id)}
                              placeholder={responsableActivo ? "Escribe lo que te faltó agregar..." : "Elige quién eres arriba para poder escribir"}
                              disabled={!responsableActivo}
                              className="flex-1 border rounded p-2 text-sm disabled:bg-gray-100"
                            />
                            <button
                              onClick={() => handleEnviarComentario(t.id)}
                              disabled={enviandoComentario === t.id || !responsableActivo}
                              className="bg-primary text-white px-3 py-2 rounded text-sm font-medium hover:bg-primary-light disabled:opacity-50"
                            >
                              Enviar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Trabajo terminado, todavía sin elegir modalidad */}
                      {t.estado === 'TERMINADO' && !t.modalidad_entrega && (
                        <SelectorEntrega trabajo={t} onElegido={cargarTrabajos} />
                      )}

                      {/* Trabajo terminado, ya con modalidad confirmada */}
                      {t.estado === 'TERMINADO' && t.modalidad_entrega && (
                        <div className="mt-3 bg-green-50 text-green-700 text-sm font-medium rounded p-2 text-center">
                          {t.modalidad_entrega === 'RETIRO'
                            ? '✅ Confirmado: Retiro en local'
                            : `✅ Confirmado: Delivery a ${t.direccion_entrega}`}
                        </div>
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