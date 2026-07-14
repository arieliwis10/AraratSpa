import { useState } from 'react'

export default function FormularioTrabajo({ categoria, categoriaLabel, onGuardar, onCancelar }) {
  const [descripcion, setDescripcion] = useState('')
  const [centroCosto, setCentroCosto] = useState('')
  const [foto, setFoto] = useState(null)
  const [preview, setPreview] = useState(null)
  const [enviando, setEnviando] = useState(false)

  function handleFoto(e) {
    const file = e.target.files[0]
    if (file) {
      setFoto(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setEnviando(true)
    const formData = new FormData()
    formData.append('categoria', categoria)
    formData.append('descripcion', descripcion)
    formData.append('centro_costo', centroCosto)
    if (foto) formData.append('foto', foto)

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

      <div>
        <label className="block text-sm font-medium mb-1 text-dark">Foto (opcional)</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFoto}
          className="w-full border rounded p-2 bg-white"
        />
        {preview && (
          <img src={preview} alt="preview" className="mt-2 w-32 h-32 object-cover rounded border" />
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