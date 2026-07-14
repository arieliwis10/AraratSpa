import { useState, useEffect } from 'react'
import { getMaquinas, crearMaquina, actualizarMaquina, eliminarMaquina } from '../../api/arriendo'

export default function AdminMaquinas() {
  const [maquinas, setMaquinas] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({
    nombre: '', descripcion: '', precio_hora: '', precio_dia: '', precio_semana: '', activo: true,
  })
  const [imagen, setImagen] = useState(null)
  const [preview, setPreview] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarMaquinas()
  }, [])

  async function cargarMaquinas() {
    setCargando(true)
    try {
      const res = await getMaquinas()
      setMaquinas(res.data)
    } finally {
      setCargando(false)
    }
  }

  function abrirNuevo() {
    setEditando(null)
    setForm({ nombre: '', descripcion: '', precio_dia: '', precio_semana: '', activo: true })
    setImagen(null)
    setPreview(null)
    setMostrarForm(true)
  }

  function abrirEditar(m) {
    setEditando(m)
    setForm({
      nombre: m.nombre,
      descripcion: m.descripcion,
      precio_dia: m.precio_dia || '',
      precio_semana: m.precio_semana || '',
      activo: m.activo,
    })
    setImagen(null)
    setPreview(m.imagen || null)
    setMostrarForm(true)
  }

  function handleImagen(e) {
    const file = e.target.files[0]
    if (file) {
      setImagen(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const formData = new FormData()
    formData.append('nombre', form.nombre)
    formData.append('descripcion', form.descripcion)
    if (form.precio_dia) formData.append('precio_dia', form.precio_dia)
    if (form.precio_semana) formData.append('precio_semana', form.precio_semana)
    formData.append('activo', form.activo)
    if (imagen) formData.append('imagen', imagen)

    try {
      if (editando) {
        await actualizarMaquina(editando.id, formData)
      } else {
        await crearMaquina(formData)
      }
      setMostrarForm(false)
      cargarMaquinas()
    } catch (err) {
      alert('Error al guardar la máquina')
    }
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar esta máquina?')) return
    await eliminarMaquina(id)
    cargarMaquinas()
  }

  if (mostrarForm) {
    return (
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4 border-t-4 border-primary">
        <h2 className="text-lg font-bold text-dark border-l-4 border-primary pl-3">
          {editando ? 'Editar máquina' : 'Nueva máquina'}
        </h2>
        <div>
          <label className="block text-sm font-medium mb-1 text-dark">Nombre</label>
          <input
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Ej: Grúa Horquilla 3 ton"
            className="w-full border rounded p-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-dark">Descripción</label>
          <textarea
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            rows={3}
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-dark">Foto de la máquina</label>
          <input type="file" accept="image/*" onChange={handleImagen} className="w-full border rounded p-2 bg-white" />
          {preview && <img src={preview} alt="preview" className="mt-2 w-32 h-32 object-cover rounded border" />}
        </div>
        <div className="grid grid-cols-2 gap-3">
        <div>
            <label className="block text-sm font-medium mb-1 text-dark">Precio / día</label>
            <input
            type="number" step="0.01" value={form.precio_dia}
            onChange={(e) => setForm({ ...form, precio_dia: e.target.value })}
            className="w-full border rounded p-2" placeholder="Ej: 45000"
            />
        </div>
        <div>
            <label className="block text-sm font-medium mb-1 text-dark">Precio / semana</label>
            <input
            type="number" step="0.01" value={form.precio_semana}
            onChange={(e) => setForm({ ...form, precio_semana: e.target.value })}
            className="w-full border rounded p-2" placeholder="Ej: 250000"
            />
        </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-dark">
          <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
          Activa (visible para clientes)
        </label>
        <div className="flex gap-2 pt-2">
          <button type="submit" className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-light font-medium">
            Guardar
          </button>
          <button type="button" onClick={() => setMostrarForm(false)} className="bg-dark/10 text-dark px-4 py-2 rounded hover:bg-dark/20">
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button onClick={abrirNuevo} className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-light font-medium">
          + Nueva máquina
        </button>
      </div>
      {cargando ? (
        <p className="text-dark">Cargando...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {maquinas.map((m) => (
            <div key={m.id} className="bg-white rounded-lg shadow p-4">
              {m.imagen && <img src={m.imagen} alt={m.nombre} className="w-full h-32 object-cover rounded mb-2" />}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-dark">{m.nombre}</h3>
                  <p className="text-sm text-gray-500">{m.descripcion}</p>
                    <div className="text-primary text-sm font-medium mt-1 space-y-0.5">
                    {m.precio_dia && <p>${Number(m.precio_dia).toLocaleString('es-CL')} / día</p>}
                    {m.precio_semana && <p>${Number(m.precio_semana).toLocaleString('es-CL')} / semana</p>}
                    </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${m.activo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                  {m.activo ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <div className="flex gap-3 mt-3">
                <button onClick={() => abrirEditar(m)} className="text-primary text-sm font-medium hover:underline">Editar</button>
                <button onClick={() => handleEliminar(m.id)} className="text-danger text-sm font-medium hover:underline">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}