import { useState, useEffect } from 'react'
import { getHistorialEliminaciones } from '../../api/historial'

function formatFechaHora(fechaISO) {
  if (!fechaISO) return '-'
  return new Date(fechaISO).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
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
            <div key={h.id} className="bg-white rounded-lg shadow p-3 flex justify-between items-center gap-3 flex-wrap">
              <div>
                <span className="text-xs font-bold text-danger uppercase">{h.tipo}</span>
                <p className="text-sm text-dark">{h.descripcion}</p>
              </div>
              <div className="text-right text-xs text-gray-500">
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