import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getTrabajos, actualizarProgreso, marcarCompletado, agregarMaterial, reportarRetraso,
  marcarMaterialRecibido, getSolicitudesMaterial, hayEnBodega, solicitarMaterial
} from '../api/maestranza'
import BadgeEstado from '../components/BadgeEstado'
import fondoPanel from '../assets/fondo-panel.jpg'

export default function DashboardTrabajador() {
  const { usuario, logout } = useAuth()
  const [trabajos, setTrabajos] = useState([])
  const [editando, setEditando] = useState(null)
  const [nuevoMaterial, setNuevoMaterial] = useState({ nombre: '', cantidad: '' })
  const [mostrarRetraso, setMostrarRetraso] = useState(false)
  const [motivoRetraso, setMotivoRetraso] = useState('')
  const [cargando, setCargando] = useState(true)
  const [solicitudesPendientePorTrabajo, setSolicitudesPendientePorTrabajo] = useState({})
  const [solicitudesRevisionPorTrabajo, setSolicitudesRevisionPorTrabajo] = useState({})
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [expandido, setExpandido] = useState({})
  const [descripcionSolicitud, setDescripcionSolicitud] = useState('')
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false)
  const [solicitudEnviada, setSolicitudEnviada] = useState(false)

 useEffect(() => {
  cargarTrabajos()
  cargarSolicitudes()
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

  async function cargarSolicitudes() {
    const res = await getSolicitudesMaterial()

    const pendientes = {}
    res.data.filter(s => s.estado === 'PENDIENTE').forEach(s => {
      pendientes[s.trabajo] = s.id
    })
    setSolicitudesPendientePorTrabajo(pendientes)

    const enRevision = {}
    res.data.filter(s => s.estado === 'REVISION').forEach(s => {
      enRevision[s.trabajo] = s.id
    })
    setSolicitudesRevisionPorTrabajo(enRevision)
  }

  function toggleExpandido(id) {
    setExpandido((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function abrirEdicion(trabajo) {
    setEditando({
      id: trabajo.id,
      estado: trabajo.estado,
      avance: trabajo.avance,
    })
    setNuevoMaterial({ nombre: '', cantidad: '' })
    setMostrarRetraso(false)
    setMotivoRetraso('')
    setExpandido((prev) => ({ ...prev, [trabajo.id]: true }))
  }

  async function guardarCambios() {
    try {
      await actualizarProgreso(editando.id, {
        estado: editando.estado,
        avance: editando.avance,
      })
      setEditando(null)
      cargarTrabajos()
    } catch (err) {
      alert('Error al actualizar el trabajo')
    }
  }

  async function handleCompletar() {
    try {
      await marcarCompletado(editando.id)
      setEditando(null)
      cargarTrabajos()
    } catch (err) {
      alert('Error al marcar el trabajo como completado')
    }
  }

  async function handleAgregarMaterial(trabajoId) {
    if (!nuevoMaterial.nombre || !nuevoMaterial.cantidad) return
    try {
      await agregarMaterial(trabajoId, nuevoMaterial)
      setNuevoMaterial({ nombre: '', cantidad: '' })
      cargarTrabajos()
    } catch (err) {
      alert('Error al agregar el material')
    }
  }

  async function handleBodega(trabajoId) {
    const solicitudId = solicitudesRevisionPorTrabajo[trabajoId]
    if (!solicitudId) return
    if (!confirm('¿Confirmas que hay stock en bodega? Esto resuelve el retraso de inmediato.')) return
    try {
      await hayEnBodega(solicitudId)
      cargarTrabajos()
      cargarSolicitudes()
    } catch (err) {
      alert('Error al confirmar bodega')
    }
  }

  async function handleMaterialRecibido(trabajoId) {
    const solicitudId = solicitudesPendientePorTrabajo[trabajoId]
    if (!solicitudId) return
    if (!confirm('¿Confirmas que llegó el material? El trabajo podrá continuar.')) return
    try {
      await marcarMaterialRecibido(solicitudId)
      cargarTrabajos()
      cargarSolicitudes()
    } catch (err) {
      alert('Error al marcar como recibido')
    }
  }

  async function handleReportarRetraso(trabajoId) {
    try {
      await reportarRetraso(trabajoId, motivoRetraso)
      setMostrarRetraso(false)
      setMotivoRetraso('')
      cargarTrabajos()
      cargarSolicitudes()
      alert('Retraso reportado. El admin fue notificado.')
    } catch (err) {
      alert('Error al reportar el retraso')
    }
  }

  async function handleEnviarSolicitud() {
    if (!descripcionSolicitud.trim()) {
      alert('Escribe qué necesitas')
      return
    }
    setEnviandoSolicitud(true)
    try {
      await solicitarMaterial({ descripcion: descripcionSolicitud.trim() })
      setDescripcionSolicitud('')
      setSolicitudEnviada(true)
      cargarSolicitudes()
      setTimeout(() => setSolicitudEnviada(false), 4000)
    } catch (err) {
      alert('Error al enviar la solicitud')
    } finally {
      setEnviandoSolicitud(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 w-full">
      <header className="w-full bg-dark text-white px-4 md:px-8 py-4 flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold">Mis Trabajos Asignados</h1>
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
        {/* Fondo de imagen, sin overlay */}
        <div className="relative z-10 max-w-4xl mx-auto p-4 md:p-8">
        {cargando ? (
          <p className="text-dark">Cargando...</p>
        ) : (() => {
          const trabajosHistorial = trabajos.filter((t) => t.estado === 'TERMINADO')
          const trabajosActivos = trabajos.filter((t) => t.estado !== 'TERMINADO')

          return (
            <>
              {/* Solicitar herramienta o material — independiente del estado del trabajo */}
              <div className="bg-white rounded-lg shadow p-4 mb-4">
                <h2 className="font-bold text-dark mb-3">🧰 Solicitar herramienta o material</h2>
                <div className="flex flex-col gap-2">
                  <textarea
                    value={descripcionSolicitud}
                    onChange={(e) => setDescripcionSolicitud(e.target.value)}
                    placeholder="Ej: Necesito un taladro, no tengo brocas de 6mm..."
                    rows={2}
                    className="border rounded p-2 text-sm resize-none"
                  />
                  <button
                    onClick={handleEnviarSolicitud}
                    disabled={enviandoSolicitud}
                    className="bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:bg-primary-light disabled:opacity-50 w-fit"
                  >
                    {enviandoSolicitud ? 'Enviando...' : 'Enviar solicitud'}
                  </button>
                  {solicitudEnviada && (
                    <p className="text-xs text-green-700">✅ Solicitud enviada. El admin la va a revisar.</p>
                  )}
                </div>
              </div>

              {trabajosActivos.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                  No tienes trabajos asignados por el momento.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {trabajosActivos.map((t) => {
                    const estaEnEdicion = editando?.id === t.id
                    const avanceEnEdicion = estaEnEdicion ? Number(editando.avance) : Number(t.avance)
                    const listoParaCompletar = estaEnEdicion && avanceEnEdicion >= 100 && editando.estado !== 'TERMINADO'
                    const tieneRevisionPendiente = Boolean(solicitudesRevisionPorTrabajo[t.id])
                    const tieneCompraPendiente = Boolean(solicitudesPendientePorTrabajo[t.id])
                    const estaExpandido = Boolean(expandido[t.id])

                    return (
                      <div key={t.id} className="bg-white rounded-lg shadow p-4">
                        <button
                          type="button"
                          onClick={() => toggleExpandido(t.id)}
                          className="w-full flex justify-between items-start text-left gap-3"
                        >
                          <div className="flex gap-3 min-w-0">
                            <span className="text-xs font-bold text-primary bg-primary/10 rounded px-1.5 py-0.5 h-fit shrink-0">
                              #{t.correlativo}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-dark uppercase">{t.categoria_display}</p>
                              <p className="text-sm text-gray-600">{t.cliente_nombre}</p>
                              <p className="text-sm text-gray-700 mt-1 truncate">{t.descripcion}</p>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-1">
                                <span>Avance: {t.avance}%</span>
                                {t.tiempo_entrega && <span>Entrega estimada: {t.tiempo_entrega}</span>}
                              </div>
                              {t.retrasado && (
                                <p className="text-xs text-danger font-medium mt-1">⚠️ Esperando material</p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <BadgeEstado estado={t.estado} />
                            <span className="text-xs text-gray-400">{estaExpandido ? '▲' : '▼'}</span>
                          </div>
                        </button>

                        {estaExpandido && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-sm text-gray-600 mb-3">{t.descripcion}</p>

                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                              <span>Centro de costo: {t.centro_costo}</span>
                            </div>

                            {t.retrasado && (
                              <div className="mb-3 bg-danger/10 border border-danger/30 rounded p-3">
                                <p className="text-sm font-bold text-danger">⚠️ Esperando material</p>
                                {t.motivo_retraso && <p className="text-xs text-danger mt-1">{t.motivo_retraso}</p>}

                                <div className="flex gap-2 mt-2 flex-wrap">
                                  {tieneRevisionPendiente && (
                                    <button
                                      onClick={() => handleBodega(t.id)}
                                      className="bg-primary text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-primary-light"
                                    >
                                      📦 Hay en bodega, continuar trabajo
                                    </button>
                                  )}

                                  {tieneCompraPendiente && (
                                    <button
                                      onClick={() => handleMaterialRecibido(t.id)}
                                      className="bg-primary text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-primary-light"
                                    >
                                      ✓ Material recibido, continuar trabajo
                                    </button>
                                  )}

                                  {!tieneRevisionPendiente && !tieneCompraPendiente && (
                                    <p className="text-xs text-gray-500">El admin ya está gestionando este retraso.</p>
                                  )}
                                </div>
                              </div>
                            )}

                            {t.foto && <img src={t.foto} alt="evidencia" className="w-20 h-20 object-cover rounded border mb-3" />}

                            {t.materiales?.length > 0 && (
                              <div className="mb-3 border rounded p-2 bg-gray-50">
                                <p className="text-xs font-bold text-dark mb-1">Materiales usados:</p>
                                <ul className="text-xs text-gray-600 list-disc pl-4">
                                  {t.materiales.map((mat) => (
                                    <li key={mat.id}>{mat.nombre} — {mat.cantidad}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {estaEnEdicion ? (
                              <div className="border-t pt-3 mt-2 flex flex-col gap-3 bg-gray-50 -mx-4 -mb-4 p-4 rounded-b-lg">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium mb-1 text-dark">Estado</label>
                                    <select
                                      value={editando.estado}
                                      onChange={(e) => setEditando({ ...editando, estado: e.target.value })}
                                      className="w-full border rounded p-2 text-sm"
                                      disabled={editando.estado === 'TERMINADO'}
                                    >
                                      <option value="PENDIENTE">Pendiente</option>
                                      <option value="EN_PROGRESO">En progreso</option>
                                      <option value="TERMINADO">Terminado</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium mb-1 text-dark">Avance (%)</label>
                                    <input
                                      type="number" min="0" max="100" value={editando.avance}
                                      onChange={(e) => setEditando({ ...editando, avance: e.target.value })}
                                      className="w-full border rounded p-2 text-sm"
                                    />
                                  </div>
                                </div>

                                <div className="border-t pt-3">
                                  {!mostrarRetraso ? (
                                    <button
                                      type="button"
                                      onClick={() => setMostrarRetraso(true)}
                                      className="bg-danger/10 text-danger px-3 py-2 rounded text-sm font-medium hover:bg-danger/20"
                                    >
                                      ⚠️ Reportar retraso del trabajo
                                    </button>
                                  ) : (
                                    <div className="flex flex-col gap-2">
                                      <label className="block text-xs font-medium text-dark">
                                        Motivo del retraso (opcional)
                                      </label>
                                      <input
                                        value={motivoRetraso}
                                        onChange={(e) => setMotivoRetraso(e.target.value)}
                                        placeholder="Ej: Falta de material, imprevisto..."
                                        className="border rounded p-2 text-sm"
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleReportarRetraso(t.id)}
                                          className="bg-danger text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-danger-light"
                                        >
                                          Confirmar retraso
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setMostrarRetraso(false)}
                                          className="bg-dark/10 text-dark px-3 py-1.5 rounded text-sm"
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {listoParaCompletar && (
                                  <div className="border-t pt-3 bg-primary/5 -mx-4 px-4 py-3">
                                    <p className="text-sm font-medium text-dark mb-2">
                                      Avance al 100% — marca el trabajo como completado:
                                    </p>
                                    <button
                                      onClick={handleCompletar}
                                      className="w-full bg-primary text-white px-3 py-2 rounded text-sm font-medium hover:bg-primary-light"
                                    >
                                      Marcar trabajo como completado
                                    </button>
                                  </div>
                                )}

                                <div className="border-t pt-3">
                                  <label className="block text-xs font-medium mb-1 text-dark">Agregar material usado</label>
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      placeholder="Nombre"
                                      value={nuevoMaterial.nombre}
                                      onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, nombre: e.target.value })}
                                      className="border rounded p-2 text-sm"
                                    />
                                    <input
                                      placeholder="Cantidad (ej: 5 m, 2 kg, 3 planchas)"
                                      value={nuevoMaterial.cantidad}
                                      onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, cantidad: e.target.value })}
                                      className="border rounded p-2 text-sm"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleAgregarMaterial(t.id)}
                                    className="mt-2 text-xs bg-dark text-white px-3 py-1.5 rounded hover:bg-dark-soft"
                                  >
                                    + Agregar material
                                  </button>
                                </div>

                                <div className="flex gap-2">
                                  <button onClick={guardarCambios} className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-light text-sm font-medium">
                                    Guardar cambios
                                  </button>
                                  <button onClick={() => setEditando(null)} className="bg-dark/10 text-dark px-4 py-2 rounded hover:bg-dark/20 text-sm">
                                    Cerrar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => abrirEdicion(t)} className="text-primary text-sm font-medium hover:underline">
                                Actualizar avance / materiales
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {trabajosHistorial.length > 0 && (
                <div className="mt-6 bg-white rounded-lg shadow p-4">
                  <button
                    onClick={() => setMostrarHistorial(!mostrarHistorial)}
                    className="text-primary text-sm font-medium hover:underline"
                  >
                    {mostrarHistorial ? '▲ Ocultar' : '▼ Ver'} historial de trabajos terminados ({trabajosHistorial.length})
                  </button>

                  {mostrarHistorial && (
                    <div className="flex flex-col gap-3 mt-3">
                      {trabajosHistorial.map((t) => {
                        const estaExpandido = Boolean(expandido[t.id])
                        return (
                          <div key={t.id} className="bg-gray-50 rounded-lg shadow p-4 opacity-80">
                            <button
                              type="button"
                              onClick={() => toggleExpandido(t.id)}
                              className="w-full flex justify-between items-start text-left gap-3"
                            >
                              <div className="flex gap-3 min-w-0">
                                <span className="text-xs font-bold text-primary bg-primary/10 rounded px-1.5 py-0.5 h-fit shrink-0">
                                  #{t.correlativo}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-dark uppercase">{t.categoria_display}</p>
                                  <p className="text-sm text-gray-600">{t.cliente_nombre}</p>
                                  <p className="text-sm text-gray-700 mt-1 truncate">{t.descripcion}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <BadgeEstado estado={t.estado} />
                                <span className="text-xs text-gray-400">{estaExpandido ? '▲' : '▼'}</span>
                              </div>
                            </button>

                            {estaExpandido && (
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-sm text-gray-600 mb-2">{t.descripcion}</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                  <span>Centro de costo: {t.centro_costo}</span>
                                  <span>
                                    {t.modalidad_entrega
                                      ? (t.modalidad_entrega === 'RETIRO' ? '✅ Retiro en local' : `✅ Delivery a ${t.direccion_entrega}`)
                                      : '⏳ Cliente aún no elige retiro/delivery'}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        })()}
        </div>
      </main>
    </div>
  )
}