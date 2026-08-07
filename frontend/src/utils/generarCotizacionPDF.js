import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Datos de cada marca que puede emitir una cotización. ARARAT es para
// Maestranza (y pedidos de ferretería/gas); KAIROS es para arriendo de
// maquinaria. Cambiar acá actualiza automáticamente todos los PDFs nuevos.
//
// ⚠️ Completar los datos reales de KAIROS antes de usar en producción.
const MARCAS = {
  ARARAT: {
    logo: '/Logoararat.png',
    nombreEmpresa: 'ARARAT ESTRUCTURAS METÁLICAS SPA.',
    direccion: 'La Rinconada de Huelquén Sitio 4 Lote B, Paine',
    rut: '77.145.132-2',
    telefono: '+569 99405462',
    emails: ['fcepeda@araratchile.com', 'ventas@araratchile.com'],
    web: 'www.araratchile.com',
  },
  KAIROS: {
    logo: '/Logokairos.png',
    nombreEmpresa: 'KAIROS ARRIENDOS',
    direccion: 'La Rinconada de Huelquén Sitio 4 Lote B, Paine',
    rut: '77.747.959-8',
    telefono: '+569 99405462',
    emails: ['fcepeda@araratchile.com', 'kairos_arriendos@araratchile.com'],
    web: 'www.araratchile.com',
  },
}

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

const logoBase64Cache = {}
async function cargarLogoBase64(marca) {
  if (logoBase64Cache[marca]) return logoBase64Cache[marca]
  try {
    const res = await fetch(MARCAS[marca].logo)
    const blob = await res.blob()
    logoBase64Cache[marca] = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    return logoBase64Cache[marca]
  } catch (err) {
    return null
  }
}

// Construye el documento jsPDF, sin descargarlo ni devolver bytes todavía.
// Uso interno de generarCotizacionPDF y generarCotizacionPDFBase64.
//
// 'marca' decide qué logo y datos de empresa van en el encabezado:
// 'ARARAT' (por defecto, para Maestranza/Ferretería/Gas) o 'KAIROS'
// (para cotizaciones de arriendo de maquinaria).
async function construirDocCotizacion({
  folio, fechaFormateada, trabajoLabel, obra, mandante, lugarTrabajo,
  items, notas, validezDias, marca = 'ARARAT',
}) {
  const marcaValida = marca in MARCAS ? marca : 'ARARAT'
  const datosMarca = MARCAS[marcaValida]
  const { subtotal, iva, total } = calcularTotalesCotizacion(items)
  const logoBase64 = await cargarLogoBase64(marcaValida)
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFillColor(0, 0, 0)
  doc.rect(0, 0, pageWidth, 28, 'F')
  doc.setFillColor(190, 30, 30)
  doc.rect(0, 28, pageWidth, 2, 'F')

  if (logoBase64) {
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
  doc.text(datosMarca.nombreEmpresa, textoX, 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(datosMarca.direccion, textoX, 17)
  doc.text(`RUT: ${datosMarca.rut}   /   Cel: ${datosMarca.telefono}`, textoX, 22)

  doc.setFontSize(8)
  datosMarca.emails.forEach((email, i) => {
    doc.text(email, pageWidth - 60, 9 + i * 4)
  })
  doc.text(datosMarca.web, pageWidth - 60, 9 + datosMarca.emails.length * 4)

  doc.setTextColor(0, 0, 0)

  const filasInfo = [
    ['N° Cotización', folio],
    ['Fecha', fechaFormateada],
    ['Orden de trabajo', trabajoLabel],
  ]
  // Kairos (arriendo de maquinaria) no usa el concepto de "obra" —
  // solo Ararat (Maestranza) lo necesita.
  if (marcaValida !== 'KAIROS') {
    filasInfo.push(['Obra', obra || '-'])
  }
  filasInfo.push(['Mandante', mandante || '-'])
  filasInfo.push(['Lugar de trabajo', lugarTrabajo || '-'])

  autoTable(doc, {
    startY: 36,
    body: filasInfo,
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
    headStyles: { fillColor: [0, 0, 0], textColor: 255 },
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

  return doc
}

// Genera y descarga el PDF (comportamiento de siempre).
export async function generarCotizacionPDF(datos) {
  const doc = await construirDocCotizacion(datos)
  doc.save(`cotizacion_${datos.folio}.pdf`)
}

// Genera el PDF y lo devuelve como data URI base64, sin descargarlo.
// Pensado para mandarlo al backend y que lo adjunte a un correo.
export async function generarCotizacionPDFBase64(datos) {
  const doc = await construirDocCotizacion(datos)
  return doc.output('datauristring')
}