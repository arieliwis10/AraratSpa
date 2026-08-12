export default function VisorFoto({ src, onClose }) {
  if (!src) return null

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-3xl leading-none w-10 h-10 flex items-center justify-center"
        aria-label="Cerrar"
      >
        ×
      </button>
      <img
        src={src}
        alt="Foto ampliada"
        className="max-w-full max-h-full object-contain rounded"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}