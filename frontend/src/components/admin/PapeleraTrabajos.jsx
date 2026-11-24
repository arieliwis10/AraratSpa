import { useState, useEffect } from 'react'
import { getPapeleraTrabajos, restaurarTrabajo, eliminarTrabajoDefinitivo } from '../../api/maestranza'
import BadgeEstado from '../BadgeEstado'
import Spinner from '../Spinner'

function formatearFecha(iso) {
  return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Papelera de trabajos de maestranza. "Eliminar trabajo" los manda acá:
 * se pueden restaurar tal cual (con fotos, materiales, comentarios y
 * cotizaciones) o eliminar definitivamente.
 *
 * `version` cambia cada vez que el padre manda algo a la papelera, para recargar.
 */
export default function PapeleraTrabajos({ version, onRestaurado }) {
  const [trabajos, setTrabajos] = useState([])
  const [abierta, setAbierta] = useState(false)
  const [procesando, setProcesando] = useState(null)

  useEffect(() => {
    cargar()
  }, [version])

  async function cargar() {
    try {
      const res = await getPapeleraTrabajos()
      setTrabajos(res.data)
    } catch {
      // Si falla, la papelera simplemente no se muestra.
    }
  }

  async function handleRestaurar(t) {
    setProcesando(t.id)
    try {
      await restaurarTrabajo(t.id)
      await cargar()
      onRestaurado?.()
    } catch {
      alert('Error al restaurar el trabajo')
    } finally {
      setProcesando(null)
    }
  }

  async function handleEliminarDefinitivo(t) {
    if (!confirm(
      `¿Eliminar DEFINITIVAMENTE el trabajo #${t.correlativo}?\n\n` +
      'Se borrarán sus materiales, comentarios y ficha de flexibles. Esta acción no se puede deshacer.'
    )) return
    setProcesando(t.id)
    try {
      await eliminarTrabajoDefinitivo(t.id)
      await cargar()
    } catch {
      alert('Error al eliminar el trabajo')
    } finally {
      setProcesando(null)
    }
  }

  if (trabajos.length === 0) return null

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <button
        onClick={() => setAbierta(!abierta)}
        className="text-gray-600 text-sm font-medium hover:underline"
      >
        {abierta ? '▲ Ocultar' : '▼ Ver'} papelera 🗑 ({trabajos.length})
      </button>

      {abierta && (
        <div className="flex flex-col gap-3 mt-3">
          <p className="text-xs text-gray-500">
            Los trabajos eliminados quedan aquí, ocultos para el cliente y el trabajador.
            Al restaurarlos vuelven con todo (fotos, materiales, comentarios y cotizaciones).
          </p>

          {trabajos.map((t) => (
            <div key={t.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex flex-col gap-2">
              <div className="flex justify-between items-start gap-3">
                <div className="flex gap-3 min-w-0">
                  <span className="text-xs font-bold text-gray-600 bg-gray-200 rounded px-1.5 py-0.5 h-fit shrink-0">
                    #{t.correlativo}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-dark uppercase">{t.categoria_display}</p>
                    <p className="text-sm text-gray-600">{t.empresa_nombre || t.cliente_nombre}</p>
                    <p className="text-sm text-gray-700 mt-1 line-clamp-2">{t.descripcion}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      🗑 Eliminado {formatearFecha(t.eliminado_en)}
                      {t.eliminado_por_nombre && ` por ${t.eliminado_por_nombre}`}
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  <BadgeEstado estado={t.estado} />
                </div>
              </div>

              <div className="flex justify-between items-center gap-2">
                <button
                  onClick={() => handleRestaurar(t)}
                  disabled={procesando === t.id}
                  className="bg-primary text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-primary-light disabled:opacity-60 flex items-center gap-2"
                >
                  {procesando === t.id && <Spinner />}
                  ↩ Restaurar
                </button>
                <button
                  onClick={() => handleEliminarDefinitivo(t)}
                  disabled={procesando === t.id}
                  className="text-danger text-xs font-medium hover:underline disabled:opacity-50"
                >
                  Eliminar definitivamente
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
