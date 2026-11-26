// Miniaturas de las fotos de un trabajo (solo lectura). Al tocar una se
// abre ampliada con onVer(url). Se usa en las cotizaciones del admin y en
// las carpetas Terminados/Facturados del cliente.
export default function MiniaturasFotos({ fotos, onVer, className = '' }) {
  if (!fotos?.length) return null

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {fotos.map((f) => (
        <img
          key={f.id}
          src={f.imagen}
          alt="Foto del trabajo"
          onClick={() => onVer(f.imagen)}
          className="w-16 h-16 object-cover rounded border cursor-pointer"
        />
      ))}
    </div>
  )
}
