// Utilidades para filtrar listas por mes (carpetas de trabajos terminados).

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

// Mes actual en formato 'YYYY-MM'.
export function mesActualISO() {
  const fecha = new Date()
  const yyyy = fecha.getFullYear()
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

// Valor del selector de mes que significa "todos los meses del año elegido".
// El filtro queda como 'YYYY-todos'.
export const TODOS_LOS_MESES = 'todos'

export function nombreMes(mesISO) {
  const [yyyy, mm] = mesISO.split('-')
  if (mm === TODOS_LOS_MESES) return `todo ${yyyy}`
  return `${MESES[parseInt(mm, 10) - 1]} ${yyyy}`
}

// ¿La fecha (ISO) cae dentro del filtro? Con "todos los meses" basta el año.
export function coincideMes(fechaISO, filtro) {
  if (!fechaISO) return false
  const [yyyy, mm] = filtro.split('-')
  if (mm === TODOS_LOS_MESES) return fechaISO.slice(0, 4) === yyyy
  return fechaISO.slice(0, 7) === filtro
}

export function anosDisponibles() {
  const actual = new Date().getFullYear()
  const inicio = actual - 3
  return Array.from({ length: actual - inicio + 1 }, (_, i) => actual - i)
}
