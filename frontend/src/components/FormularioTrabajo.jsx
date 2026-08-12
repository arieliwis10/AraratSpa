import { useState, useEffect } from 'react'
import { getResponsables } from '../api/usuarios'

export default function FormularioTrabajo({ categoria, categoriaLabel, onGuardar, onCancelar, empresaId, clienteId }) {
  const [descripcion, setDescripcion] = useState('')
  const [centroCosto, setCentroCosto] = useState('')
  const [responsable, setResponsable] = useState('')
  const [responsables, setResponsables] = useState([])
  const [fotos, setFotos] = useState([])
  const [previews, setPreviews] = useState([])
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    getResponsables(empresaId ? { empresa: empresaId } : {}).then((res) => setResponsables(res.data))
  }, [empresaId])

  function handleFoto(e) {
    const nuevos = Array.from(e.target.files || [])
    if (nuevos.length === 0) return
    setFotos((prev) => [...prev, ...nuevos])
    setPreviews((prev) => [...prev, ...nuevos.map((f) => URL.createObjectURL(f))])
    e.target.value = '' // permite volver a elegir el mismo archivo si lo saca y lo agrega de nuevo
  }

  function quitarFoto(index) {
    setFotos((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (responsables.length > 0 && !responsable) {
      alert('Selecciona quién de tu empresa encarga este trabajo')
      return
    }

    setEnviando(true)
    const formData = new FormData()
    formData.append('categoria', categoria)
    formData.append('descripcion', descripcion)
    formData.append('centro_costo', centroCosto)
    if (responsable) formData.append('responsable', responsable)
    if (clienteId) formData.append('cliente', clienteId)
    fotos.forEach((f) => formData.append('fotos', f))

    try {
      await onGuardar(formData)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4 border-t-4 border-primary">
      <h2 className="text-lg font-bold text-dark border-l-4 border-primary pl-3">
        Nuevo trabajo: {categoriaLabel}
      </h2>

      <div>
        <label className="block text-sm font-medium mb-1 text-dark">Descripción del trabajo</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={4}
          placeholder="Describe el trabajo que necesitas"
          className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-dark">Centro de costo</label>
        <input
          value={centroCosto}
          onChange={(e) => setCentroCosto(e.target.value)}
          placeholder="Ej: Obra Las Condes, Proyecto 123"
          className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>

      {responsables.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1 text-dark">¿Quién encarga este trabajo?</label>
          <select
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
            className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Selecciona un responsable</option>
            {responsables.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="fotos-nuevo-trabajo" className="block text-sm font-medium mb-1 text-dark cursor-pointer">Fotos (opcional)</label>
        <input
          id="fotos-nuevo-trabajo"
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handleFoto}
          className="w-full border rounded p-2 bg-white"
        />
        {previews.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {previews.map((src, i) => (
              <div key={i} className="relative">
                <img src={src} alt={`preview ${i + 1}`} className="w-20 h-20 object-cover rounded border" />
                <button
                  type="button"
                  onClick={() => quitarFoto(i)}
                  className="absolute -top-2 -right-2 bg-danger text-white rounded-full w-5 h-5 text-xs leading-none flex items-center justify-center"
                  aria-label="Quitar foto"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={enviando}
          className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-light font-medium disabled:opacity-50"
        >
          {enviando ? 'Enviando...' : 'Crear trabajo'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="bg-dark/10 text-dark px-4 py-2 rounded hover:bg-dark/20"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}