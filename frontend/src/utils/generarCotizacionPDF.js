import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function formatoCLP(valor) {
  return `$${Math.round(valor).toLocaleString('es-CL')}`
}

function totalItem(it) {
  const cant = parseFloat(it.cantidad) || 0
  const precio = parseFloat(it.precioUnitario) || 0
  return cant * precio
}

export function calcularTotalesCotizacion(items) {
  const subtotal = items.reduce((acc, it) => acc + totalItem(it), 0)
  const iva = subtotal * 0.19
  const total = subtotal + iva
  return { subtotal, iva, total }
}

// Descarga /logos/ararat.png (mismo origen, sirve desde /public) y lo
// convierte a base64 para poder dibujarlo dentro del PDF con jsPDF.
// Se cachea en memoria para no volver a descargarlo en cada cotización.
let logoBase64Cache = null
async function cargarLogoBase64() {
  if (logoBase64Cache) return logoBase64Cache
  try {
    const res = await fetch('/Logoararat.png')
    const blob = await res.blob()
    logoBase64Cache = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    return logoBase64Cache
  } catch (err) {
    return null
  }
}

// Genera y descarga el PDF de una cotización. Sirve tanto para generar una
// nueva (desde CotizacionModal) como para volver a descargar una ya
// guardada (desde AdminCotizaciones), siempre que se le pasen los mismos datos.
export async function generarCotizacionPDF({
  folio, fechaFormateada, trabajoLabel, obra, mandante, lugarTrabajo,
  items, notas, validezDias,
}) {
  const { subtotal, iva, total } = calcularTotalesCotizacion(items)
  const logoBase64 = await cargarLogoBase64()
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFillColor(15, 15, 15)
  doc.rect(0, 0, pageWidth, 28, 'F')
  doc.setFillColor(190, 30, 30)
  doc.rect(0, 28, pageWidth, 2, 'F')

  if (logoBase64) {
    // Aspect ratio real del logo (1279x719) para no deformarlo.
    const anchoLogo = 32
    const altoLogo = anchoLogo * (719 / 1279)
    doc.addImage(
      logoBase64, 'PNG',
      8,
      4 + (20 - altoLogo) / 2,
      anchoLogo, altoLogo
    )
  }

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

  autoTable(doc, {
    startY: 36,
    body: [
      ['N° Cotización', folio],
      ['Fecha', fechaFormateada],
      ['Orden de trabajo', trabajoLabel],
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