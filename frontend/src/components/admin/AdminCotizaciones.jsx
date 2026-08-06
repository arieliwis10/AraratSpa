import { useState, useEffect } from 'react'
import { getCotizaciones, enviarCorreoCotizacion } from '../../api/cotizaciones'
import { getEmpresas } from '../../api/usuarios'
import { generarCotizacionPDF, generarCotizacionPDFBase64 } from '../../utils/generarCotizacionPDF'
import CotizacionModal from '../CotizacionModal'

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

// Etiqueta de "a qué corresponde" la cotización: un trabajo de Maestranza,
// un arriendo de máquina, o una orden de trabajo escrita a mano (cotización suelta).
function calcularLabelOrigen(c) {
  if (c.trabajo_categoria_display && c.trabajo_correlativo) {
    return `${c.trabajo_categoria_display} #${c.trabajo_correlativo}`
  }
  if (c.reserva_maquina_maquina_nombre) {
    return `Arriendo — ${c.reserva_maquina_maquina_nombre}`
  }
  if (c.pedido_ferreteria) {
    return `Pedido — ${c.pedido_ferreteria_categoria_display || 'Ferretería'}`
  }
  if (c.pedido_gas) {
    return 'Pedido — Gas Licuado'
  }
  return c.orden_trabajo_manual || '-'
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

// Lista de tarjetas de cotizaciones ya generadas (Folio / Editar / Descargar
// PDF / Enviar correo / WhatsApp). Sirve tanto para las de Maestranza como
// para las de arriendo de máquinas — `filtroOrigen` decide cuáles mostrar.
function SeccionCotizaciones({ filtroEmpresa, filtroMes, filtroAnio, filtroOrigen, mensajeVacio, onEditar }) {
  const [cotizaciones, setCotizaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [enviandoId, setEnviandoId] = useState(null)

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
      trabajoLabel: calcularLabelOrigen(c),
      obra: c.obra,
      mandante: c.mandante,
      lugarTrabajo: c.lugar_trabajo,
      items: c.items,
      notas: c.notas,
      validezDias: c.validez_dias,
    })
  }

  function mensajeCotizacion(c) {
    const nombre = c.empresa_nombre || c.mandante || 'estimado(a)'
    const total = Number(c.total).toLocaleString('es-CL')
    return (
      `Hola ${nombre}, te compartimos la cotización folio ${c.folio}` +
      (c.obra ? ` para la obra "${c.obra}"` : '') +
      ` por un total de $${total} (IVA incluido). ` +
      `Descarga el PDF de la app "www.app.araratchile.com" `
    )
  }

  async function handleEnviarCorreo(c) {
    const emailDestino = c.empresa_email || c.cliente_email
    if (!emailDestino) {
      alert('Esta cotización no tiene un email de destino. Edítala o agrégalo en Usuarios/Empresas.')
      return
    }

    setEnviandoId(c.id)
    try {
      const pdfBase64 = await generarCotizacionPDFBase64({
        folio: c.folio,
        fechaFormateada: new Date(c.created_at).toLocaleDateString('es-CL'),
        trabajoLabel: calcularLabelOrigen(c),
        obra: c.obra,
        mandante: c.mandante,
        lugarTrabajo: c.lugar_trabajo,
        items: c.items,
        notas: c.notas,
        validezDias: c.validez_dias,
      })
      await enviarCorreoCotizacion(c.id, pdfBase64)
      alert(`Cotización enviada a ${emailDestino} y a facturacionapp@araratchile.com.`)
    } catch (err) {
      const msg = err?.response?.data?.error || 'No se pudo enviar el correo. Intenta de nuevo.'
      alert(msg)
    } finally {
      setEnviandoId(null)
    }
  }

  function handleCompartirWhatsapp(c) {
    const texto = mensajeCotizacion(c)
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank')
  }

  const filtradas = cotizaciones
    .filter(filtroOrigen)
    .filter((c) => pasaFiltro(c.created_at, c.empresa, filtroEmpresa, filtroAnio, filtroMes))

  if (cargando) return <p className="text-dark">Cargando...</p>

  if (filtradas.length === 0) {
    return <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">{mensajeVacio}</div>
  }

  return (
    <div className="flex flex-col gap-3">
      {filtradas.map((c) => (
        <div key={c.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-start flex-wrap gap-3">
          <div>
            <p className="text-xs font-bold text-primary uppercase">Folio {c.folio}</p>
            <p className="text-sm font-bold text-dark mt-0.5">{c.empresa_nombre || c.mandante || '-'}</p>
            {c.obra && <p className="text-xs text-gray-500 mt-0.5">{c.obra}</p>}
            <p className="text-xs text-gray-400 mt-0.5">{formatFechaHora(c.created_at)}</p>
          </div>
          <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
            <span className="text-primary font-medium text-sm">
              ${Number(c.total).toLocaleString('es-CL')}
            </span>
            <button
              onClick={() => onEditar(c)}
              className="bg-gray-600 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-700 w-full sm:w-48 text-center"
            >
              ✏️ Editar
            </button>
            <button
              onClick={() => handleDescargar(c)}
              className="bg-primary text-white px-3 py-1.5 rounded text-sm hover:bg-primary-light w-full sm:w-48 text-center"
            >
              Descargar PDF
            </button>
            <button
              onClick={() => handleEnviarCorreo(c)}
              disabled={enviandoId === c.id}
              className="bg-dark text-white px-3 py-1.5 rounded text-sm hover:bg-dark-soft w-full sm:w-48 text-center disabled:opacity-60"
            >
              {enviandoId === c.id ? 'Enviando...' : '✉️ Enviar correo'}
            </button>
            <button
              onClick={() => handleCompartirWhatsapp(c)}
              className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 w-full sm:w-48 text-center"
            >
              📲 Compartir WhatsApp
            </button>
          </div>
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
  // null = cerrado | 'nueva' = plantilla en blanco | objeto cotización = editando
  const [modalCotizacion, setModalCotizacion] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    getEmpresas().then((res) => setEmpresas(res.data))
  }, [])

  function handleCerrarModal() {
    setModalCotizacion(null)
    setRefreshKey((k) => k + 1) // fuerza re-fetch de la lista de cotizaciones
  }

  const TIPOS = [
    { id: 'maestranza', label: 'Maestranza' },
    { id: 'maquinas', label: 'Máquinas' },
    { id: 'ferreteria', label: 'Ferretería' },
    { id: 'gas', label: 'Gas' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
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

        {tipo === 'maestranza' && (
          <button
            onClick={() => setModalCotizacion('nueva')}
            className="bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:bg-primary-light"
          >
            + Nueva cotización
          </button>
        )}
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

      {tipo === 'maestranza' && (
        <SeccionCotizaciones
          key={`maestranza-${refreshKey}`}
          filtroEmpresa={filtroEmpresa}
          filtroMes={filtroMes}
          filtroAnio={filtroAnio}
          filtroOrigen={(c) => !!c.trabajo}
          mensajeVacio="No hay cotizaciones de Maestranza con este filtro."
          onEditar={(c) => setModalCotizacion(c)}
        />
      )}
      {tipo === 'maquinas' && (
        <SeccionCotizaciones
          key={`maquinas-${refreshKey}`}
          filtroEmpresa={filtroEmpresa}
          filtroMes={filtroMes}
          filtroAnio={filtroAnio}
          filtroOrigen={(c) => !!c.reserva_maquina}
          mensajeVacio="No hay cotizaciones de arriendo de máquinas con este filtro."
          onEditar={(c) => setModalCotizacion(c)}
        />
      )}
      {tipo === 'ferreteria' && (
        <SeccionCotizaciones
          key={`ferreteria-${refreshKey}`}
          filtroEmpresa={filtroEmpresa}
          filtroMes={filtroMes}
          filtroAnio={filtroAnio}
          filtroOrigen={(c) => !!c.pedido_ferreteria}
          mensajeVacio="No hay cotizaciones de Ferretería con este filtro."
          onEditar={(c) => setModalCotizacion(c)}
        />
      )}
      {tipo === 'gas' && (
        <SeccionCotizaciones
          key={`gas-${refreshKey}`}
          filtroEmpresa={filtroEmpresa}
          filtroMes={filtroMes}
          filtroAnio={filtroAnio}
          filtroOrigen={(c) => !!c.pedido_gas}
          mensajeVacio="No hay cotizaciones de Gas Licuado con este filtro."
          onEditar={(c) => setModalCotizacion(c)}
        />
      )}

      {modalCotizacion && (
        <CotizacionModal
          empresas={empresas}
          cotizacionExistente={modalCotizacion === 'nueva' ? null : modalCotizacion}
          onCerrar={handleCerrarModal}
        />
      )}
    </div>
  )
}