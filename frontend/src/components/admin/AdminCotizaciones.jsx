import { useState, useEffect } from 'react'
import { getEmpresas } from '../../api/usuarios'
import { generarCotizacionPDF, generarCotizacionPDFBase64 } from '../../utils/generarCotizacionPDF'
import CotizacionModal from '../CotizacionModal'
import {
  getCotizaciones, eliminarCotizacion, enviarCorreoCotizacion,
  desbloquearCotizacion, bloquearCotizacion, registrarFacturaCotizacion, vincularTrabajoCotizacion,
} from '../../api/cotizaciones'
import { getTrabajos } from '../../api/maestranza'
import PapeleraCotizaciones from './PapeleraCotizaciones'
import MiniaturasFotos from '../MiniaturasFotos'
import VisorFoto from '../VisorFoto'

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
    return `#${c.trabajo_correlativo} ${c.trabajo_categoria_display}`
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

function esCotizacionSuelta(c) {
  return !c.trabajo && !c.reserva_maquina && !c.pedido_ferreteria && !c.pedido_gas
}

// Bloqueada = recién generada (verde): solo se edita/elimina tras desbloquear
// con la contraseña del admin. Facturada = tiene N° de factura (azul): cerrada
// para siempre.
function claseTarjeta(c) {
  if (c.numero_factura) return 'bg-blue-50 border-l-4 border-blue-600'
  if (c.bloqueada) return 'bg-green-50 border-l-4 border-green-600'
  return 'bg-white'
}

function mensajeError(err, porDefecto) {
  return err?.response?.data?.error || err?.response?.data?.detail || porDefecto
}

function EtiquetaCierre({ c }) {
  if (c.numero_factura) {
    return (
      <span className="inline-block text-xs font-medium text-blue-800 bg-blue-100 px-2 py-0.5 rounded mt-1">
        🧾 Factura N° {c.numero_factura} — cerrada
      </span>
    )
  }
  if (c.bloqueada) {
    return (
      <span className="inline-block text-xs font-medium text-green-800 bg-green-100 px-2 py-0.5 rounded mt-1">
        🔒 Bloqueada
      </span>
    )
  }
  return (
    <span className="inline-block text-xs font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded mt-1">
      🔓 Desbloqueada para editar
    </span>
  )
}

