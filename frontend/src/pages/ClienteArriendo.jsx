import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMaquinas, getReservas, crearReserva, cancelarReserva, cotizarMaquina, marcarReservasVistas } from '../api/arriendo'
import { getResponsables } from '../api/usuarios'
import CalendarioDisponibilidad from '../components/CalendarioDisponibilidad'
import CarritoGas from '../components/CarritoGas'
import BadgeEstado from '../components/BadgeEstado'
import fondoPanel from '../assets/fondo-panel.jpg'


const ETIQUETA_TARIFA = {
  dia: 'Tarifa diaria',
  semana: 'Tarifa semanal (prorrateada por día)',
  mes: 'Tarifa mensual (prorrateada por día)',
}

function preciosDeMaquina(m) {
  const precios = []
  if (m.precio_hora) precios.push(`$${Number(m.precio_hora).toLocaleString('es-CL')} / hora`)
  if (m.precio_dia) precios.push(`$${Number(m.precio_dia).toLocaleString('es-CL')} / día`)
  if (m.precio_semana) precios.push(`$${Number(m.precio_semana).toLocaleString('es-CL')} / semana`)
  if (m.precio_mes) precios.push(`$${Number(m.precio_mes).toLocaleString('es-CL')} / mes`)
  return precios
}

function formatCLP(valor) {
  return `$${Number(valor).toLocaleString('es-CL')}`
}

function formatFechaCL(fechaStr) {
  if (!fechaStr) return '—'
  const [anio, mes, dia] = fechaStr.split('-')
  return `${dia}/${mes}/${anio}`
}

function AvisoDespacho() {
  return (
    <p className="text-xs text-gray-400 italic">
      * Los precios no incluyen despacho de maquinaria.
    </p>
  )
}

