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

export function nombreMes(mesISO) {
  const [yyyy, mm] = mesISO.split('-')
  return `${MESES[parseInt(mm, 10) - 1]} ${yyyy}`
}

export function anosDisponibles() {
  const actual = new Date().getFullYear()
  const inicio = actual - 3
  return Array.from({ length: actual - inicio + 1 }, (_, i) => actual - i)
}
