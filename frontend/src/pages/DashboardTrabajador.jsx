import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getTrabajos, actualizarProgreso, marcarCompletado, agregarMaterial, reportarRetraso, marcarMaterialRecibido, getSolicitudesMaterial } from '../api/maestranza'
import BadgeEstado from '../components/BadgeEstado'

export default function DashboardTrabajador() {
  const { usuario, logout } = useAuth()
  const [trabajos, setTrabajos] = useState([])
  const [editando, setEditando] = useState(null)
  const [nuevoMaterial, setNuevoMaterial] = useState({ nombre: '', cantidad: '' })
  const [mostrarRetraso, setMostrarRetraso] = useState(false)
  const [motivoRetraso, setMotivoRetraso] = useState('')
  const [cargando, setCargando] = useState(true)
  const [solicitudesPorTrabajo, setSolicitudesPorTrabajo] = useState({})

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
    const mapa = {}
    res.data.filter(s => s.estado === 'PENDIENTE').forEach(s => {
      mapa[s.trabajo] = s.id
    })
    setSolicitudesPorTrabajo(mapa)
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

  async function handleMaterialRecibido(trabajoId) {
    const solicitudId = solicitudesPorTrabajo[trabajoId]
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
      alert('Retraso reportado. El admin fue notificado.')
    } catch (err) {
      alert('Error al reportar el retraso')
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

      <main className="w-full max-w-4xl mx-auto p-4 md:p-8">
        {cargando ? (
          <p className="text-dark">Cargando...</p>
        ) : trabajos.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No tienes trabajos asignados por el momento.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {trabajos.map((t) => {
              const estaEnEdicion = editando?.id === t.id
              const avanceEnEdicion = estaEnEdicion ? Number(editando.avance) : Number(t.avance)
              const listoParaCompletar = estaEnEdicion && avanceEnEdicion >= 100 && editando.estado !== 'TERMINADO'

              return (
                <div key={t.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-bold text-primary uppercase">{t.categoria_display} #{t.correlativo}</span>
                      <p className="text-sm font-medium text-dark">{t.cliente_nombre}</p>
                      <p className="text-sm text-gray-600">{t.descripcion}</p>
                    </div>
                    <BadgeEstado estado={t.estado} />
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                    <span>Centro de costo: {t.centro_costo}</span>
                    <span>Avance: {t.avance}%</span>
                    {t.tiempo_entrega && <span>Entrega estimada: {t.tiempo_entrega}</span>}
                  </div>

                  {t.retrasado && (
                    <div className="mb-3 bg-danger/10 border border-danger/30 rounded p-3">
                      <p className="text-sm font-bold text-danger">⚠️ Esperando material</p>
                      {t.motivo_retraso && <p className="text-xs text-danger mt-1">{t.motivo_retraso}</p>}
                      <button
                        onClick={() => handleMaterialRecibido(t.id)}
                        className="mt-2 bg-primary text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-primary-light"
                      >
                        ✓ Material recibido, continuar trabajo
                      </button>
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

                      {/* Reportar retraso */}
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
                            type="number" step="0.01" placeholder="Cantidad"
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
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}