export default function ClienteArriendo() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [maquinas, setMaquinas] = useState([])
  const [misReservas, setMisReservas] = useState([])
  const [responsables, setResponsables] = useState([])
  const [modo, setModo] = useState('maquinas') // 'maquinas' | 'gas'
  const [maquinaActiva, setMaquinaActiva] = useState(null)
  const [reservasDeEstaMaquina, setReservasDeEstaMaquina] = useState([])
  const [fechaInicio, setFechaInicio] = useState(null)
  const [fechaFin, setFechaFin] = useState(null)
  const [modalidad, setModalidad] = useState('RETIRO')
  const [direccion, setDireccion] = useState('')
  const [responsableId, setResponsableId] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const [cotizacion, setCotizacion] = useState(null)
  const [errorCotizacion, setErrorCotizacion] = useState('')
  const [cargandoCotizacion, setCargandoCotizacion] = useState(false)

  useEffect(() => {
    cargarDatos()
    getResponsables().then((res) => setResponsables(res.data))
    marcarReservasVistas()
  }, [])

  useEffect(() => {
    if (!maquinaActiva || !fechaInicio) {
      setCotizacion(null)
      setErrorCotizacion('')
      return
    }

    let cancelado = false
    setCargandoCotizacion(true)
    setErrorCotizacion('')

    cotizarMaquina(maquinaActiva.id, fechaInicio, fechaFin || fechaInicio, modalidad)
      .then((res) => {
        if (!cancelado) setCotizacion(res.data)
      })
      .catch((err) => {
        if (!cancelado) {
          setCotizacion(null)
          setErrorCotizacion(
            err.response?.data?.error || 'No se pudo calcular el precio para estas fechas'
          )
        }
      })
      .finally(() => {
        if (!cancelado) setCargandoCotizacion(false)
      })

    return () => {
      cancelado = true
    }
  }, [maquinaActiva, fechaInicio, fechaFin, modalidad])

  async function cargarDatos() {
    setCargando(true)
    try {
      const [resMaquinas, resReservas] = await Promise.all([getMaquinas(), getReservas()])
      setMaquinas(resMaquinas.data.filter((m) => m.activo))
      setMisReservas(resReservas.data)
    } finally {
      setCargando(false)
    }
  }

  function abrirMaquina(maquina) {
    setMaquinaActiva(maquina)
    setFechaInicio(null)
    setFechaFin(null)
    setModalidad('RETIRO')
    setDireccion('')
    setResponsableId('')
    setCotizacion(null)
    setErrorCotizacion('')
    setReservasDeEstaMaquina(misReservas.filter((r) => r.maquina === maquina.id))
  }

  function handleSeleccionarFecha(fecha) {
    if (!fechaInicio || (fechaInicio && fechaFin)) {
      setFechaInicio(fecha)
      setFechaFin(null)
    } else if (fecha < fechaInicio) {
      setFechaInicio(fecha)
    } else {
      setFechaFin(fecha)
    }
  }

  async function handleReservar() {
    if (!responsableId) {
      alert('Selecciona quién de tu empresa encarga este arriendo')
      return
    }
    if (modalidad === 'DESPACHO' && !direccion.trim()) {
      alert('Ingresa la dirección de entrega')
      return
    }
    if (!cotizacion) {
      alert('No se pudo calcular el precio para estas fechas')
      return
    }
    setEnviando(true)
    try {
      await crearReserva({
        maquina: maquinaActiva.id,
        responsable: responsableId,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin || fechaInicio,
        modalidad_entrega: modalidad,
        direccion_entrega: modalidad === 'DESPACHO' ? direccion : '',
      })
      alert('Reserva enviada. Queda pendiente de aprobación del admin.')
      setMaquinaActiva(null)
      cargarDatos()
    } catch (err) {
      alert('Error al crear la reserva')
    } finally {
      setEnviando(false)
    }
  }

  async function handleCancelar(id) {
    if (!confirm('¿Cancelar esta reserva?')) return
    try {
      await cancelarReserva(id)
      cargarDatos()
    } catch (err) {
      alert('Error al cancelar la reserva')
    }
  }

  return (
    <div className="relative min-h-screen w-full">
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${fondoPanel})` }}
      />

      <header className="relative z-10 w-full bg-dark text-white px-4 md:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (maquinaActiva ? setMaquinaActiva(null) : navigate('/cliente'))}
            className="text-gray-300 hover:text-white"
          >
            ←
          </button>
          <h1 className="text-xl md:text-2xl font-bold">Arriendo Maquinaria</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300 hidden sm:inline">Hola, {usuario.username}</span>
          <button onClick={logout} className="bg-danger text-white px-3 py-1.5 rounded text-sm hover:bg-danger-light">
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="relative z-10 w-full max-w-4xl mx-auto p-4 md:p-8">
        {cargando ? (
          <p className="text-dark">Cargando...</p>
        ) : maquinaActiva ? (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
                {maquinaActiva.imagen ? (
                  <img src={maquinaActiva.imagen} alt={maquinaActiva.nombre} className="w-full h-48 object-cover" />
                ) : (
                  <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-300 text-sm">
                    Sin imagen
                  </div>
                )}
                <div className="p-4">
                  <h2 className="font-bold text-dark text-lg">{maquinaActiva.nombre}</h2>
                  <p className="text-sm text-gray-600 mt-1">{maquinaActiva.descripcion}</p>
                  <div className="text-primary font-bold mt-2 space-y-0.5">
                    {preciosDeMaquina(maquinaActiva).map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                  <div className="mt-2">
                    <AvisoDespacho />
                  </div>
                </div>
              </div>
              <CalendarioDisponibilidad
                reservasOcupadas={reservasDeEstaMaquina}
                fechaInicio={fechaInicio}
                fechaFin={fechaFin}
                onSeleccionar={handleSeleccionarFecha}
              />
            </div>

            <div className="bg-white rounded-lg shadow p-4 h-fit flex flex-col gap-4">
              <div>
                <h3 className="font-bold text-dark mb-3">Tu reserva</h3>
                <p className="text-sm text-gray-600 mb-1">
                  Desde: <span className="font-medium text-dark">{fechaInicio ? formatFechaCL(fechaInicio) : '—'}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Hasta: <span className="font-medium text-dark">{fechaFin || fechaInicio ? formatFechaCL(fechaFin || fechaInicio) : '—'}</span>
                </p>
              </div>

              {fechaInicio && (
                <div className="border rounded-lg p-3 bg-gray-50">
                  {cargandoCotizacion ? (
                    <p className="text-sm text-gray-500">Calculando precio...</p>
                  ) : errorCotizacion ? (
                    <p className="text-sm text-danger font-medium">{errorCotizacion}</p>
                  ) : cotizacion ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-gray-500">
                        {cotizacion.dias} día{cotizacion.dias === 1 ? '' : 's'} — {ETIQUETA_TARIFA[cotizacion.tarifa_aplicada]}
                      </p>
                      <div className="flex justify-between text-sm text-gray-700">
                        <span>Neto</span>
                        <span>{formatCLP(cotizacion.precio_neto)}</span>
                      </div>
                      {modalidad === 'DESPACHO' && Number(cotizacion.precio_despacho) > 0 && (
                        <div className="flex justify-between text-sm text-gray-700">
                          <span>Despacho</span>
                          <span>{formatCLP(cotizacion.precio_despacho)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold text-dark border-t pt-1 mt-1">
                        <span>Total IVA Incluido</span>
                        <span>{formatCLP(cotizacion.precio_total)}</span>
                      </div>
                      <div className="pt-1">
                        <AvisoDespacho />
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1 text-dark">¿Quién de tu empresa encarga este arriendo?</label>
                <select
                  value={responsableId}
                  onChange={(e) => setResponsableId(e.target.value)}
                  className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Selecciona un responsable</option>
                  {responsables.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-dark">¿Retira o Despacho?</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalidad('RETIRO')}
                    className={`flex-1 px-3 py-2 rounded text-sm font-medium ${
                      modalidad === 'RETIRO' ? 'bg-primary text-white' : 'bg-gray-100 text-dark'
                    }`}
                  >
                    Retiro en local
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalidad('DESPACHO')}
                    className={`flex-1 px-3 py-2 rounded text-sm font-medium ${
                      modalidad === 'DESPACHO' ? 'bg-primary text-white' : 'bg-gray-100 text-dark'
                    }`}
                  >
                    Despacho
                  </button>
                </div>
              </div>

              {modalidad === 'DESPACHO' && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-dark">Dirección de entrega</label>
                  <input
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Ej: Obra Las Condes, calle X #123"
                    className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              <button
                onClick={handleReservar}
                disabled={!fechaInicio || !cotizacion || !responsableId || cargandoCotizacion || enviando}
                className="w-full bg-primary text-white py-2 rounded hover:bg-primary-light font-medium disabled:opacity-50"
              >
                {enviando ? 'Enviando...' : 'Solicitar reserva'}
              </button>
              <p className="text-xs text-gray-400">
                Tu reserva quedará pendiente hasta que el admin la apruebe.
              </p>
            </div>
          </div>
        ) : modo === 'gas' ? (
          <div className="flex flex-col gap-4">
            <div className="flex gap-1 bg-white rounded-lg shadow p-1 w-fit">
              <button
                onClick={() => setModo('maquinas')}
                className="px-4 py-1.5 rounded text-sm font-medium text-dark hover:bg-gray-50"
              >
                Máquinas
              </button>
              <button className="px-4 py-1.5 rounded text-sm font-medium bg-primary text-white">
                Gas
              </button>
            </div>
            <CarritoGas
              responsables={responsables}
              onEnviado={() => {
                alert('Pedido de gas enviado. Queda pendiente de revisión.')
                setModo('maquinas')
              }}
              onCancelar={() => setModo('maquinas')}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex gap-1 bg-white rounded-lg shadow p-1 w-fit">
              <button className="px-4 py-1.5 rounded text-sm font-medium bg-primary text-white">
                Máquinas
              </button>
              <button
                onClick={() => setModo('gas')}
                className="px-4 py-1.5 rounded text-sm font-medium text-dark hover:bg-gray-50"
              >
                Gas
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-dark font-medium">Máquinas disponibles</h2>
              </div>
              <div className="mb-3">
                <AvisoDespacho />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {maquinas.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => abrirMaquina(m)}
                    className="bg-white rounded-lg shadow overflow-hidden text-left hover:shadow-md hover:-translate-y-0.5 transition flex flex-col"
                  >
                    <div className="w-full aspect-[4/3] bg-gray-100 flex items-center justify-center">
                      {m.imagen ? (
                        <img src={m.imagen} alt={m.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-300 text-xs">Sin imagen</span>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-1 flex-1">
                      <h3 className="font-bold text-dark text-sm leading-tight">{m.nombre}</h3>
                      {m.descripcion && (
                        <p className="text-xs text-gray-500 line-clamp-2">{m.descripcion}</p>
                      )}
                      <div className="text-primary font-bold text-xs space-y-0.5 mt-auto pt-1">
                        {preciosDeMaquina(m).map((p, i) => <p key={i}>{p}</p>)}
                      </div>
                    </div>
                  </button>
                ))}
                {maquinas.length === 0 && (
                  <p className="text-gray-500 col-span-full">No hay máquinas disponibles todavía.</p>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-dark font-medium mb-3">Tus reservas</h2>
              {misReservas.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                  Todavía no has hecho ninguna reserva.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {misReservas.map((r) => (
                    <div key={r.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center flex-wrap gap-2">
                      <div>
                        <p className="font-medium text-dark">{r.maquina_nombre}</p>
                        <p className="text-xs text-gray-500">{formatFechaCL(r.fecha_inicio)} a {formatFechaCL(r.fecha_fin)}</p>
                        <p className="text-xs text-gray-500">
                          {r.modalidad_entrega === 'DESPACHO' ? `Despacho: ${r.direccion_entrega}` : 'Retiro en local'}
                        </p>
                        {r.responsable_nombre && (
                          <p className="text-xs text-gray-500">Encargado: {r.responsable_nombre}</p>
                        )}
                        {r.precio_total && (
                          <p className="text-xs text-primary font-medium mt-0.5">
                            Total: {formatCLP(r.precio_total)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <BadgeEstado estado={r.estado} />
                        {r.estado === 'PENDIENTE' && (
                          <button onClick={() => handleCancelar(r.id)} className="text-danger text-xs font-medium hover:underline">
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}