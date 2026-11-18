// Color y etiqueta de un trabajo según el estado de su cotización (mismo
// criterio que la pestaña Cotizaciones): verde = cotización bloqueada,
// azul = facturada. Se usa en el panel admin y en el del cliente.

export function EtiquetaCotizacion({ trabajo }) {
  if (trabajo.estado_cotizacion === 'FACTURADA') {
    return (
      <span className="text-xs font-medium text-blue-800 bg-blue-100 px-2 py-0.5 rounded whitespace-nowrap">
        🧾 Factura N° {trabajo.numero_factura}
      </span>
    )
  }
  if (trabajo.estado_cotizacion === 'BLOQUEADA') {
    return (
      <span className="text-xs font-medium text-green-800 bg-green-100 px-2 py-0.5 rounded whitespace-nowrap">
        🔒 Cotizado
      </span>
    )
  }
  if (trabajo.estado_cotizacion === 'DESBLOQUEADA') {
    return (
      <span className="text-xs font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded whitespace-nowrap">
        🔓 Cotización en edición
      </span>
    )
  }
  return null
}
