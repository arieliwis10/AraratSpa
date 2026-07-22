import { useState, useEffect } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getSolicitudesMaterial, hayEnBodega, enviarACompras, marcarMaterialRecibido } from '../../api/maestranza'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function mesActualISO() {
  const fecha = new Date()
  const yyyy = fecha.getFullYear()
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

function nombreMes(mesISO) {
  const [yyyy, mm] = mesISO.split('-')
  return `${MESES[parseInt(mm, 10) - 1]} ${yyyy}`
}

function anosDisponibles() {
  const actual = new Date().getFullYear()
  const inicio = actual - 3
  return Array.from({ length: actual - inicio + 1 }, (_, i) => actual - i)
}

export default function AdminCompras() {
  const [solicitudes, setSolicitudes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [lugarCompra, setLugarCompra] = useState({})
  const [mostrarListado, setMostrarListado] = useState(false)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [mesFiltro, setMesFiltro] = useState(mesActualISO())

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

  function generarPDFMes() {
    const doc = new jsPDF()
    const titulo = `Historial de compras — ${nombreMes(mesFiltro)}`

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(titulo, 14, 18)

    const filas = resueltasDelMes.map((s) => [
      new Date(s.resuelto_en).toLocaleDateString('es-CL'),
      s.trabajo ? `${s.trabajo_categoria} #${s.trabajo_correlativo}` : '🔧 Taller',
      s.trabajo ? (s.empresa_nombre || s.cliente_nombre || '-') : (s.solicitante_nombre || '-'),
      s.descripcion || '-',
      s.lugar_compra || '-',
    ])

    autoTable(doc, {
      startY: 26,
      head: [['Fecha', 'Trabajo', 'Empresa / Solicitante', 'Detalle', 'Comprado en']],
      body: filas,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 15, 15], textColor: 255 },
    })

    if (filas.length === 0) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('No hay compras resueltas en este mes.', 14, 30)
    }

    doc.save(`compras_${mesFiltro}.pdf`)
  }

  const enRevision = solicitudes.filter((s) => s.estado === 'REVISION')
  const pendientesCompra = solicitudes.filter((s) => s.estado === 'PENDIENTE')
  const resueltas = solicitudes.filter((s) => s.estado === 'RECIBIDO')

  const resueltasDelMes = resueltas.filter((s) => {
    if (!s.resuelto_en) return false
    return s.resuelto_en.slice(0, 7) === mesFiltro
  })

  if (cargando) return <p className="text-dark">Cargando...</p>

  return (
    <div className="flex flex-col gap-6">

      {/* Pendientes de compra real */}
      <div className="bg-white rounded-lg shadow p-4">
        <button
          type="button"
          onClick={() => setMostrarListado(!mostrarListado)}
          className="w-full flex justify-between items-center text-left"
        >
          <h2 className="text-dark font-medium">Listado de compras ({pendientesCompra.length})</h2>
          <span className="text-xs text-primary">{mostrarListado ? '▲' : '▼'}</span>
        </button>

        {mostrarListado && (
          pendientesCompra.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500 text-sm mt-3">
              No hay materiales pendientes de comprar.
            </div>
          ) : (
            <div className="flex flex-col gap-3 mt-3">
              {pendientesCompra.map((s) => (
                <div key={s.id} className="bg-gray-50 rounded-lg shadow p-4 border-l-4 border-primary">
                  {s.trabajo ? (
                    <>
                      <span className="text-xs font-bold text-primary uppercase">
                        {s.trabajo_categoria} #{s.trabajo_correlativo}
                      </span>
                      <p className="text-sm font-medium text-dark">{s.empresa_nombre || s.cliente_nombre}</p>
                      <p className="text-sm text-gray-600 mt-1">{s.trabajo_descripcion}</p>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-primary uppercase">🔧 Taller</span>
                      <p className="text-sm font-medium text-dark">{s.solicitante_nombre || 'Trabajador'}</p>
                    </>
                  )}
                  {s.descripcion && <p className="text-sm text-gray-500 mt-2">Detalle: {s.descripcion}</p>}
                  <div className="flex gap-2 mt-3">
                    <input
                      placeholder="¿Dónde se compró? (proveedor, tienda)"
                      value={lugarCompra[s.id] || ''}
                      onChange={(e) => setLugarCompra({ ...lugarCompra, [s.id]: e.target.value })}
                      className="flex-1 border rounded p-2 text-sm bg-white"
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
          )
        )}
      </div>

      {/* Historial */}
      {resueltas.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <button
            type="button"
            onClick={() => setMostrarHistorial(!mostrarHistorial)}
            className="w-full flex justify-between items-center text-left"
          >
            <h2 className="text-dark font-medium">Historial resuelto ({resueltas.length})</h2>
            <span className="text-xs text-primary">{mostrarHistorial ? '▲' : '▼'}</span>
          </button>

          {mostrarHistorial && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 bg-gray-50 rounded-lg p-3">
                <label className="text-xs font-medium text-dark whitespace-nowrap">Filtrar por mes:</label>
                <select
                  value={mesFiltro.split('-')[1]}
                  onChange={(e) => setMesFiltro(`${mesFiltro.split('-')[0]}-${e.target.value}`)}
                  className="border rounded p-1.5 text-sm bg-white"
                >
                  {MESES.map((nombre, idx) => (
                    <option key={idx} value={String(idx + 1).padStart(2, '0')}>{nombre}</option>
                  ))}
                </select>
                <select
                  value={mesFiltro.split('-')[0]}
                  onChange={(e) => setMesFiltro(`${e.target.value}-${mesFiltro.split('-')[1]}`)}
                  className="border rounded p-1.5 text-sm bg-white"
                >
                  {anosDisponibles().map((anio) => (
                    <option key={anio} value={anio}>{anio}</option>
                  ))}
                </select>
                <button
                  onClick={generarPDFMes}
                  className="ml-auto bg-dark text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-dark-soft whitespace-nowrap"
                >
                  📄 Descargar PDF de {nombreMes(mesFiltro)}
                </button>
              </div>

              {resueltasDelMes.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500 text-sm">
                  No hay compras resueltas en {nombreMes(mesFiltro)}.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {resueltasDelMes.map((s) => (
                    <div key={s.id} className="bg-gray-50 rounded-lg shadow p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-dark font-medium">
                          {s.trabajo
                            ? `${s.trabajo_categoria} #${s.trabajo_correlativo} — ${s.empresa_nombre || s.cliente_nombre}`
                            : `🔧 Taller — ${s.solicitante_nombre || 'Trabajador'}`}
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
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}