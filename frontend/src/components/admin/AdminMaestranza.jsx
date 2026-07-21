import { useState, useEffect } from 'react'
import {
  getTrabajos, actualizarTrabajo, aprobarTrabajo, marcarCompletado, agregarMaterial,
  getSolicitudesMaterial, hayEnBodega, enviarACompras, agregarComentario
} from '../../api/maestranza'
import { getUsuarios, getEmpresas } from '../../api/usuarios'
import BadgeEstado from '../BadgeEstado'
import CotizacionModal from '../CotizacionModal'

export default function AdminMaestranza() {
  const [trabajos, setTrabajos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [trabajadores, setTrabajadores] = useState([])
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [editando, setEditando] = useState(null)
  const [nuevoMaterial, setNuevoMaterial] = useState({ nombre: '', cantidad: '' })
  const [cargando, setCargando] = useState(true)
  const [solicitudesRevision, setSolicitudesRevision] = useState([])
  const [comentarioTexto, setComentarioTexto] = useState({})
  const [enviandoComentario, setEnviandoComentario] = useState(null)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [expandido, setExpandido] = useState({})
  const [cotizando, setCotizando] = useState(null)
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] = useState({})
  const [mostrarSinAsignar, setMostrarSinAsignar] = useState(true)

  useEffect(() => {
    cargarEmpresas()
    cargarTrabajadores()
    cargarSolicitudesRevision()
  }, [])

  useEffect(() => {
    cargarTrabajos()
  }, [filtroEmpresa])

  async function cargarEmpresas() {
    const res = await getEmpresas()
    setEmpresas(res.data)
  }

  async function cargarTrabajadores() {
    const res = await getUsuarios()
    setTrabajadores(res.data.filter((u) => u.rol === 'TRABAJADOR'))
  }

  async function cargarSolicitudesRevision() {
    const res = await getSolicitudesMaterial()
    setSolicitudesRevision(res.data.filter((s) => s.estado === 'REVISION'))
  }

  async function handleBodega(id) {
    if (!confirm('¿Confirmas que hay stock en bodega? Esto resuelve el retraso de inmediato.')) return
    try {
      await hayEnBodega(id)
      cargarSolicitudesRevision()
      cargarTrabajos()
    } catch (err) {
      alert('Error al confirmar bodega')
    }
  }

  async function handleEnviarCompras(id) {
    try {
      await enviarACompras(id)
      cargarSolicitudesRevision()
      cargarTrabajos()
    } catch (err) {
      alert('Error al enviar a compras')
    }
  }

  async function cargarTrabajos() {
    setCargando(true)
    try {
      const params = filtroEmpresa ? { empresa: filtroEmpresa } : {}
      const res = await getTrabajos(params)
      setTrabajos(res.data)
    } finally {
      setCargando(false)
    }
  }

  function toggleExpandido(id) {
    setExpandido((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleAsignarDesdeBanner(trabajoId) {
    const trabajadorId = trabajadorSeleccionado[trabajoId]
    if (!trabajadorId) {
      alert('Selecciona un trabajador')
      return
    }
    try {
      await actualizarTrabajo(trabajoId, { asignado_a: trabajadorId, estado: 'EN_PROGRESO' })
      setTrabajadorSeleccionado((prev) => ({ ...prev, [trabajoId]: '' }))
      cargarTrabajos()
    } catch (err) {
      alert('Error al asignar trabajador')
    }
  }

  function abrirEdicion(trabajo) {
    setEditando({
      id: trabajo.id,
      estado: trabajo.estado,
      avance: trabajo.avance,
      tiempo_entrega: trabajo.tiempo_entrega || '',
      asignado_a: trabajo.asignado_a || '',
    })
    setNuevoMaterial({ nombre: '', cantidad: '' })
    setExpandido((prev) => ({ ...prev, [trabajo.id]: true }))
  }

  async function guardarCambios() {
    try {
      await actualizarTrabajo(editando.id, {
        estado: editando.estado,
        avance: editando.avance,
        tiempo_entrega: editando.tiempo_entrega || null,
        asignado_a: editando.asignado_a || null,
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

  async function handleAprobar(id) {
    try {
      await aprobarTrabajo(id)
      cargarTrabajos()
    } catch (err) {
      alert('Error al aprobar el trabajo')
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

  function handleComentarioChange(trabajoId, valor) {
    setComentarioTexto((prev) => ({ ...prev, [trabajoId]: valor }))
  }

  async function handleEnviarComentario(trabajoId) {
    const mensaje = (comentarioTexto[trabajoId] || '').trim()
    if (!mensaje) return
    setEnviandoComentario(trabajoId)
    try {
      await agregarComentario(trabajoId, mensaje)
      setComentarioTexto((prev) => ({ ...prev, [trabajoId]: '' }))
      cargarTrabajos()
    } catch (err) {
      alert('Error al enviar el comentario')
    } finally {
      setEnviandoComentario(null)
    }
  }

  if (cargando) return <p className="text-dark">Cargando...</p>

  const trabajosHistorial = trabajos.filter((t) => t.estado === 'TERMINADO')
  const trabajosActivos = trabajos.filter((t) => t.estado !== 'TERMINADO')
  const trabajosSinAsignar = trabajosActivos.filter((t) => t.estado === 'PENDIENTE' && !t.asignado_a)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium mb-1 text-dark">Filtrar por empresa</label>
        <select
          value={filtroEmpresa}
          onChange={(e) => setFiltroEmpresa(e.target.value)}
          className="border rounded p-2 text-sm w-full sm:w-64"
        >
          <option value="">Todas las empresas</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>
      </div>

      {/* Carpeta Terminados: justo después del filtro por empresa */}
      {trabajosHistorial.length > 0 && (
        <div className="border-b pb-4">
          <button
            onClick={() => setMostrarHistorial(!mostrarHistorial)}
            className="text-primary text-sm font-medium hover:underline"
          >
            {mostrarHistorial ? '▲ Ocultar' : '▼ Ver'} carpeta Terminados ({trabajosHistorial.length})
          </button>

          {mostrarHistorial && (
            <div className="flex flex-col gap-3 mt-3">
              {trabajosHistorial.map((t) => {
                const estaExpandido = Boolean(expandido[t.id])
                return (
                  <div key={t.id} className="bg-white rounded-lg shadow p-4 opacity-80">
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
                          <p className="text-sm text-gray-600">{t.empresa_nombre || t.cliente_nombre}</p>
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
                        <p className="text-sm font-medium text-dark mb-1">{t.cliente_nombre}</p>
                        <p className="text-sm text-gray-600 mb-2">{t.descripcion}</p>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                          <span>Centro de costo: {t.centro_costo}</span>
                          {t.asignado_a_nombre && <span>Realizado por: {t.asignado_a_nombre}</span>}
                          <span>
                            {t.modalidad_entrega
                              ? (t.modalidad_entrega === 'RETIRO' ? '✅ Retiro en local' : `✅ Delivery a ${t.direccion_entrega}`)
                              : '⏳ Cliente aún no elige retiro/delivery'}
                          </span>
                        </div>

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

                        <button
                          onClick={() => setCotizando(t)}
                          className="mb-3 text-primary text-sm font-medium hover:underline"
                        >
                          💰 Generar cotización
                        </button>

                        <div className="border-t pt-3">
                          <p className="text-xs font-bold text-dark mb-2">Comentarios</p>
                          {t.comentarios?.length > 0 ? (
                            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                              {t.comentarios.map((c) => (
                                <div key={c.id} className="bg-gray-50 rounded p-2 text-sm">
                                  <p className="text-xs font-medium text-dark">
                                    {c.autor_nombre}
                                    {c.responsable_nombre && (
                                      <span className="text-gray-400 font-normal"> — encargado: {c.responsable_nombre}</span>
                                    )}{' '}
                                    <span className="text-gray-400 font-normal">
                                      ({c.autor_rol === 'ADMIN' ? 'Admin' : 'Cliente'})
                                    </span>
                                  </p>
                                  <p className="text-gray-700">{c.mensaje}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">Todavía no hay comentarios.</p>
                          )}
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

      {/* Trabajos pendientes sin trabajador asignado */}
      {trabajosSinAsignar.length > 0 && (
        <div className="bg-white rounded-lg shadow border-l-4 border-primary p-4">
          <button
            type="button"
            onClick={() => setMostrarSinAsignar(!mostrarSinAsignar)}
            className="w-full flex justify-between items-center text-left"
          >
            <h3 className="text-sm font-bold text-primary">
              🧑‍🔧 {trabajosSinAsignar.length} trabajo(s) pendiente(s) sin asignar
            </h3>
            <span className="text-xs text-primary">{mostrarSinAsignar ? '▲' : '▼'}</span>
          </button>

          {mostrarSinAsignar && (
            <div className="flex flex-col gap-3 mt-3">
              {trabajosSinAsignar.map((t) => (
                <div key={t.id} className="bg-primary/5 rounded p-3">
                  <p className="text-xs font-bold text-primary uppercase">{t.categoria_display} #{t.correlativo}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{t.empresa_nombre || t.cliente_nombre}</p>
                  <p className="text-sm text-gray-700 mt-1">{t.descripcion}</p>
                  <div className="flex gap-2 mt-2">
                    <select
                      value={trabajadorSeleccionado[t.id] || ''}
                      onChange={(e) =>
                        setTrabajadorSeleccionado((prev) => ({ ...prev, [t.id]: e.target.value }))
                      }
                      className="flex-1 border rounded p-1.5 text-sm"
                    >
                      <option value="">Elige trabajador</option>
                      {trabajadores.map((tr) => (
                        <option key={tr.id} value={tr.id}>{tr.username}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAsignarDesdeBanner(t.id)}
                      className="bg-primary text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-primary-light whitespace-nowrap"
                    >
                      Asignar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notificaciones de retraso por revisar */}
      {solicitudesRevision.length > 0 && (
        <div className="bg-white rounded-lg shadow border-l-4 border-danger p-4">
          <h3 className="text-sm font-bold text-danger mb-3">
            ⚠️ {solicitudesRevision.length} retraso(s) por revisar
          </h3>
          <div className="flex flex-col gap-3">
            {solicitudesRevision.map((s) => (
              <div key={s.id} className="bg-danger/5 rounded p-3">
                <p className="text-xs font-bold text-primary uppercase">
                  {s.trabajo_categoria} #{s.trabajo_correlativo}
                </p>
                <p className="text-sm font-medium text-dark">{s.empresa_nombre || s.cliente_nombre}</p>
                <p className="text-sm text-gray-600 mt-1">{s.trabajo_descripcion}</p>
                {s.descripcion && <p className="text-sm text-danger mt-2 font-medium">Motivo: {s.descripcion}</p>}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleBodega(s.id)}
                    className="flex-1 bg-primary text-white px-3 py-2 rounded text-sm font-medium hover:bg-primary-light"
                  >
                    📦 Hay en bodega
                  </button>
                  <button
                    onClick={() => handleEnviarCompras(s.id)}
                    className="flex-1 bg-dark text-white px-3 py-2 rounded text-sm font-medium hover:bg-dark-soft"
                  >
                    🛒 Enviar a compras
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {trabajosActivos.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No hay trabajos de maestranza todavía.
        </div>
      )}

      {trabajosActivos.map((t) => {
        const estaEnEdicion = editando?.id === t.id
        const avanceEnEdicion = estaEnEdicion ? Number(editando.avance) : Number(t.avance)
        const listoParaCompletar = estaEnEdicion && avanceEnEdicion >= 100 && editando.estado !== 'TERMINADO'
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
                  <p className="text-sm text-gray-600">{t.empresa_nombre || t.cliente_nombre}</p>
                  <p className="text-sm text-gray-700 mt-1 truncate">{t.descripcion}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-1">
                    <span>Avance: {t.avance}%</span>
                    {t.tiempo_entrega && <span>Entrega: {t.tiempo_entrega}</span>}
                  </div>
                  {t.estado === 'PENDIENTE' && !t.asignado_a && (
                    <p className="text-xs text-primary font-medium mt-1">🧑‍🔧 Sin trabajador asignado</p>
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
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-medium text-dark">{t.cliente_nombre}</p>
                    <p className="text-sm text-gray-600">{t.descripcion}</p>
                  </div>
                  {t.aprobado ? (
                    <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded whitespace-nowrap">Aprobado</span>
                  ) : (
                    <button
                      onClick={() => handleAprobar(t.id)}
                      className="text-xs text-white bg-primary px-2 py-0.5 rounded hover:bg-primary-light whitespace-nowrap"
                    >
                      Aprobar trabajo
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                  <span>Centro de costo: {t.centro_costo}</span>
                  {t.asignado_a_nombre && <span>Asignado a: {t.asignado_a_nombre}</span>}
                  {t.modalidad_entrega && (
                    <span>{t.modalidad_entrega === 'RETIRO' ? 'Retiro en local' : 'Delivery'}</span>
                  )}
                </div>

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

                {t.retrasado && (
                  <div className="mb-3 bg-danger/10 border border-danger/30 rounded p-3">
                    <p className="text-sm font-bold text-danger">⚠️ Trabajo en espera de material</p>
                    {t.motivo_retraso && <p className="text-xs text-danger mt-1">{t.motivo_retraso}</p>}
                    <p className="text-xs text-gray-500 mt-1">Revisa el aviso arriba, o en la pestaña "Compras" si ya se envió a comprar.</p>
                  </div>
                )}

                {t.aprobado && (
                  <div className="mb-3 border-t pt-3">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-xs font-bold text-dark">Comentarios</p>
                      <button onClick={cargarTrabajos} className="text-xs text-primary hover:underline">
                        🔄 Actualizar
                      </button>
                    </div>

                    {t.comentarios?.length > 0 ? (
                      <div className="flex flex-col gap-2 mb-2 max-h-48 overflow-y-auto">
                        {t.comentarios.map((c) => (
                          <div key={c.id} className="bg-gray-50 rounded p-2 text-sm">
                            <p className="text-xs font-medium text-dark">
                              {c.autor_nombre}
                              {c.responsable_nombre && (
                                <span className="text-gray-400 font-normal"> — encargado: {c.responsable_nombre}</span>
                              )}{' '}
                              <span className="text-gray-400 font-normal">
                                ({c.autor_rol === 'ADMIN' ? 'Admin' : 'Cliente'})
                              </span>
                            </p>
                            <p className="text-gray-700">{c.mensaje}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mb-2">Todavía no hay comentarios.</p>
                    )}

                    <div className="flex gap-2">
                      <input
                        value={comentarioTexto[t.id] || ''}
                        onChange={(e) => handleComentarioChange(t.id, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleEnviarComentario(t.id)}
                        placeholder="Responde al cliente..."
                        className="flex-1 border rounded p-2 text-sm"
                      />
                      <button
                        onClick={() => handleEnviarComentario(t.id)}
                        disabled={enviandoComentario === t.id}
                        className="bg-primary text-white px-3 py-2 rounded text-sm font-medium hover:bg-primary-light disabled:opacity-50"
                      >
                        Enviar
                      </button>
                    </div>
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
                      <div>
                        <label className="block text-xs font-medium mb-1 text-dark">Tiempo de entrega</label>
                        <input
                          type="date" value={editando.tiempo_entrega}
                          onChange={(e) => setEditando({ ...editando, tiempo_entrega: e.target.value })}
                          className="w-full border rounded p-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-dark">Trabajador asignado</label>
                        <select
                          value={editando.asignado_a}
                          onChange={(e) => setEditando({ ...editando, asignado_a: e.target.value })}
                          className="w-full border rounded p-2 text-sm"
                        >
                          <option value="">Sin asignar</option>
                          {trabajadores.map((tr) => (
                            <option key={tr.id} value={tr.id}>{tr.username}</option>
                          ))}
                        </select>
                      </div>
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
                    Actualizar / asignar / materiales
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {cotizando && (
        <CotizacionModal trabajo={cotizando} onCerrar={() => setCotizando(null)} />
      )}
    </div>
  )
}