import { useState, useEffect } from 'react'
import { getEmpresas } from '../api/usuarios'

export default function FormularioUsuario({ usuarioInicial, onGuardar, onCancelar }) {
  const [form, setForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    telefono: '',
    rol: 'CLIENTE',
    empresa: '',
    password: '',
  })
  const [empresas, setEmpresas] = useState([])

  useEffect(() => {
    if (usuarioInicial) {
      setForm({ ...usuarioInicial, password: '' })
    }
  }, [usuarioInicial])

  useEffect(() => {
    getEmpresas().then((res) => setEmpresas(res.data))
  }, [])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleSubmit(e) {
    e.preventDefault()
    const datos = { ...form }
    if (usuarioInicial && !datos.password) {
      delete datos.password // no actualices la password si la dejaron vacía al editar
    }
    onGuardar(datos)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4 border-t-4 border-primary">
      <h2 className="text-lg font-bold text-dark border-l-4 border-primary pl-3">
        {usuarioInicial ? 'Editar usuario' : 'Nuevo usuario'}
      </h2>

      <div>
        <label className="block text-sm font-medium mb-1 text-dark">Nombre de usuario</label>
        <input
          name="username"
          value={form.username}
          onChange={handleChange}
          className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-dark">Nombre</label>
          <input
            name="first_name"
            value={form.first_name}
            onChange={handleChange}
            className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-dark">Apellido</label>
          <input
            name="last_name"
            value={form.last_name}
            onChange={handleChange}
            className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-dark">Email</label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-dark">Teléfono</label>
        <input
          name="telefono"
          value={form.telefono}
          onChange={handleChange}
          className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-dark">Rol</label>
        <select
          name="rol"
          value={form.rol}
          onChange={handleChange}
          className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="CLIENTE">Cliente</option>
          <option value="TRABAJADOR">Trabajador</option>
          <option value="ADMIN">Administrador</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-dark">Empresa</label>
        <select
          name="empresa"
          value={form.empresa || ''}
          onChange={handleChange}
          className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Sin empresa</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-dark">
          {usuarioInicial ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
        </label>
        <input
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
          required={!usuarioInicial}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-light font-medium"
        >
          Guardar
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