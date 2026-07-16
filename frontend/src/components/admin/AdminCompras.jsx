import { useState } from 'react'
import { useEffect } from 'react'
import { getSolicitudesMaterial, hayEnBodega, enviarACompras, marcarMaterialRecibido } from '../../api/maestranza'

export default function AdminCompras() {
  const [solicitudes, setSolicitudes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [lugarCompra, setLugarCompra] = useState({})

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    try {
      const res = await getSolicitudesMaterial()
      setSolicitudes(res.data)
    } finally {
      setCargando(false)
    }
  }

  async function handleBodega(id) {
    if (!confirm('¿Confirmas que hay stock en bodega? Esto resuelve el retraso de inmediato.')) return
    try {
      await hayEnBodega(id)
      cargar()
    } catch (err) {
      alert('Error al confirmar bodega')
    }
  }

  async function handleEnviarCompras(id) {
    try {
      await enviarACompras(id)
      cargar()
    } catch (err) {
      alert('Error al enviar a compras')
    }
  }

  async function handleRecibido(id) {
    const lugar = lugarCompra[id] || ''
    if (!confirm('¿Confirmas que el material ya llegó? El trabajo podrá continuar.')) return
    try {
      await marcarMaterialRecibido(id, lugar)
      cargar()
    } catch (err) {
      alert('Error al marcar como recibido')
    }
  }

  const enRevision = solicitudes.filter((s) => s.estado === 'REVISION')
  const pendientesCompra = solicitudes.filter((s) => s.estado === 'PENDIENTE')
  const resueltas = solicitudes.filter((s) => s.estado === 'RECIBIDO')

  if (cargando) return <p className="text-dark">Cargando...</p>

  return (
    <div className="flex flex-col gap-6">

      {/* Pendientes de compra real */}
      <div>
        <h2 className="text-dark font-medium mb-3">Listado de compras ({pendientesCompra.length})</h2>
        {pendientesCompra.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500 text-sm">
            No hay materiales pendientes de comprar.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pendientesCompra.map((s) => (
              <div key={s.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-primary">
                <span className="text-xs font-bold text-primary uppercase">
                  {s.trabajo_categoria} #{s.trabajo_correlativo}
                </span>
                <p className="text-sm font-medium text-dark">{s.empresa_nombre || s.cliente_nombre}</p>
                <p className="text-sm text-gray-600 mt-1">{s.trabajo_descripcion}</p>
                {s.descripcion && <p className="text-sm text-gray-500 mt-2">Detalle: {s.descripcion}</p>}
                <div className="flex gap-2 mt-3">
                  <input
                    placeholder="¿Dónde se compró? (proveedor, tienda)"
                    value={lugarCompra[s.id] || ''}
                    onChange={(e) => setLugarCompra({ ...lugarCompra, [s.id]: e.target.value })}
                    className="flex-1 border rounded p-2 text-sm"
                  />
                  <button
                    onClick={() => handleRecibido(s.id)}
                    className="bg-primary text-white px-3 py-2 rounded text-sm font-medium hover:bg-primary-light whitespace-nowrap"
                  >
                    ✓ Recibido
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial */}
      {resueltas.length > 0 && (
        <div>
          <h2 className="text-dark font-medium mb-3">Historial resuelto</h2>
          <div className="flex flex-col gap-2">
            {resueltas.map((s) => (
              <div key={s.id} className="bg-white rounded-lg shadow p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-dark font-medium">
                    {s.trabajo_categoria} #{s.trabajo_correlativo} — {s.empresa_nombre || s.cliente_nombre}
                  </span>
                  <span className="text-green-700 text-xs">
                    {new Date(s.resuelto_en).toLocaleDateString('es-CL')}
                  </span>
                </div>
                {s.lugar_compra && (
                  <p className="text-xs text-gray-500 mt-1">Comprado en: {s.lugar_compra}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}