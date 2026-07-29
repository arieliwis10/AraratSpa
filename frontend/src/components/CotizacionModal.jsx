import { useState } from 'react'
import { generarCotizacionPDF } from '../utils/generarCotizacionPDF'
import { crearCotizacion } from '../api/cotizaciones'

function claveMesActual() {
  const fecha = new Date()
  const yyyy = fecha.getFullYear()
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  return `${yyyy}${mm}`
}

function leerContadorCotizaciones(clave) {
  const raw = localStorage.getItem(`cotizacion_correlativo_${clave}`)
  return raw ? parseInt(raw, 10) : 0
}

function guardarContadorCotizaciones(clave, valor) {
  localStorage.setItem(`cotizacion_correlativo_${clave}`, String(valor))
}

// Reserva y devuelve el siguiente número de folio del mes actual.
// Si cambia el mes, la clave cambia y el contador vuelve a partir de 1.
function siguienteFolio() {
  const clave = claveMesActual()
  const actual = leerContadorCotizaciones(clave)
  const nuevo = actual + 1
  guardarContadorCotizaciones(clave, nuevo)
  return `${clave}_${nuevo}`
}

export default function CotizacionModal({ trabajo, onCerrar }) {
  const [obra, setObra] = useState(trabajo.descripcion || '')
  const [mandante, setMandante] = useState(
    trabajo.empresa_nombre || trabajo.cliente_nombre || ''
  )
  const [lugarTrabajo, setLugarTrabajo] = useState('')
  const [validezDias, setValidezDias] = useState('10')
  const [items, setItems] = useState(
    (trabajo.materiales || []).map((m) => ({
      detalle: `${m.nombre} — ${m.cantidad}`,
      cantidad: '1',
      precioUnitario: '',
    }))
  )
  const [notas, setNotas] = useState('')
  const [folioAsignado, setFolioAsignado] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const fechaFormateada = new Date().toLocaleDateString('es-CL')

  function actualizarItem(index, campo, valor) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [campo]: valor } : it)))
  }

  function agregarItem() {
    setItems((prev) => [...prev, { detalle: '', cantidad: '1', precioUnitario: '' }])
  }

  function eliminarItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function totalItem(it) {
    const cant = parseFloat(it.cantidad) || 0
    const precio = parseFloat(it.precioUnitario) || 0
    return cant * precio
  }

  function calcularTotales() {
    const subtotal = items.reduce((acc, it) => acc + totalItem(it), 0)
    const iva = subtotal * 0.19
    const total = subtotal + iva
    return { subtotal, iva, total }
  }

  function formatoCLP(valor) {
    return `$${Math.round(valor).toLocaleString('es-CL')}`
  }

  async function generarPDF() {
    // El folio se asigna recién al generar (no al abrir el modal), para no
    // "quemar" números si el admin abre y cierra sin llegar a generar el PDF.
    const folio = folioAsignado || siguienteFolio()
    if (!folioAsignado) setFolioAsignado(folio)

    const { subtotal, iva, total } = calcularTotales()

    generarCotizacionPDF({
      folio,
      fechaFormateada,
      trabajoLabel: `#${trabajo.correlativo} ${trabajo.categoria_display}`,
      obra,
      mandante,
      lugarTrabajo,
      items,
      notas,
      validezDias,
    })

    setGuardando(true)
    try {
      await crearCotizacion({
        trabajo: trabajo.id,
        folio,
        obra,
        mandante,
        lugar_trabajo: lugarTrabajo,
        validez_dias: validezDias,
        items,
        notas,
        subtotal,
        iva,
        total,
      })
    } catch (err) {
      // El PDF ya se descargó igual; si falla el guardado, no bloqueamos al
      // admin, pero esta cotización no va a aparecer después en la pestaña
      // "Cotizaciones".
      console.error('No se pudo guardar la cotización para consultarla después', err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-lg font-bold text-dark">
            Cotización — {trabajo.categoria_display} #{trabajo.correlativo}
          </h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-dark text-xl leading-none">✕</button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {folioAsignado
            ? `N° Cotización: ${folioAsignado}`
            : 'El N° de cotización se asigna al generar el PDF'}
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium mb-1 text-dark">Obra</label>
            <input
              value={obra}
              onChange={(e) => setObra(e.target.value)}
              className="w-full border rounded p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-dark">Mandante</label>
            <input
              value={mandante}
              onChange={(e) => setMandante(e.target.value)}
              className="w-full border rounded p-2 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1 text-dark">Lugar de trabajo (opcional)</label>
            <input
              value={lugarTrabajo}
              onChange={(e) => setLugarTrabajo(e.target.value)}
              className="w-full border rounded p-2 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-3">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_50px_80px_28px] gap-2 items-center">
              <input
                value={it.detalle}
                onChange={(e) => actualizarItem(i, 'detalle', e.target.value)}
                placeholder="Detalle"
                className="border rounded p-1.5 text-sm"
              />
              <input
                value={it.cantidad}
                onChange={(e) => actualizarItem(i, 'cantidad', e.target.value)}
                placeholder="Cant."
                className="border rounded p-1.5 text-sm text-center"
              />
              <input
                type="number"
                value={it.precioUnitario}
                onChange={(e) => actualizarItem(i, 'precioUnitario', e.target.value)}
                placeholder="Precio"
                className="border rounded p-1.5 text-sm"
              />
              <button onClick={() => eliminarItem(i)} className="text-danger text-sm">✕</button>
            </div>
          ))}
        </div>

        <button type="button" onClick={agregarItem} className="text-xs text-primary hover:underline mb-4">
          + Agregar ítem
        </button>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium mb-1 text-dark">Válida por (días hábiles)</label>
            <input
              type="number"
              value={validezDias}
              onChange={(e) => setValidezDias(e.target.value)}
              className="w-full border rounded p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-dark">Nota (opcional)</label>
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full border rounded p-2 text-sm"
            />
          </div>
        </div>

        <div className="bg-gray-50 rounded p-2 text-sm mb-4 flex justify-between font-medium">
          <span className="text-dark">Total</span>
          <span className="text-primary">{formatoCLP(calcularTotales().total)}</span>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCerrar} className="bg-dark/10 text-dark px-4 py-2 rounded text-sm">
            Cerrar
          </button>
          <button
            onClick={generarPDF}
            disabled={guardando}
            className="bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:bg-primary-light disabled:opacity-60"
          >
            {guardando ? 'Guardando...' : 'Generar PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}