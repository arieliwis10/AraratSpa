import { lineasFlexible } from '../utils/flexibles'

function formatoCLP(valor) {
  return `$${Math.round(Number(valor) || 0).toLocaleString('es-CL')}`
}

// Ficha técnica del flexible en modo lectura, con precio por pieza y total.
export default function ResumenFlexible({ detalle, mostrarPrecios = true }) {
  const lineas = lineasFlexible(detalle)
  if (lineas.length === 0) return null

  const total = lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0)
  const tienePrecioManual = detalle.precio_total != null && detalle.precio_total !== ''

  return (
    <div className="mb-3 border rounded p-2 bg-blue-50">
      <p className="text-xs font-bold text-dark mb-1">🔧 Ficha técnica del flexible</p>
      <ul className="text-xs text-gray-700 flex flex-col gap-0.5">
        {lineas.map((l, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span>• {l.detalle} × {l.cantidad}</span>
            {mostrarPrecios && (
              <span className="whitespace-nowrap">{formatoCLP(l.cantidad * l.precioUnitario)}</span>
            )}
          </li>
        ))}
      </ul>
      {mostrarPrecios && (
        <div className="border-t border-blue-200 mt-1 pt-1 text-xs font-medium text-dark flex justify-between">
          <span>{tienePrecioManual ? 'Precio fijado (neto)' : 'Total según catálogo (neto)'}</span>
          <span>{formatoCLP(tienePrecioManual ? detalle.precio_total : total)}</span>
        </div>
      )}
    </div>
  )
}
