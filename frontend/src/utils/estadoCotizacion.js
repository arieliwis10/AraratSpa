// Clase de color de la tarjeta de un trabajo según su cotización (mismo
// criterio que la pestaña Cotizaciones): verde = bloqueada, azul = facturada.
export function claseTarjetaCotizacion(trabajo, claseSinCotizacion = 'bg-white opacity-80') {
  if (trabajo.estado_cotizacion === 'FACTURADA') return 'bg-blue-50 border-l-4 border-blue-600'
  if (trabajo.estado_cotizacion === 'BLOQUEADA') return 'bg-green-50 border-l-4 border-green-600'
  return claseSinCotizacion
}
