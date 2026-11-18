// Convierte la ficha técnica de un flexible (detalle_flexible del trabajo) en
// líneas con cantidad y precio unitario del catálogo. La usan el resumen de
// la ficha y la cotización.

function nombreProducto(prefijo, info) {
  return [prefijo, info.nombre, info.diametro].filter(Boolean).join(' ')
}

export function lineasFlexible(detalle) {
  if (!detalle) return []
  const lineas = []

  if (detalle.manguera_info) {
    lineas.push({
      detalle: `${nombreProducto('Manguera', detalle.manguera_info)} (m)`,
      cantidad: Number(detalle.largo_metros) || 0,
      precioUnitario: Number(detalle.manguera_info.precio) || 0,
    })
  }

  // Si entrada y salida usan el mismo terminal, va en una sola línea × 2.
  const terminales = [detalle.terminal_entrada_info, detalle.terminal_salida_info].filter(Boolean)
  const porTerminal = new Map()
  terminales.forEach((t) => {
    const actual = porTerminal.get(t.id)
    porTerminal.set(t.id, { info: t, cantidad: (actual?.cantidad || 0) + 1 })
  })
  porTerminal.forEach(({ info, cantidad }) => {
    lineas.push({
      detalle: nombreProducto('Terminal', info),
      cantidad,
      precioUnitario: Number(info.precio) || 0,
    })
  })

  if (detalle.ferula_info) {
    lineas.push({
      detalle: nombreProducto('Férula', detalle.ferula_info),
      cantidad: detalle.cantidad_ferulas,
      precioUnitario: Number(detalle.ferula_info.precio) || 0,
    })
  }

  if (detalle.prensado_info) {
    lineas.push({
      detalle: nombreProducto('Prensado', detalle.prensado_info),
      cantidad: detalle.cantidad_ferulas,
      precioUnitario: Number(detalle.prensado_info.precio) || 0,
    })
  }

  return lineas
}

// Ítems para CotizacionModal (cantidad y precio como texto, igual que el resto).
// Si el admin fijó un precio total a mano (Flexibles → Pedidos), se cotiza
// como una sola línea con ese precio en vez del desglose del catálogo.
export function itemsCotizacionFlexible(detalle) {
  const lineas = lineasFlexible(detalle)
  if (lineas.length === 0) return []

  if (detalle.precio_total != null && detalle.precio_total !== '') {
    const componentes = lineas.map((l) => `${l.detalle} × ${l.cantidad}`).join(', ')
    return [{
      detalle: `Flexible hidráulico: ${componentes}`,
      cantidad: '1',
      precioUnitario: String(Number(detalle.precio_total)),
    }]
  }

  return lineas.map((l) => ({
    detalle: l.detalle,
    cantidad: String(l.cantidad),
    precioUnitario: String(l.precioUnitario),
  }))
}
