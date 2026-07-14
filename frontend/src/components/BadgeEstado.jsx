export default function BadgeEstado({ estado }) {
  const estilos = {
    PENDIENTE: 'bg-gray-200 text-dark',
    EN_PROGRESO: 'bg-primary/10 text-primary',
    TERMINADO: 'bg-green-100 text-green-700',
    APROBADA: 'bg-green-100 text-green-700',
    RECHAZADA: 'bg-danger/10 text-danger',
  }
  const etiquetas = {
    PENDIENTE: 'Pendiente',
    EN_PROGRESO: 'En progreso',
    TERMINADO: 'Terminado',
    APROBADA: 'Aprobada',
    RECHAZADA: 'Rechazada',
  }

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${estilos[estado]}`}>
      {etiquetas[estado] || estado}
    </span>
  )
}