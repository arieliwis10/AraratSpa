import { useState, useEffect } from 'react'
import { getHistorialEliminaciones } from '../../api/historial'

function formatFechaHora(fechaISO) {
  if (!fechaISO) return '-'
  return new Date(fechaISO).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

const ETIQUETAS_DETALLE = {
  descripcion_trabajo: 'Descripción',
  centro_costo: 'Centro de costo',
  responsable: 'Responsable',
}

function DetalleEliminacion({ detalle }) {
  if (!detalle || Object.keys(detalle).length === 0) return null

  const { fotos, ...resto } = detalle
  const entradas = Object.entries(resto).filter(
    ([, valor]) => valor !== null && valor !== undefined && valor !== ''
  )
  const tieneFotos = Array.isArray(fotos) && fotos.length > 0

  if (entradas.length === 0 && !tieneFotos) return null

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {entradas.map(([clave, valor]) => (
        <p key={clave} className="text-xs text-gray-500">
          <span className="font-medium text-gray-600">
            {ETIQUETAS_DETALLE[clave] || clave}:
          </span>{' '}
          {String(valor)}
        </p>
      ))}

      {tieneFotos && (
        <div className="flex gap-1.5 flex-wrap mt-0.5">
          {fotos.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer">
              <img
                src={url}
                alt={`Foto ${i + 1}`}
                className="w-14 h-14 object-cover rounded border border-gray-200 hover:opacity-80"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HistorialEliminaciones() {
  const [historial, setHistorial] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('TODOS')

  useEffect(() => {
    getHistorialEliminaciones().then((res) => {
      setHistorial(res.data)
      setCargando(false)
    })
  }, [])

  const tipos = ['TODOS', ...new Set(historial.map((h) => h.tipo))]
  const filtrado = filtroTipo === 'TODOS' ? historial : historial.filter((h) => h.tipo === filtroTipo)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap items-center bg-white rounded-lg shadow p-3">
        <label className="text-sm font-medium text-dark">Tipo</label>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="border rounded p-2 text-sm"
        >
          {tipos.map((t) => (
            <option key={t} value={t}>{t === 'TODOS' ? 'Todos' : t}</option>
          ))}
        </select>
      </div>

      {cargando ? (
        <p className="text-dark">Cargando...</p>
      ) : filtrado.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No hay eliminaciones registradas.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtrado.map((h) => (
            <div key={h.id} className="bg-white rounded-lg shadow p-3 flex justify-between items-start gap-3 flex-wrap">
              <div>
                <span className="text-xs font-bold text-danger uppercase">{h.tipo}</span>
                <p className="text-sm text-dark">{h.descripcion}</p>
                <DetalleEliminacion detalle={h.detalle} />
              </div>
              <div className="text-right text-xs text-gray-500 shrink-0">
                <p>{h.eliminado_por_nombre}</p>
                <p>{formatFechaHora(h.fecha)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}