import { useState, useEffect } from 'react'
import { getHistorialEliminaciones, recuperarTrabajoHistorial } from '../../api/historial'
import Spinner from '../Spinner'

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

  // 'datos' son ids internos para poder recuperar el trabajo: no se muestran.
  // eslint-disable-next-line no-unused-vars
  const { fotos, datos, ...resto } = detalle
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

const ESTADOS_RECUPERACION = [
  { valor: 'TERMINADO', etiqueta: 'Terminado (va a la carpeta Terminados)' },
  { valor: 'EN_PROGRESO', etiqueta: 'En progreso' },
  { valor: 'PENDIENTE', etiqueta: 'Pendiente' },
]

/**
 * Trabajos de maestranza borrados antes de existir la papelera (o eliminados
 * definitivamente desde ella): se reconstruyen con lo que quedó guardado.
 */
function RecuperarTrabajo({ registro, onRecuperado }) {
  const info = registro.recuperacion
  const [abierto, setAbierto] = useState(false)
  const [cliente, setCliente] = useState(info.cliente_id ? String(info.cliente_id) : '')
  const [estado, setEstado] = useState(info.estado || 'TERMINADO')
  const [enviando, setEnviando] = useState(false)

  async function recuperar() {
    setEnviando(true)
    try {
      const res = await recuperarTrabajoHistorial(registro.id, { cliente, estado })
      const avisos = res.data.avisos?.length ? '\n\n' + res.data.avisos.join('\n') : ''
      alert(`Trabajo #${res.data.correlativo} recuperado. Ya aparece en Maestranza.${avisos}`)
      onRecuperado()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al recuperar el trabajo')
    } finally {
      setEnviando(false)
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-2 text-primary text-xs font-medium hover:underline"
      >
        ↩ Recuperar trabajo
      </button>
    )
  }

  const sinClientes = info.clientes.length === 0

  return (
    <div className="mt-2 bg-gray-50 rounded p-3 flex flex-col gap-2 max-w-md">
      <p className="text-xs text-gray-600">
        Se recupera con el número, categoría, descripción, centro de costo, responsable y fotos.
        Los comentarios y la ficha de flexibles no quedaron guardados.
      </p>

      {sinClientes ? (
        <p className="text-xs text-danger">
          No se encontró la empresa "{info.empresa_nombre}" o no tiene usuarios cliente; créalo primero en Empresas/Usuarios.
        </p>
      ) : (
        <label className="text-xs font-medium text-dark">
          Cliente ({info.empresa_nombre})
          <select
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            className="mt-1 border rounded p-1.5 text-sm w-full bg-white font-normal"
          >
            <option value="">Selecciona un cliente</option>
            {info.clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>
      )}

      <label className="text-xs font-medium text-dark">
        Recuperar como
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="mt-1 border rounded p-1.5 text-sm w-full bg-white font-normal"
        >
          {ESTADOS_RECUPERACION.map((e) => (
            <option key={e.valor} value={e.valor}>{e.etiqueta}</option>
          ))}
        </select>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={recuperar}
          disabled={enviando || !cliente}
          className="bg-primary text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-primary-light disabled:opacity-60 flex items-center gap-2"
        >
          {enviando && <Spinner />}
          Recuperar
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          disabled={enviando}
          className="text-xs text-gray-500 hover:underline"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function HistorialEliminaciones() {
  const [historial, setHistorial] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('TODOS')

  useEffect(() => {
    cargar()
  }, [])

  function cargar() {
    return getHistorialEliminaciones().then((res) => {
      setHistorial(res.data)
      setCargando(false)
    })
  }

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
                {h.restaurado_en ? (
                  <p className="mt-2 text-xs font-medium text-green-700">
                    ✓ Recuperado el {formatFechaHora(h.restaurado_en)}
                  </p>
                ) : h.recuperacion && (
                  <RecuperarTrabajo registro={h} onRecuperado={cargar} />
                )}
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