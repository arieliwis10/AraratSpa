import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMaquinas, getReservas, crearReserva, cancelarReserva } from '../api/arriendo'
import CalendarioDisponibilidad from '../components/CalendarioDisponibilidad'
import BadgeEstado from '../components/BadgeEstado'

function preciosDeMaquina(m) {
  const precios = []
  if (m.precio_hora) precios.push(`$${Number(m.precio_hora).toLocaleString('es-CL')} / hora`)
  if (m.precio_dia) precios.push(`$${Number(m.precio_dia).toLocaleString('es-CL')} / día`)
  if (m.precio_semana) precios.push(`$${Number(m.precio_semana).toLocaleString('es-CL')} / semana`)
  return precios
}

export default function ClienteArriendo() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [maquinas, setMaquinas] = useState([])
  const [misReservas, setMisReservas] = useState([])
  const [maquinaActiva, setMaquinaActiva] = useState(null)
  const [reservasDeEstaMaquina, setReservasDeEstaMaquina] = useState([])
  const [fechaInicio, setFechaInicio] = useState(null)
  const [fechaFin, setFechaFin] = useState(null)
  const [modalidad, setModalidad] = useState('RETIRO')
  const [direccion, setDireccion] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

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
    if (modalidad === 'DELIVERY' && !direccion.trim()) {
      alert('Ingresa la dirección de entrega')
      return
    }
    setEnviando(true)
    try {
      await crearReserva({
        maquina: maquinaActiva.id,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin || fechaInicio,
        modalidad_entrega: modalidad,
        direccion_entrega: modalidad === 'DELIVERY' ? direccion : '',
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
    <div className="min-h-screen bg-gray-100 w-full">
      <header className="w-full bg-dark text-white px-4 md:px-8 py-4 flex justify-between items-center">
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

      <main className="w-full max-w-4xl mx-auto p-4 md:p-8">
        {cargando ? (
          <p className="text-dark">Cargando...</p>
        ) : maquinaActiva ? (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="bg-white rounded-lg shadow p-4 mb-4">
                {maquinaActiva.imagen && (
                  <img src={maquinaActiva.imagen} alt={maquinaActiva.nombre} className="w-full h-40 object-cover rounded mb-3" />
                )}
                <h2 className="font-bold text-dark text-lg">{maquinaActiva.nombre}</h2>
                <p className="text-sm text-gray-600 mt-1">{maquinaActiva.descripcion}</p>
                <div className="text-primary font-bold mt-2 space-y-0.5">
                  {preciosDeMaquina(maquinaActiva).map((p, i) => <p key={i}>{p}</p>)}
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
                  Desde: <span className="font-medium text-dark">{fechaInicio || '—'}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Hasta: <span className="font-medium text-dark">{fechaFin || fechaInicio || '—'}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-dark">¿Retira o entrega en obra?</label>
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
                    onClick={() => setModalidad('DELIVERY')}
                    className={`flex-1 px-3 py-2 rounded text-sm font-medium ${
                      modalidad === 'DELIVERY' ? 'bg-primary text-white' : 'bg-gray-100 text-dark'
                    }`}
                  >
                    Entrega en obra
                  </button>
                </div>
              </div>

              {modalidad === 'DELIVERY' && (
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
                disabled={!fechaInicio || enviando}
                className="w-full bg-primary text-white py-2 rounded hover:bg-primary-light font-medium disabled:opacity-50"
              >
                {enviando ? 'Enviando...' : 'Solicitar reserva'}
              </button>
              <p className="text-xs text-gray-400">
                Tu reserva quedará pendiente hasta que el admin la apruebe.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-dark font-medium mb-3">Máquinas disponibles</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {maquinas.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => abrirMaquina(m)}
                    className="bg-white rounded-lg shadow p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition"
                  >
                    {m.imagen && (
                      <img src={m.imagen} alt={m.nombre} className="w-full h-32 object-cover rounded mb-2" />
                    )}
                    <h3 className="font-bold text-dark">{m.nombre}</h3>
                    <p className="text-sm text-gray-500 mb-1">{m.descripcion}</p>
                    <div className="text-primary font-bold text-sm space-y-0.5">
                      {preciosDeMaquina(m).map((p, i) => <p key={i}>{p}</p>)}
                    </div>
                  </button>
                ))}
                {maquinas.length === 0 && (
                  <p className="text-gray-500 col-span-2">No hay máquinas disponibles todavía.</p>
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
                        <p className="text-xs text-gray-500">{r.fecha_inicio} a {r.fecha_fin}</p>
                        <p className="text-xs text-gray-500">
                          {r.modalidad_entrega === 'DELIVERY' ? `Entrega en obra: ${r.direccion_entrega}` : 'Retiro en local'}
                        </p>
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