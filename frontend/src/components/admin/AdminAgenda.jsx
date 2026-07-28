import { useState, useEffect } from 'react'
import { getTareas, crearTarea, actualizarTarea, eliminarTarea, marcarTareaCompletada } from '../../api/agenda'
import { getUsuarios } from '../../api/usuarios'
import { getTrabajos } from '../../api/maestranza'

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES_LABEL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const HORAS_AGENDA = Array.from({ length: 14 }, (_, i) => String(i + 7).padStart(2, '0') + ':00') // 07:00 a 20:00

function obtenerDiasCalendario(anio, mes) {
  const primerDia = new Date(anio, mes, 1)
  const ultimoDia = new Date(anio, mes + 1, 0)
  const diasEnMes = ultimoDia.getDate()
  const offset = (primerDia.getDay() + 6) % 7 // lunes=0

  const celdas = []
  for (let i = 0; i < offset; i++) celdas.push(null)
  for (let d = 1; d <= diasEnMes; d++) celdas.push(new Date(anio, mes, d))
  while (celdas.length % 7 !== 0) celdas.push(null)
  return celdas
}

function formatearFechaISO(fecha) {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function esMismoDia(a, b) {
  return a && b && formatearFechaISO(a) === formatearFechaISO(b)
}

const FORM_VACIO = { titulo: '', descripcion: '', hora: '', asignado_a: '', trabajo: '' }

function TareaItem({ tarea, onEditar, onEliminar, onToggle }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <input type="checkbox" checked={tarea.completada} onChange={() => onToggle(tarea.id)} className="mt-1" />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${tarea.completada ? 'line-through text-gray-400' : 'text-dark'}`}>
          {tarea.titulo}
        </p>
        {tarea.descripcion && <p className="text-xs text-gray-500">{tarea.descripcion}</p>}
        <div className="flex flex-wrap gap-x-2 text-[11px] text-gray-400 mt-0.5">
          {tarea.asignado_a_nombre && <span>👤 {tarea.asignado_a_nombre}</span>}
          {tarea.trabajo_correlativo && (
            <span>🔗 {tarea.trabajo_categoria_display} #{tarea.trabajo_correlativo}{tarea.trabajo_empresa_nombre ? ` (${tarea.trabajo_empresa_nombre})` : ''}</span>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={() => onEditar(tarea)} className="text-primary text-xs hover:underline">Editar</button>
        <button onClick={() => onEliminar(tarea.id)} className="text-danger text-xs hover:underline">✕</button>
      </div>
    </div>
  )
}

export default function AdminAgenda() {
  const [mesActual, setMesActual] = useState(() => {
    const hoy = new Date()
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  })
  const [tareas, setTareas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [diaSeleccionado, setDiaSeleccionado] = useState(new Date())
  const [trabajadores, setTrabajadores] = useState([])
  const [trabajos, setTrabajos] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getUsuarios().then((res) => setTrabajadores(res.data.filter((u) => u.rol === 'TRABAJADOR')))
    getTrabajos().then((res) => setTrabajos(res.data))
  }, [])

  useEffect(() => {
    cargarTareas()
  }, [mesActual])

  async function cargarTareas() {
    setCargando(true)
    try {
      const mesParam = `${mesActual.getFullYear()}-${String(mesActual.getMonth() + 1).padStart(2, '0')}`
      const res = await getTareas({ mes: mesParam })
      setTareas(res.data)
    } finally {
      setCargando(false)
    }
  }

  function irMesAnterior() {
    setMesActual((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  function irMesSiguiente() {
    setMesActual((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  function irHoy() {
    const hoy = new Date()
    setMesActual(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
    setDiaSeleccionado(hoy)
  }

  const celdas = obtenerDiasCalendario(mesActual.getFullYear(), mesActual.getMonth())

  const tareasPorDia = tareas.reduce((acc, t) => {
    acc[t.fecha] = acc[t.fecha] || []
    acc[t.fecha].push(t)
    return acc
  }, {})

  const tareasDelDiaSeleccionado = diaSeleccionado
    ? (tareasPorDia[formatearFechaISO(diaSeleccionado)] || [])
        .slice()
        .sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'))
    : []

  function abrirNuevaTarea(horaPrefijada) {
    setEditandoId(null)
    setForm({ ...FORM_VACIO, hora: horaPrefijada || '' })
    setMostrarForm(true)
  }

  function abrirEditarTarea(t) {
    setEditandoId(t.id)
    setForm({
      titulo: t.titulo,
      descripcion: t.descripcion || '',
      hora: t.hora ? t.hora.slice(0, 5) : '',
      asignado_a: t.asignado_a || '',
      trabajo: t.trabajo || '',
    })
    setMostrarForm(true)
  }

  async function handleGuardarTarea(e) {
    e.preventDefault()
    if (!form.titulo.trim()) return
    setGuardando(true)
    const payload = {
      titulo: form.titulo,
      descripcion: form.descripcion,
      fecha: formatearFechaISO(diaSeleccionado),
      hora: form.hora || null,
      asignado_a: form.asignado_a || null,
      trabajo: form.trabajo || null,
    }
    try {
      if (editandoId) {
        await actualizarTarea(editandoId, payload)
      } else {
        await crearTarea(payload)
      }
      setMostrarForm(false)
      cargarTareas()
    } catch (err) {
      alert('Error al guardar la tarea')
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar esta tarea?')) return
    try {
      await eliminarTarea(id)
      cargarTareas()
    } catch (err) {
      alert('Error al eliminar la tarea')
    }
  }

  async function handleToggleCompletada(id) {
    try {
      await marcarTareaCompletada(id)
      cargarTareas()
    } catch (err) {
      alert('Error al actualizar la tarea')
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <div className="bg-white rounded-lg shadow p-4 flex-1">
        <div className="flex justify-between items-center mb-3">
          <button onClick={irMesAnterior} className="text-dark hover:text-primary px-2 py-1 text-lg">‹</button>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-dark">
              {MESES_LABEL[mesActual.getMonth()]} {mesActual.getFullYear()}
            </h3>
            <button onClick={irHoy} className="text-xs text-primary hover:underline">Hoy</button>
          </div>
          <button onClick={irMesSiguiente} className="text-dark hover:text-primary px-2 py-1 text-lg">›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-1">
          {DIAS_SEMANA.map((d) => <div key={d}>{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {celdas.map((fecha, i) => {
            if (!fecha) return <div key={i} className="aspect-square" />
            const iso = formatearFechaISO(fecha)
            const tareasDia = tareasPorDia[iso] || []
            const esHoy = esMismoDia(fecha, new Date())
            const esSeleccionado = esMismoDia(fecha, diaSeleccionado)
            const pendientes = tareasDia.filter((t) => !t.completada).length

            return (
              <button
                key={i}
                onClick={() => setDiaSeleccionado(fecha)}
                className={`aspect-square rounded p-1 text-left flex flex-col items-start justify-between border ${
                  esSeleccionado ? 'border-primary bg-primary/5' : 'border-gray-100 hover:bg-gray-50'
                }`}
              >
                <span className={`text-xs ${esHoy ? 'bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center font-bold' : 'text-dark'}`}>
                  {fecha.getDate()}
                </span>
                {pendientes > 0 && (
                  <span className="text-[10px] bg-danger text-white rounded-full px-1.5 leading-none py-0.5 self-end">
                    {pendientes}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 w-full lg:w-96 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-dark text-sm capitalize">
            {diaSeleccionado
              ? diaSeleccionado.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
              : 'Elige un día'}
          </h3>
          <button
            onClick={() => abrirNuevaTarea('')}
            className="bg-primary text-white text-xs px-3 py-1.5 rounded font-medium hover:bg-primary-light"
          >
            + Tarea
          </button>
        </div>

        {cargando ? (
          <p className="text-sm text-gray-400">Cargando...</p>
        ) : (
          <div className="flex flex-col divide-y max-h-[520px] overflow-y-auto">
            {tareasDelDiaSeleccionado.filter((t) => !t.hora).map((t) => (
              <TareaItem key={t.id} tarea={t} onEditar={abrirEditarTarea} onEliminar={handleEliminar} onToggle={handleToggleCompletada} />
            ))}

            {HORAS_AGENDA.map((hora) => {
              const tareasHora = tareasDelDiaSeleccionado.filter((t) => t.hora && t.hora.slice(0, 5) === hora)
              return (
                <div key={hora} className="flex gap-2 py-1.5">
                  <span className="text-xs text-gray-400 w-10 shrink-0 pt-1">{hora}</span>
                  <div className="flex-1 flex flex-col">
                    {tareasHora.length === 0 ? (
                      <button
                        onClick={() => abrirNuevaTarea(hora)}
                        className="text-left text-xs text-gray-300 hover:text-primary py-1"
                      >
                        + agregar
                      </button>
                    ) : (
                      tareasHora.map((t) => (
                        <TareaItem key={t.id} tarea={t} onEditar={abrirEditarTarea} onEliminar={handleEliminar} onToggle={handleToggleCompletada} />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {mostrarForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleGuardarTarea} className="bg-white rounded-lg shadow-lg w-full max-w-md p-5 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-dark">{editandoId ? 'Editar tarea' : 'Nueva tarea'}</h3>
              <button type="button" onClick={() => setMostrarForm(false)} className="text-gray-400 hover:text-dark text-xl leading-none">✕</button>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-dark">Título</label>
              <input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                className="w-full border rounded p-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-dark">Descripción (opcional)</label>
              <textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                rows={2}
                className="w-full border rounded p-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-dark">Hora (opcional)</label>
                <input
                  type="time"
                  value={form.hora}
                  onChange={(e) => setForm({ ...form, hora: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-dark">Asignar a</label>
                <select
                  value={form.asignado_a}
                  onChange={(e) => setForm({ ...form, asignado_a: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                >
                  <option value="">Sin asignar</option>
                  {trabajadores.map((tr) => (
                    <option key={tr.id} value={tr.id}>{tr.username}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-dark">Vincular a un trabajo (opcional)</label>
              <select
                value={form.trabajo}
                onChange={(e) => setForm({ ...form, trabajo: e.target.value })}
                className="w-full border rounded p-2 text-sm"
              >
                <option value="">Sin vincular</option>
                {trabajos.map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.correlativo} {t.categoria_display} — {t.empresa_nombre || t.cliente_nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={guardando} className="bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:bg-primary-light disabled:opacity-60">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" onClick={() => setMostrarForm(false)} className="bg-dark/10 text-dark px-4 py-2 rounded text-sm">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}