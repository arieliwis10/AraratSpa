import { useState } from 'react'
import { generarCotizacionPDF } from '../utils/generarCotizacionPDF'
import { crearCotizacion, actualizarCotizacion } from '../api/cotizaciones'

const ETIQUETA_TARIFA_COTIZACION = {
  dia: 'tarifa diaria',
  semana: 'tarifa semanal',
  mes: 'tarifa mensual',
}

function itemsDePedido(pedido) {
  return (pedido.items || []).map((it) => ({
    detalle: it.sku ? `${it.nombre} (SKU: ${it.sku})` : it.nombre,
    cantidad: String(it.cantidad || 1),
    precioUnitario: it.precio ? String(it.precio) : '',
  }))
}

export default function CotizacionModal({
  trabajo = null, reserva = null, pedido = null, pedidoTipo = null,
  cotizacionExistente = null, empresas = [], onCerrar,
}) {
  const esEdicion = !!cotizacionExistente
  // "vinculado a un origen" puede venir de cuatro lados: un trabajo real, una
  // reserva de máquina, un pedido de ferretería/gas, o (al editar) lo que ya
  // tenía asociado la cotización existente.
  const tieneTrabajoVinculado = esEdicion ? !!cotizacionExistente.trabajo : !!trabajo
  const tieneReservaVinculada = esEdicion ? !!cotizacionExistente.reserva_maquina : !!reserva
  const tienePedidoVinculado = esEdicion
    ? !!(cotizacionExistente.pedido_ferreteria || cotizacionExistente.pedido_gas)
    : !!pedido
  const esPlantilla = !tieneTrabajoVinculado && !tieneReservaVinculada && !tienePedidoVinculado

  const [modoCliente, setModoCliente] = useState(
    esEdicion && cotizacionExistente.cliente_email ? 'persona' : 'empresa'
  )
  const [empresaId, setEmpresaId] = useState(esEdicion ? (cotizacionExistente.empresa || '') : '')
  const [clienteEmail, setClienteEmail] = useState(esEdicion ? (cotizacionExistente.cliente_email || '') : '')
  const [ordenTrabajoManual, setOrdenTrabajoManual] = useState(
    esEdicion ? (cotizacionExistente.orden_trabajo_manual || '') : ''
  )

  const [obra, setObra] = useState(
    esEdicion
      ? (cotizacionExistente.obra || '')
      : (trabajo?.descripcion || reserva?.maquina_nombre || pedido?.centro_costo || '')
  )
  const [mandante, setMandante] = useState(
    esEdicion
      ? (cotizacionExistente.mandante || '')
      : (
          trabajo?.empresa_nombre || trabajo?.cliente_nombre ||
          reserva?.empresa_nombre || reserva?.cliente_nombre ||
          pedido?.empresa_nombre || pedido?.cliente_nombre || ''
        )
  )
  const [lugarTrabajo, setLugarTrabajo] = useState(esEdicion ? (cotizacionExistente.lugar_trabajo || '') : '')
  const [validezDias, setValidezDias] = useState(
    esEdicion ? String(cotizacionExistente.validez_dias) : '10'
  )
  const [items, setItems] = useState(
    esEdicion
      ? cotizacionExistente.items
      : trabajo
        ? (trabajo.materiales || []).map((m) => ({
            detalle: `${m.nombre} — ${m.cantidad}`,
            cantidad: '1',
            precioUnitario: '',
          }))
        : reserva
          ? [
              {
                detalle: `Arriendo ${reserva.maquina_nombre} — ${reserva.dias} día${reserva.dias === 1 ? '' : 's'} (${ETIQUETA_TARIFA_COTIZACION[reserva.tarifa_aplicada] || ''})`,
                cantidad: '1',
                precioUnitario: reserva.precio_neto ? String(reserva.precio_neto) : '',
              },
              ...(Number(reserva.precio_despacho) > 0
                ? [{ detalle: 'Despacho', cantidad: '1', precioUnitario: String(reserva.precio_despacho) }]
                : []),
            ]
          : pedido
            ? itemsDePedido(pedido)
            : []
  )
  const [notas, setNotas] = useState(esEdicion ? (cotizacionExistente.notas || '') : '')
  const [folioAsignado, setFolioAsignado] = useState(esEdicion ? cotizacionExistente.folio : null)
  const [guardando, setGuardando] = useState(false)

  const esPersonaSinEmpresa = esPlantilla && modoCliente === 'persona'
  const fechaFormateada = esEdicion
    ? new Date(cotizacionExistente.created_at).toLocaleDateString('es-CL')
    : new Date().toLocaleDateString('es-CL')

  function seleccionarEmpresa(id) {
    setEmpresaId(id)
    const empresa = empresas.find((e) => String(e.id) === String(id))
    if (empresa) setMandante(empresa.nombre)
  }

  function cambiarModoCliente(modo) {
    setModoCliente(modo)
    if (modo === 'empresa') {
      setClienteEmail('')
    } else {
      setEmpresaId('')
      setMandante('')
    }
  }

  function actualizarItem(index, campo, valor) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [campo]: valor } : it)))
  }

  function agregarItem() {
    setItems((prev) => [...prev, { detalle: '', cantidad: '1', precioUnitario: '' }])
  }

  function eliminarItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function totalItem(it) {
    const cant = parseFloat(it.cantidad) || 0
    const precio = parseFloat(it.precioUnitario) || 0
    return cant * precio
  }

  function calcularTotales() {
    const subtotal = items.reduce((acc, it) => acc + totalItem(it), 0)
    const iva = subtotal * 0.19
    const total = subtotal + iva
    return { subtotal, iva, total }
  }

  function formatoCLP(valor) {
    return `$${Math.round(valor).toLocaleString('es-CL')}`
  }

  function calcularTrabajoLabel() {
    if (tieneTrabajoVinculado) {
      return esEdicion
        ? `${cotizacionExistente.trabajo_categoria_display} #${cotizacionExistente.trabajo_correlativo}`
        : `#${trabajo.correlativo} ${trabajo.categoria_display}`
    }
    if (tieneReservaVinculada) {
      return esEdicion
        ? `Arriendo — ${cotizacionExistente.reserva_maquina_maquina_nombre || ''}`
        : `Arriendo — ${reserva.maquina_nombre}`
    }
    if (tienePedidoVinculado) {
      if (esEdicion) {
        return cotizacionExistente.pedido_ferreteria
          ? `Pedido — ${cotizacionExistente.pedido_ferreteria_categoria_display || 'Ferretería'}`
          : 'Pedido — Gas Licuado'
      }
      return pedidoTipo === 'ferreteria' ? `Pedido — ${pedido.categoria_display}` : 'Pedido — Gas Licuado'
    }
    return ordenTrabajoManual.trim() || '-'
  }

  async function generarPDF() {
    if (esPlantilla && modoCliente === 'empresa' && !empresaId) {
      alert('Selecciona la empresa para esta cotización.')
      return
    }
    if (esPersonaSinEmpresa && (!mandante.trim() || !clienteEmail.trim())) {
      alert('Ingresa el nombre y el email del cliente.')
      return
    }

    const { subtotal, iva, total } = calcularTotales()
    const trabajoLabel = calcularTrabajoLabel()

    const payload = {
      trabajo: esEdicion ? (cotizacionExistente.trabajo || null) : (trabajo?.id || null),
      reserva_maquina: esEdicion ? (cotizacionExistente.reserva_maquina || null) : (reserva?.id || null),
      pedido_ferreteria: esEdicion
        ? (cotizacionExistente.pedido_ferreteria || null)
        : (pedidoTipo === 'ferreteria' ? (pedido?.id || null) : null),
      pedido_gas: esEdicion
        ? (cotizacionExistente.pedido_gas || null)
        : (pedidoTipo === 'gas' ? (pedido?.id || null) : null),
      empresa: esPlantilla && modoCliente === 'empresa' ? empresaId : null,
      cliente_email: esPersonaSinEmpresa ? clienteEmail.trim() : null,
      orden_trabajo_manual: esPlantilla ? ordenTrabajoManual.trim() : '',
      obra,
      mandante,
      lugar_trabajo: lugarTrabajo,
      validez_dias: validezDias,
      items,
      notas,
      subtotal,
      iva,
      total,
    }

    setGuardando(true)
    try {
      let folio = folioAsignado
      if (esEdicion) {
        await actualizarCotizacion(cotizacionExistente.id, payload)
      } else {
        // El folio ya NO se genera en el navegador: lo asigna el backend
        // (así se evita el problema de folios repetidos entre pestañas
        // o máquinas distintas).
        const res = await crearCotizacion(payload)
        folio = res.data.folio
        setFolioAsignado(folio)
      }

      // Kairos Arriendos emite las cotizaciones de arriendo de maquinaria;
      // Ararat emite todo lo demás (Maestranza, Ferretería, Gas, sueltas).
      const marca = tieneReservaVinculada ? 'KAIROS' : 'ARARAT'

      generarCotizacionPDF({
        folio, fechaFormateada, trabajoLabel, obra, mandante, lugarTrabajo, items, notas, validezDias, marca,
      })
    } catch (err) {
      console.error('No se pudo guardar la cotización', err)
      alert('No se pudo guardar la cotización. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-lg font-bold text-dark">
            {esEdicion
              ? `Editar cotización — Folio ${cotizacionExistente.folio}`
              : trabajo
                ? `Cotización — ${trabajo.categoria_display} #${trabajo.correlativo}`
                : reserva
                  ? `Cotización — Arriendo ${reserva.maquina_nombre}`
                  : pedido
                    ? `Cotización — ${pedidoTipo === 'ferreteria' ? pedido.categoria_display : 'Gas Licuado'}`
                    : 'Nueva cotización'}
          </h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-dark text-xl leading-none">✕</button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {folioAsignado
            ? `N° Cotización: ${folioAsignado}`
            : 'El N° de cotización se asigna al generar el PDF'}
        </p>

        {esPlantilla && (
          <div className="mb-3">
            <div className="flex gap-1 bg-gray-100 rounded p-1 w-fit mb-3">
              <button
                type="button"
                onClick={() => cambiarModoCliente('empresa')}
                className={`px-3 py-1 rounded text-xs font-medium ${modoCliente === 'empresa' ? 'bg-white shadow text-dark' : 'text-gray-500'}`}
              >
                Empresa registrada
              </button>
              <button
                type="button"
                onClick={() => cambiarModoCliente('persona')}
                className={`px-3 py-1 rounded text-xs font-medium ${modoCliente === 'persona' ? 'bg-white shadow text-dark' : 'text-gray-500'}`}
              >
                Cliente sin empresa
              </button>
            </div>

            {modoCliente === 'empresa' ? (
              <div className="mb-3">
                <label className="block text-xs font-medium mb-1 text-dark">Empresa</label>
                <select
                  value={empresaId}
                  onChange={(e) => seleccionarEmpresa(e.target.value)}
                  className="w-full border rounded p-2 text-sm"
                >
                  <option value="">Selecciona una empresa</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium mb-1 text-dark">Nombre del cliente</label>
                  <input
                    value={mandante}
                    onChange={(e) => setMandante(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-dark">Email del cliente</label>
                  <input
                    type="email"
                    value={clienteEmail}
                    onChange={(e) => setClienteEmail(e.target.value)}
                    placeholder="cliente@correo.com"
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-1 text-dark">Orden de trabajo (opcional)</label>
              <input
                value={ordenTrabajoManual}
                onChange={(e) => setOrdenTrabajoManual(e.target.value)}
                placeholder='Ej: "Reparación bomba hidráulica" o un N° de orden externo'
                className="w-full border rounded p-2 text-sm"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium mb-1 text-dark">Obra</label>
            <input
              value={obra}
              onChange={(e) => setObra(e.target.value)}
              className="w-full border rounded p-2 text-sm"
            />
          </div>

          {!esPersonaSinEmpresa && (
            <div>
              <label className="block text-xs font-medium mb-1 text-dark">Mandante</label>
              <input
                value={mandante}
                onChange={(e) => setMandante(e.target.value)}
                className="w-full border rounded p-2 text-sm"
              />
            </div>
          )}

          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1 text-dark">Lugar de trabajo (opcional)</label>
            <input
              value={lugarTrabajo}
              onChange={(e) => setLugarTrabajo(e.target.value)}
              className="w-full border rounded p-2 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-3">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_50px_80px_28px] gap-2 items-center">
              <input
                value={it.detalle}
                onChange={(e) => actualizarItem(i, 'detalle', e.target.value)}
                placeholder="Detalle"
                className="border rounded p-1.5 text-sm"
              />
              <input
                value={it.cantidad}
                onChange={(e) => actualizarItem(i, 'cantidad', e.target.value)}
                placeholder="Cant."
                className="border rounded p-1.5 text-sm text-center"
              />
              <input
                type="number"
                value={it.precioUnitario}
                onChange={(e) => actualizarItem(i, 'precioUnitario', e.target.value)}
                placeholder="Precio"
                className="border rounded p-1.5 text-sm"
              />
              <button onClick={() => eliminarItem(i)} className="text-danger text-sm">✕</button>
            </div>
          ))}
        </div>

        <button type="button" onClick={agregarItem} className="text-xs text-primary hover:underline mb-4">
          + Agregar ítem
        </button>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium mb-1 text-dark">Válida por (días hábiles)</label>
            <input
              type="number"
              value={validezDias}
              onChange={(e) => setValidezDias(e.target.value)}
              className="w-full border rounded p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-dark">Nota (opcional)</label>
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full border rounded p-2 text-sm"
            />
          </div>
        </div>

        <div className="bg-gray-50 rounded p-2 text-sm mb-4 flex justify-between font-medium">
          <span className="text-dark">Total</span>
          <span className="text-primary">{formatoCLP(calcularTotales().total)}</span>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCerrar} className="bg-dark/10 text-dark px-4 py-2 rounded text-sm">
            Cerrar
          </button>
          <button
            onClick={generarPDF}
            disabled={guardando}
            className="bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:bg-primary-light disabled:opacity-60"
          >
            {guardando ? 'Guardando...' : esEdicion ? 'Guardar cambios y generar PDF' : 'Generar PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}