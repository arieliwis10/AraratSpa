import { useState, useEffect } from 'react'
import { getTrabajos, actualizarTrabajo, aprobarTrabajo, agregarMaterial } from '../../api/maestranza'
import { getUsuarios } from '../../api/usuarios'
import BadgeEstado from '../BadgeEstado'

export default function AdminMaestranza() {
  const [trabajos, setTrabajos] = useState([])
  const [clientes, setClientes] = useState([])
  const [trabajadores, setTrabajadores] = useState([])
  const [filtroCliente, setFiltroCliente] = useState('')
  const [editando, setEditando] = useState(null)
  const [nuevoMaterial, setNuevoMaterial] = useState({ nombre: '', cantidad: '', unidad: '' })
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarUsuarios()
  }, [])

  useEffect(() => {
    cargarTrabajos()
  }, [filtroCliente])

  async function cargarUsuarios() {
    const res = await getUsuarios()
    setClientes(res.data.filter((u) => u.rol === 'CLIENTE'))
    setTrabajadores(res.data.filter((u) => u.rol === 'TRABAJADOR'))
  }

  async function cargarTrabajos() {
    setCargando(true)
    try {
      const params = filtroCliente ? { cliente: filtroCliente } : {}
      const res = await getTrabajos(params)
      setTrabajos(res.data)
    } finally {
      setCargando(false)
    }
  }

  function abrirEdicion(trabajo) {
    setEditando({
      id: trabajo.id,
      estado: trabajo.estado,
      avance: trabajo.avance,
      tiempo_entrega: trabajo.tiempo_entrega || '',
      modalidad_entrega: trabajo.modalidad_entrega || '',
      asignado_a: trabajo.asignado_a || '',
    })
    setNuevoMaterial({ nombre: '', cantidad: '', unidad: '' })
  }

  async function guardarCambios() {
    try {
      await actualizarTrabajo(editando.id, {
        estado: editando.estado,
        avance: editando.avance,
        tiempo_entrega: editando.tiempo_entrega || null,
        modalidad_entrega: editando.modalidad_entrega || null,
        asignado_a: editando.asignado_a || null,
      })
      setEditando(null)
      cargarTrabajos()
    } catch (err) {
      alert('Error al actualizar el trabajo')
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
      setNuevoMaterial({ nombre: '', cantidad: '', unidad: '' })
      cargarTrabajos()
    } catch (err) {
      alert('Error al agregar el material')
    }
  }

  if (cargando) return <p className="text-dark">Cargando...</p>

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium mb-1 text-dark">Filtrar por cliente</label>
        <select
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
          className="border rounded p-2 text-sm w-full sm:w-64"
        >
          <option value="">Todos los clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.username}</option>
          ))}
        </select>
      </div>

      {trabajos.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No hay trabajos de maestranza todavía.
        </div>
      )}

      {trabajos.map((t) => (
        <div key={t.id} className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs font-bold text-primary uppercase">{t.categoria_display}</span>
              <p className="text-sm font-medium text-dark">{t.cliente_nombre}</p>
              <p className="text-sm text-gray-600">{t.descripcion}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <BadgeEstado estado={t.estado} />
              {t.aprobado ? (
                <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">Aprobado</span>
              ) : (
                <button
                  onClick={() => handleAprobar(t.id)}
                  className="text-xs text-white bg-primary px-2 py-0.5 rounded hover:bg-primary-light"
                >
                  Aprobar trabajo
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
            <span>Centro de costo: {t.centro_costo}</span>
            <span>Avance: {t.avance}%</span>
            {t.tiempo_entrega && <span>Entrega: {t.tiempo_entrega}</span>}
            {t.asignado_a_nombre && <span>Asignado a: {t.asignado_a_nombre}</span>}
          </div>

          {t.foto && <img src={t.foto} alt="evidencia" className="w-20 h-20 object-cover rounded border mb-3" />}

          {/* Materiales */}
          {t.materiales?.length > 0 && (
            <div className="mb-3 border rounded p-2 bg-gray-50">
              <p className="text-xs font-bold text-dark mb-1">Materiales usados:</p>
              <ul className="text-xs text-gray-600 list-disc pl-4">
                {t.materiales.map((mat) => (
                  <li key={mat.id}>{mat.nombre} — {mat.cantidad} {mat.unidad}</li>
                ))}
              </ul>
            </div>
          )}

          {editando?.id === t.id ? (
            <div className="border-t pt-3 mt-2 flex flex-col gap-3 bg-gray-50 -mx-4 -mb-4 p-4 rounded-b-lg">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1 text-dark">Estado</label>
                  <select
                    value={editando.estado}
                    onChange={(e) => setEditando({ ...editando, estado: e.target.value })}
                    className="w-full border rounded p-2 text-sm"
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
                  <label className="block text-xs font-medium mb-1 text-dark">Modalidad de entrega</label>
                  <select
                    value={editando.modalidad_entrega}
                    onChange={(e) => setEditando({ ...editando, modalidad_entrega: e.target.value })}
                    className="w-full border rounded p-2 text-sm"
                  >
                    <option value="">Sin definir</option>
                    <option value="RETIRO">Retiro en local</option>
                    <option value="DELIVERY">Delivery</option>
                  </select>
                </div>
                <div className="col-span-2">
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

              {/* Agregar material */}
              <div className="border-t pt-3">
                <label className="block text-xs font-medium mb-1 text-dark">Agregar material usado</label>
                <div className="grid grid-cols-3 gap-2">
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
                  <input
                    placeholder="Unidad (kg, un, mt)"
                    value={nuevoMaterial.unidad}
                    onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, unidad: e.target.value })}
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
      ))}
    </div>
  )
}