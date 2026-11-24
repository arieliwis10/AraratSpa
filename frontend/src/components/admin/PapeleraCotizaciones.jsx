import { useState, useEffect } from 'react'
import {
  getPapeleraCotizaciones, restaurarCotizacion, eliminarCotizacionDefinitivo,
} from '../../api/cotizaciones'
import Spinner from '../Spinner'

function formatearFecha(iso) {
  return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

// A qué corresponde la cotización, para reconocerla en la papelera.
function origen(c) {
  if (c.trabajo_correlativo) return `#${c.trabajo_correlativo} ${c.trabajo_categoria_display}`
  if (c.reserva_maquina_maquina_nombre) return `Arriendo — ${c.reserva_maquina_maquina_nombre}`
  if (c.pedido_ferreteria) return `Pedido — ${c.pedido_ferreteria_categoria_display || 'Ferretería'}`
  if (c.pedido_gas) return 'Pedido — Gas Licuado'
  return c.orden_trabajo_manual || null
}

/**
 * Papelera de cotizaciones (de todas las secciones). "Eliminar" las manda
 * acá: se pueden restaurar o eliminar definitivamente.
 *
 * `version` cambia cada vez que el padre manda algo a la papelera, para recargar.
 */
export default function PapeleraCotizaciones({ version, onRestaurada }) {
  const [cotizaciones, setCotizaciones] = useState([])
  const [abierta, setAbierta] = useState(false)
  const [procesando, setProcesando] = useState(null)

  useEffect(() => {
    cargar()
  }, [version])

  async function cargar() {
    try {
      const res = await getPapeleraCotizaciones()
      setCotizaciones(res.data)
    } catch {
      // Si falla, la papelera simplemente no se muestra.
    }
  }

  async function handleRestaurar(c) {
    setProcesando(c.id)
    try {
      await restaurarCotizacion(c.id)
      await cargar()
      onRestaurada?.()
    } catch {
      alert('Error al restaurar la cotización')
    } finally {
      setProcesando(null)
    }
  }

  async function handleEliminarDefinitivo(c) {
    if (!confirm(
      `¿Eliminar DEFINITIVAMENTE la cotización folio ${c.folio}?\n\nEsta acción no se puede deshacer.`
    )) return
    setProcesando(c.id)
    try {
      await eliminarCotizacionDefinitivo(c.id)
      await cargar()
    } catch {
      alert('Error al eliminar la cotización')
    } finally {
      setProcesando(null)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <button
        onClick={() => setAbierta(!abierta)}
        className="text-gray-600 text-sm font-medium hover:underline"
      >
        {abierta ? '▲ Ocultar' : '▼ Ver'} papelera de cotizaciones 🗑 ({cotizaciones.length})
      </button>

      {abierta && (
        <div className="flex flex-col gap-3 mt-3">
          <p className="text-xs text-gray-500">
            Las cotizaciones eliminadas quedan aquí. Al restaurarlas vuelven tal cual a su sección.
            Si las eliminas definitivamente pasan al Historial de eliminaciones, desde donde también se pueden recuperar.
          </p>

          {cotizaciones.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">La papelera está vacía.</p>
          )}

          {cotizaciones.map((c) => (
            <div key={c.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex flex-col gap-2">
              <div className="flex justify-between items-start gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-600 uppercase">Folio {c.folio}</p>
                  <p className="text-sm font-bold text-dark mt-0.5">{c.empresa_nombre || c.mandante || '-'}</p>
                  <p className="text-xs font-medium text-dark mt-0.5">Orden de trabajo: {origen(c) || '-'}</p>
                  {c.obra && <p className="text-xs text-gray-500">{c.obra}</p>}
                  <p className="text-xs text-gray-500 mt-1">
                    🗑 Eliminada {formatearFecha(c.eliminado_en)}
                    {c.eliminado_por_nombre && ` por ${c.eliminado_por_nombre}`}
                  </p>
                </div>
                <span className="text-gray-700 font-medium text-sm shrink-0">
                  ${Number(c.total).toLocaleString('es-CL')}
                </span>
              </div>

              <div className="flex justify-between items-center gap-2">
                <button
                  onClick={() => handleRestaurar(c)}
                  disabled={procesando === c.id}
                  className="bg-primary text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-primary-light disabled:opacity-60 flex items-center gap-2"
                >
                  {procesando === c.id && <Spinner />}
                  ↩ Restaurar
                </button>
                <button
                  onClick={() => handleEliminarDefinitivo(c)}
                  disabled={procesando === c.id}
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
