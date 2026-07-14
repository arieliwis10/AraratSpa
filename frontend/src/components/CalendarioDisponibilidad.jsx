import { useState } from 'react'

function generarDiasDelMes(anio, mes) {
  const primerDia = new Date(anio, mes, 1)
  const ultimoDia = new Date(anio, mes + 1, 0)
  const dias = []

  // Espacios vacíos antes del día 1 (para alinear con el día de la semana)
  const diaSemanaInicio = primerDia.getDay()
  for (let i = 0; i < diaSemanaInicio; i++) dias.push(null)

  for (let d = 1; d <= ultimoDia.getDate(); d++) {
    dias.push(new Date(anio, mes, d))
  }
  return dias
}

function formatoFecha(date) {
  return date.toISOString().split('T')[0]
}

export default function CalendarioDisponibilidad({ reservasOcupadas, fechaInicio, fechaFin, onSeleccionar }) {
  const hoy = new Date()
  const [mesActual, setMesActual] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1))

  const dias = generarDiasDelMes(mesActual.getFullYear(), mesActual.getMonth())
  const diasSemana = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

  function estaOcupado(fecha) {
    if (!fecha) return false
    const f = formatoFecha(fecha)
    return reservasOcupadas.some((r) => f >= r.fecha_inicio && f <= r.fecha_fin && r.estado !== 'RECHAZADA')
  }

  function estaSeleccionado(fecha) {
    if (!fecha || !fechaInicio) return false
    const f = formatoFecha(fecha)
    if (fechaFin) return f >= fechaInicio && f <= fechaFin
    return f === fechaInicio
  }

  function esPasado(fecha) {
    if (!fecha) return false
    const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
    return fecha < hoySinHora
  }

  function handleClick(fecha) {
    if (!fecha || estaOcupado(fecha) || esPasado(fecha)) return
    onSeleccionar(formatoFecha(fecha))
  }

  function cambiarMes(delta) {
    setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() + delta, 1))
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex justify-between items-center mb-3">
        <button type="button" onClick={() => cambiarMes(-1)} className="px-2 py-1 text-dark hover:bg-gray-100 rounded">
          ‹
        </button>
        <span className="font-medium text-dark">
          {mesActual.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
        </span>
        <button type="button" onClick={() => cambiarMes(1)} className="px-2 py-1 text-dark hover:bg-gray-100 rounded">
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
        {diasSemana.map((d, i) => <div key={i}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dias.map((fecha, i) => {
          if (!fecha) return <div key={i} />
          const ocupado = estaOcupado(fecha)
          const pasado = esPasado(fecha)
          const seleccionado = estaSeleccionado(fecha)
          return (
            <button
              type="button"
              key={i}
              disabled={ocupado || pasado}
              onClick={() => handleClick(fecha)}
              className={`aspect-square text-xs rounded flex items-center justify-center
                ${ocupado ? 'bg-danger/10 text-danger cursor-not-allowed line-through' : ''}
                ${pasado && !ocupado ? 'text-gray-300 cursor-not-allowed' : ''}
                ${seleccionado ? 'bg-primary text-white' : ''}
                ${!ocupado && !pasado && !seleccionado ? 'text-dark hover:bg-primary/10' : ''}
              `}
            >
              {fecha.getDate()}
            </button>
          )
        })}
      </div>

      <div className="flex gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-danger/10 rounded inline-block" /> Ocupado
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-primary rounded inline-block" /> Seleccionado
        </span>
      </div>
    </div>
  )
}