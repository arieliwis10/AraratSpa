import { useState, useEffect } from 'react'
import { getCotizaciones } from '../../api/cotizaciones'
import { getEmpresas } from '../../api/usuarios'
import { getReservas, getPedidosGas } from '../../api/arriendo'
import { getPedidosFerreteria } from '../../api/ferreteria'
import { generarCotizacionPDF } from '../../utils/generarCotizacionPDF'

const MESES = [
  { valor: '01', label: 'Enero' },
  { valor: '02', label: 'Febrero' },
  { valor: '03', label: 'Marzo' },
  { valor: '04', label: 'Abril' },
  { valor: '05', label: 'Mayo' },
  { valor: '06', label: 'Junio' },
  { valor: '07', label: 'Julio' },
  { valor: '08', label: 'Agosto' },
  { valor: '09', label: 'Septiembre' },
  { valor: '10', label: 'Octubre' },
  { valor: '11', label: 'Noviembre' },
  { valor: '12', label: 'Diciembre' },
]

function generarAnios() {
  const actual = new Date().getFullYear()
  const anios = []
  for (let a = actual + 1; a >= actual - 3; a--) {
    anios.push(String(a))
  }
  return anios
}

function formatFechaHora(fechaISO) {
  if (!fechaISO) return '-'
  return new Date(fechaISO).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

function pasaFiltro(fechaISO, empresaId, filtroEmpresa, filtroAnio, filtroMes) {
  const pasaEmpresa = !filtroEmpresa || String(empresaId ?? '') === String(filtroEmpresa)
  const anioDeFecha = (fechaISO || '').slice(0, 4)
  const mesDeFecha = (fechaISO || '').slice(5, 7)
  const pasaAnio = !filtroAnio || anioDeFecha === filtroAnio
  const pasaMes = !filtroMes || mesDeFecha === filtroMes
  return pasaEmpresa && pasaAnio && pasaMes
}

function FiltrosComunes({
  empresas, filtroEmpresa, setFiltroEmpresa,
  filtroMes, setFiltroMes, filtroAnio, setFiltroAnio,
}) {
  const anios = generarAnios()

  return (
    <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-sm font-medium mb-1 text-dark">Empresa</label>
        <select
          value={filtroEmpresa}
          onChange={(e) => setFiltroEmpresa(e.target.value)}
          className="border rounded p-2 text-sm w-full sm:w-56"
        >
          <option value="">Todas las empresas</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-dark">Mes</label>
        <select
          value={filtroMes}
          onChange={(e) => setFiltroMes(e.target.value)}
          className="border rounded p-2 text-sm w-full sm:w-40"
        >
          <option value="">Todos los meses</option>
          {MESES.map((m) => (
            <option key={m.valor} value={m.valor}>{m.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-dark">Año</label>
        <select
          value={filtroAnio}
          onChange={(e) => setFiltroAnio(e.target.value)}
          className="border rounded p-2 text-sm w-full sm:w-28"
        >
          <option value="">Todos</option>
          {anios.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
      {(filtroEmpresa || filtroMes || filtroAnio) && (
        <button
          onClick={() => { setFiltroEmpresa(''); setFiltroMes(''); setFiltroAnio('') }}
          className="text-xs text-primary hover:underline pb-2"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}

function SeccionCotizacionesMaestranza({ filtroEmpresa, filtroMes, filtroAnio }) {
  const [cotizaciones, setCotizaciones] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    getCotizaciones().then((res) => {
      setCotizaciones(res.data)
      setCargando(false)
    })
  }, [])

  function handleDescargar(c) {
    generarCotizacionPDF({
      folio: c.folio,
      fechaFormateada: new Date(c.created_at).toLocaleDateString('es-CL'),
      trabajoLabel: c.trabajo_categoria_display && c.trabajo_correlativo
        ? `${c.trabajo_categoria_display} #${c.trabajo_correlativo}`
        : '-',
      obra: c.obra,
      mandante: c.mandante,
      lugarTrabajo: c.lugar_trabajo,
      items: c.items,
      notas: c.notas,
      validezDias: c.validez_dias,
    })
  }

  const filtradas = cotizaciones.filter((c) => pasaFiltro(c.created_at, c.empresa, filtroEmpresa, filtroAnio, filtroMes))

  if (cargando) return <p className="text-dark">Cargando...</p>

  if (filtradas.length === 0) {
    return <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No hay cotizaciones de Maestranza con este filtro.</div>
  }

  return (
    <div className="flex flex-col gap-3">
      {filtradas.map((c) => (
        <div key={c.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center flex-wrap gap-3">
          <div>
            <p className="text-xs font-bold text-primary uppercase">Folio {c.folio}</p>
            <p className="text-sm font-bold text-dark mt-0.5">{c.empresa_nombre || c.mandante || '-'}</p>
            {c.obra && <p className="text-xs text-gray-500 mt-0.5">{c.obra}</p>}
            <p className="text-xs text-gray-400 mt-0.5">{formatFechaHora(c.created_at)}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-primary font-medium text-sm">
              ${Number(c.total).toLocaleString('es-CL')}
            </span>
            <button
              onClick={() => handleDescargar(c)}
              className="bg-primary text-white px-3 py-1.5 rounded text-sm hover:bg-primary-light"
            >
              Descargar PDF
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function SeccionMaquinas({ filtroEmpresa, filtroMes, filtroAnio }) {
  const [reservas, setReservas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    getReservas().then((res) => {
      setReservas(res.data.filter((r) => r.estado !== 'PENDIENTE'))
      setCargando(false)
    })
  }, [])

  const filtradas = reservas.filter((r) => pasaFiltro(r.created_at, r.empresa, filtroEmpresa, filtroAnio, filtroMes))

  if (cargando) return <p className="text-dark">Cargando...</p>

  if (filtradas.length === 0) {
    return <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No hay reservas resueltas con este filtro.</div>
  }

  return (
    <div className="flex flex-col gap-3">
      {filtradas.map((r) => (
        <div key={r.id} className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-start flex-wrap gap-2">
            <div>
              <p className="text-sm font-bold text-dark">{r.maquina_nombre}</p>
              <p className="text-xs text-gray-500">{r.empresa_nombre || r.cliente_nombre}</p>
              <p className="text-xs text-gray-500">{r.fecha_inicio} a {r.fecha_fin}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatFechaHora(r.created_at)}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${r.estado === 'APROBADA' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {r.estado}
            </span>
          </div>
          {r.precio_total && (
            <div className="mt-2 pt-2 border-t text-sm text-gray-700">
              <p>Días: {r.dias} · Tarifa: {r.tarifa_aplicada}</p>
              <p>Neto: ${Number(r.precio_neto).toLocaleString('es-CL')} · IVA: ${Number(r.iva).toLocaleString('es-CL')}</p>
              <p className="font-medium text-primary">Total: ${Number(r.precio_total).toLocaleString('es-CL')}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function SeccionPedidos({ tipo, filtroEmpresa, filtroMes, filtroAnio }) {
  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const fetcher = tipo === 'ferreteria' ? getPedidosFerreteria : getPedidosGas
    fetcher().then((res) => {
      setPedidos(res.data.filter((p) => p.estado === 'REVISADO'))
      setCargando(false)
    })
  }, [tipo])

  const filtradas = pedidos.filter((p) => pasaFiltro(p.created_at, p.empresa, filtroEmpresa, filtroAnio, filtroMes))

  if (cargando) return <p className="text-dark">Cargando...</p>

  if (filtradas.length === 0) {
    return <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No hay pedidos revisados con este filtro.</div>
  }

  return (
    <div className="flex flex-col gap-3">
      {filtradas.map((p) => (
        <div key={p.id} className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
            <div>
              {p.categoria_display && <p className="text-xs font-bold text-primary uppercase">{p.categoria_display}</p>}
              <p className="text-sm font-bold text-dark">{p.empresa_nombre || p.cliente_nombre}</p>
              <p className="text-xs text-gray-500">
                Solicitado por {p.responsable_nombre || 'sin especificar'}{p.centro_costo ? ` · Centro de costo: ${p.centro_costo}` : ''}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{formatFechaHora(p.created_at)}</p>
            </div>
          </div>
          <ul className="text-sm text-gray-700 list-disc pl-4">
            {p.items.map((item) => (
              <li key={item.id}>{item.nombre} — x{item.cantidad}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default function AdminCotizaciones() {
  const [tipo, setTipo] = useState('maestranza')
  const [empresas, setEmpresas] = useState([])
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroAnio, setFiltroAnio] = useState('')

  useEffect(() => {
    getEmpresas().then((res) => setEmpresas(res.data))
  }, [])

  const TIPOS = [
    { id: 'maestranza', label: 'Maestranza' },
    { id: 'maquinas', label: 'Máquinas' },
    { id: 'ferreteria', label: 'Ferretería' },
    { id: 'gas', label: 'Gas' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 bg-white rounded-lg shadow p-1 w-fit flex-wrap">
        {TIPOS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTipo(t.id)}
            className={`px-4 py-1.5 rounded text-sm font-medium ${tipo === t.id ? 'bg-primary text-white' : 'text-dark hover:bg-gray-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <FiltrosComunes
        empresas={empresas}
        filtroEmpresa={filtroEmpresa}
        setFiltroEmpresa={setFiltroEmpresa}
        filtroMes={filtroMes}
        setFiltroMes={setFiltroMes}
        filtroAnio={filtroAnio}
        setFiltroAnio={setFiltroAnio}
      />

      {tipo === 'maestranza' && <SeccionCotizacionesMaestranza filtroEmpresa={filtroEmpresa} filtroMes={filtroMes} filtroAnio={filtroAnio} />}
      {tipo === 'maquinas' && <SeccionMaquinas filtroEmpresa={filtroEmpresa} filtroMes={filtroMes} filtroAnio={filtroAnio} />}
      {tipo === 'ferreteria' && <SeccionPedidos tipo="ferreteria" filtroEmpresa={filtroEmpresa} filtroMes={filtroMes} filtroAnio={filtroAnio} />}
      {tipo === 'gas' && <SeccionPedidos tipo="gas" filtroEmpresa={filtroEmpresa} filtroMes={filtroMes} filtroAnio={filtroAnio} />}
    </div>
  )
}