// Desbloquear con clave / volver a bloquear / registrar N° de factura.
function ControlesCierre({ c, onActualizada }) {
  const [pidiendoClave, setPidiendoClave] = useState(false)
  const [clave, setClave] = useState('')
  const [numeroFactura, setNumeroFactura] = useState('')
  const [procesando, setProcesando] = useState(false)

  async function ejecutar(accion, porDefecto) {
    setProcesando(true)
    try {
      const res = await accion()
      onActualizada(res.data)
      return true
    } catch (err) {
      alert(mensajeError(err, porDefecto))
      return false
    } finally {
      setProcesando(false)
    }
  }

  async function handleDesbloquear() {
    if (!clave) return
    const ok = await ejecutar(() => desbloquearCotizacion(c.id, clave), 'No se pudo desbloquear la cotización.')
    if (ok) {
      setClave('')
      setPidiendoClave(false)
    }
  }

  async function handleRegistrarFactura() {
    const numero = numeroFactura.trim()
    if (!numero) return
    if (!confirm(
      `¿Registrar la factura N° ${numero} para la cotización folio ${c.folio}?\n\n` +
      'Quedará cerrada y ya no se podrá editar, eliminar ni desbloquear.'
    )) return
    const ok = await ejecutar(
      () => registrarFacturaCotizacion(c.id, numero), 'No se pudo registrar la factura.'
    )
    if (ok) setNumeroFactura('')
  }

  if (c.numero_factura) {
    return (
      <p className="text-xs text-blue-900 mt-3 pt-3 border-t border-blue-200">
        Facturada el {formatFechaHora(c.fecha_factura)}. Ya no se puede editar.
      </p>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t flex flex-col gap-2">
      {c.bloqueada ? (
        pidiendoClave ? (
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="password"
              autoFocus
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDesbloquear()}
              placeholder="Tu contraseña de admin"
              className="flex-1 min-w-[10rem] border rounded p-1.5 text-sm bg-white"
            />
            <button
              type="button"
              onClick={handleDesbloquear}
              disabled={procesando || !clave}
              className="bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-green-800 disabled:opacity-60"
            >
              {procesando ? 'Verificando...' : 'Desbloquear'}
            </button>
            <button
              type="button"
              onClick={() => { setPidiendoClave(false); setClave('') }}
              className="text-xs text-gray-600 hover:underline"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPidiendoClave(true)}
            className="self-start text-xs font-medium text-green-800 hover:underline"
          >
            🔓 Desbloquear con clave para editar
          </button>
        )
      ) : (
        <button
          type="button"
          onClick={() => ejecutar(() => bloquearCotizacion(c.id), 'No se pudo bloquear la cotización.')}
          disabled={procesando}
          className="self-start text-xs font-medium text-green-800 hover:underline disabled:opacity-50"
        >
          🔒 Volver a bloquear
        </button>
      )}

      <div className="flex gap-2 items-center flex-wrap">
        <input
          value={numeroFactura}
          onChange={(e) => setNumeroFactura(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRegistrarFactura()}
          placeholder="N° de factura"
          maxLength={50}
          className="flex-1 min-w-[10rem] border rounded p-1.5 text-sm bg-white"
        />
        <button
          type="button"
          onClick={handleRegistrarFactura}
          disabled={procesando || !numeroFactura.trim()}
          className="bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-800 disabled:opacity-60"
        >
          🧾 Registrar factura
        </button>
      </div>
    </div>
  )
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

function esDeMaestranza(c) {
  return !c.reserva_maquina && !c.pedido_ferreteria && !c.pedido_gas
}

// Vincula una cotización de Maestranza sin trabajo a un trabajo. Funciona
// aunque esté bloqueada o facturada (no toca ítems ni montos): sirve para
// volver a asociar cotizaciones cuyo trabajo se borró.
function VincularTrabajo({ c, onActualizada }) {
  const [abierto, setAbierto] = useState(false)
  const [trabajos, setTrabajos] = useState(null)
  const [seleccion, setSeleccion] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function abrir() {
    setAbierto(true)
    if (trabajos) return
    try {
      // Con empresa: solo sus trabajos (el backend no deja vincular a otra empresa).
      const res = await getTrabajos(c.empresa ? { empresa: c.empresa } : {})
      setTrabajos(res.data)
    } catch {
      setTrabajos([])
    }
  }

  async function guardar() {
    setGuardando(true)
    try {
      const res = await vincularTrabajoCotizacion(c.id, Number(seleccion))
      onActualizada(res.data)
      setAbierto(false)
    } catch (err) {
      alert(mensajeError(err, 'No se pudo vincular la cotización.'))
    } finally {
      setGuardando(false)
    }
  }

  if (!abierto) {
    return (
      <button type="button" onClick={abrir} className="text-xs text-primary font-medium hover:underline mt-1">
        🔗 Vincular a trabajo
      </button>
    )
  }

  return (
    <div className="mt-2 bg-gray-50 rounded p-2 flex flex-col gap-2 max-w-md">
      {trabajos === null ? (
        <p className="text-xs text-gray-500">Cargando trabajos...</p>
      ) : (
        <select
          value={seleccion}
          onChange={(e) => setSeleccion(e.target.value)}
          className="border rounded p-1.5 text-sm bg-white w-full"
        >
          <option value="">Selecciona un trabajo</option>
          {trabajos.map((t) => (
            <option key={t.id} value={t.id}>
              #{t.correlativo} {t.categoria_display} — {t.empresa_nombre || t.cliente_nombre} — {(t.descripcion || '').slice(0, 40)}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || trabajos === null || !seleccion}
          className="bg-primary text-white px-3 py-1 rounded text-xs font-medium hover:bg-primary-light disabled:opacity-60"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="text-xs text-gray-500 hover:underline">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// Lista de tarjetas de cotizaciones ya generadas (Folio / Editar / Descargar
// PDF / Enviar correo / WhatsApp). Sirve tanto para las de Maestranza como
// para las de arriendo de máquinas — `filtroOrigen` decide cuáles mostrar.
function SeccionCotizaciones({ filtroEmpresa, filtroMes, filtroAnio, filtroOrigen, mensajeVacio, onEditar, onEliminada }) {
  const [cotizaciones, setCotizaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [enviandoId, setEnviandoId] = useState(null)
  const [eliminandoId, setEliminandoId] = useState(null)
  const [fotoAmpliada, setFotoAmpliada] = useState(null)

async function handleEliminar(c) {
  const confirmado = window.confirm(
    `¿Enviar la cotización folio ${c.folio} a la papelera? Podrás restaurarla desde ahí.`
  )
  if (!confirmado) return

  setEliminandoId(c.id)
  try {
    await eliminarCotizacion(c.id)
    setCotizaciones((prev) => prev.filter((item) => item.id !== c.id))
    onEliminada?.()
  } catch (err) {
    alert(mensajeError(err, 'No se pudo eliminar la cotización. Intenta de nuevo.'))
  } finally {
    setEliminandoId(null)
  }
}

  function reemplazarCotizacion(nueva) {
    setCotizaciones((prev) => prev.map((item) => (item.id === nueva.id ? nueva : item)))
  }

  useEffect(() => {
    getCotizaciones().then((res) => {
      setCotizaciones(res.data)
      setCargando(false)
    })
  }, [])

  // Kairos Arriendos emite las cotizaciones de arriendo de maquinaria;
  // Ararat emite todo lo demás.
  function calcularMarca(c) {
    return c.reserva_maquina ? 'KAIROS' : 'ARARAT'
  }

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
      marca: calcularMarca(c),
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
        marca: calcularMarca(c),
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
      {filtradas.map((c) => {
        const editable = !c.bloqueada && !c.numero_factura
        return (
          <div key={c.id} className={`rounded-lg shadow p-4 ${claseTarjeta(c)}`}>
            <div className="flex justify-between items-start flex-wrap gap-3">
              <div>
                <p className="text-xs font-bold text-primary uppercase">Folio {c.folio}</p>
                <p className="text-sm font-bold text-dark mt-0.5">{c.empresa_nombre || c.mandante || '-'}</p>
                {calcularLabelOrigen(c) !== '-' && (
                  <p className="text-xs font-medium text-dark mt-0.5">{calcularLabelOrigen(c)}</p>
                )}
                {c.obra && <p className="text-xs text-gray-500 mt-0.5">{c.obra}</p>}
                <p className="text-xs text-gray-400 mt-0.5">{formatFechaHora(c.created_at)}</p>
                <EtiquetaCierre c={c} />
                <MiniaturasFotos fotos={c.trabajo_fotos} onVer={setFotoAmpliada} className="mt-2" />
                {esDeMaestranza(c) && !c.trabajo && (
                  <div>
                    <VincularTrabajo c={c} onActualizada={reemplazarCotizacion} />
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                <span className="text-primary font-medium text-sm">
                  ${Number(c.total).toLocaleString('es-CL')}
                </span>
                {editable && (
                  <button
                    onClick={() => onEditar(c)}
                    className="bg-gray-600 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-700 w-full sm:w-48 text-center"
                  >
                    ✏️ Editar
                  </button>
                )}
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
                {editable && (
                  <button
                    onClick={() => handleEliminar(c)}
                    disabled={eliminandoId === c.id}
                    className="bg-danger text-white px-3 py-1.5 rounded text-sm hover:opacity-90 w-full sm:w-48 text-center disabled:opacity-60"
                  >
                    {eliminandoId === c.id ? 'Eliminando...' : '🗑️ Eliminar'}
                  </button>
                )}
              </div>
            </div>
            <ControlesCierre c={c} onActualizada={reemplazarCotizacion} />
          </div>
        )
      })}
      <VisorFoto src={fotoAmpliada} onClose={() => setFotoAmpliada(null)} />
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
  // Sube cada vez que una cotización va a la papelera, para que esta se recargue.
  const [versionPapelera, setVersionPapelera] = useState(0)

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

      <PapeleraCotizaciones
        version={versionPapelera}
        onRestaurada={() => setRefreshKey((k) => k + 1)}
      />

      {tipo === 'maestranza' && (
        <SeccionCotizaciones
          key={`maestranza-${refreshKey}`}
          filtroEmpresa={filtroEmpresa}
          filtroMes={filtroMes}
          filtroAnio={filtroAnio}
          filtroOrigen={(c) => !!c.trabajo || esCotizacionSuelta(c)} 
          mensajeVacio="No hay cotizaciones de Maestranza con este filtro."
          onEditar={(c) => setModalCotizacion(c)}
          onEliminada={() => setVersionPapelera((v) => v + 1)}
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
          onEliminada={() => setVersionPapelera((v) => v + 1)}
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
          onEliminada={() => setVersionPapelera((v) => v + 1)}
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
          onEliminada={() => setVersionPapelera((v) => v + 1)}
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