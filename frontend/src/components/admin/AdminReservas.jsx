import { useState, useEffect } from 'react'
import { getReservas, cambiarEstadoReserva } from '../../api/arriendo'
import { getUsuarios } from '../../api/usuarios'
import BadgeEstado from '../BadgeEstado'

export default function AdminReservas() {
  const [reservas, setReservas] = useState([])
  const [clientes, setClientes] = useState([])
  const [filtroCliente, setFiltroCliente] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    getUsuarios().then((res) => setClientes(res.data.filter((u) => u.rol === 'CLIENTE')))
  }, [])

  useEffect(() => {
    cargarReservas()
  }, [filtroCliente])

  async function cargarReservas() {
    setCargando(true)
    try {
      const params = filtroCliente ? { cliente: filtroCliente } : {}
      const res = await getReservas(params)
      setReservas(res.data)
    } finally {
      setCargando(false)
    }
  }

  async function handleCambiarEstado(id, estado) {
    try {
      await cambiarEstadoReserva(id, estado)
      cargarReservas()
    } catch (err) {
      alert('Error al actualizar la reserva')
    }
  }

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

      {cargando ? (
        <p className="text-dark">Cargando...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reservas.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No hay reservas todavía.</div>
          )}
          {reservas.map((r) => (
            <div key={r.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center flex-wrap gap-3">
            <div>
            <p className="font-bold text-dark">{r.maquina_nombre}</p>
            <p className="text-sm text-gray-600">Cliente: {r.cliente_nombre}</p>
            <p className="text-xs text-gray-500">{r.fecha_inicio} a {r.fecha_fin}</p>
            <p className="text-xs text-gray-500">
                {r.modalidad_entrega === 'DELIVERY' ? `Entrega en obra: ${r.direccion_entrega}` : 'Retiro en local'}
            </p>
            </div>
              <div className="flex items-center gap-3">
                <BadgeEstado estado={r.estado} />
                {r.estado === 'PENDIENTE' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleCambiarEstado(r.id, 'APROBADA')} className="bg-primary text-white px-3 py-1 rounded text-sm hover:bg-primary-light">
                      Aprobar
                    </button>
                    <button onClick={() => handleCambiarEstado(r.id, 'RECHAZADA')} className="bg-danger text-white px-3 py-1 rounded text-sm hover:bg-danger-light">
                      Rechazar
                    </button>
                  </div>
                )}
                {r.estado === 'APROBADA' && (
                  <button onClick={() => handleCambiarEstado(r.id, 'RECHAZADA')} className="bg-danger text-white px-3 py-1 rounded text-sm hover:bg-danger-light">
                    Cancelar reserva
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}