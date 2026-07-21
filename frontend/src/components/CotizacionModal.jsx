import { useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

  function generarPDF() {
    // El folio se asigna recién al generar (no al abrir el modal), para no
    // "quemar" números si el admin abre y cierra sin llegar a generar el PDF.
    const folio = folioAsignado || siguienteFolio()
    if (!folioAsignado) setFolioAsignado(folio)

    const { subtotal, iva, total } = calcularTotales()
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Membrete: franja negra + acento rojo, con espacio reservado para el logo a la izquierda
    doc.setFillColor(15, 15, 15)
    doc.rect(0, 0, pageWidth, 28, 'F')
    doc.setFillColor(190, 30, 30)
    doc.rect(0, 28, pageWidth, 2, 'F')

    // Casillero blanco reservado para el logo (arriba a la izquierda)
    doc.setFillColor(255, 255, 255)
    doc.rect(8, 4, 32, 20, 'F')
    doc.setDrawColor(180, 180, 180)
    doc.rect(8, 4, 32, 20)

    // Texto del membrete, desplazado a la derecha del casillero del logo
    const textoX = 46
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('ARARAT ESTRUCTURAS METÁLICAS SPA.', textoX, 11)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('La Rinconada de Huelquén Sitio 4 Lote B, Paine', textoX, 17)
    doc.text('RUT: 77.145.132-2   /   Cel: +569 99405462', textoX, 22)

    doc.setFontSize(8)
    doc.text('fcepeda@araratchile.com', pageWidth - 60, 9)
    doc.text('ventas@araratchile.com', pageWidth - 60, 13)
    doc.text('www.araratchile.com', pageWidth - 60, 17)

    doc.setTextColor(0, 0, 0)

    // Tabla de datos generales, en formato de casillas (como Excel)
    autoTable(doc, {
      startY: 36,
      body: [
        ['N° Cotización', folio],
        ['Fecha', fechaFormateada],
        ['Orden de trabajo', `${trabajo.categoria_display} #${trabajo.correlativo}`],
        ['Obra', obra || '-'],
        ['Mandante', mandante || '-'],
        ['Lugar de trabajo', lugarTrabajo || '-'],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 45, fillColor: [240, 240, 240] },
        1: { cellWidth: pageWidth - 45 - 20 },
      },
      margin: { left: 10, right: 10 },
    })

    let y = doc.lastAutoTable.finalY + 6

    // Tabla de ítems, también en formato de casillas
    const filas = items
      .filter((it) => it.detalle)
      .map((it, i) => [
        String(i + 1),
        it.detalle,
        it.cantidad || '1',
        formatoCLP(parseFloat(it.precioUnitario) || 0),
        formatoCLP(totalItem(it)),
      ])

    autoTable(doc, {
      startY: y,
      head: [['Ítem', 'Detalle', 'Cant.', 'Precio', 'Total']],
      body: filas,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 15, 15], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 12 },
        2: { cellWidth: 16 },
        3: { cellWidth: 28 },
        4: { cellWidth: 28 },
      },
      margin: { left: 10, right: 10 },
    })

    y = doc.lastAutoTable.finalY + 6

    doc.setFontSize(8)
    doc.text(`Cotización válida solo por ${validezDias} días hábiles`, 10, y + 4)

    // Tabla de totales, alineada a la derecha, también en casillas
    autoTable(doc, {
      startY: y,
      body: [
        ['Valor neto', formatoCLP(subtotal)],
        ['IVA (19%)', formatoCLP(iva)],
        ['TOTAL', formatoCLP(total)],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 32 },
        1: { cellWidth: 32, halign: 'right' },
      },
      margin: { left: pageWidth - 74, right: 10 },
      didParseCell: (data) => {
        if (data.row.index === 2) {
          data.cell.styles.fillColor = [190, 255, 190]
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fontSize = 10
        }
      },
    })

    y = doc.lastAutoTable.finalY + 8

    if (notas) {
      doc.setFontSize(8)
      doc.text(`Nota: ${notas}`, 10, y)
    }

    doc.save(`cotizacion_${folio}.pdf`)
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
            className="bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:bg-primary-light"
          >
            Generar PDF
          </button>
        </div>
      </div>
    </div>
  )
}