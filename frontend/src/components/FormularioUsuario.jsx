import { useState, useEffect } from 'react'
import { getEmpresas, crearEmpresa, crearResponsable } from '../api/usuarios'

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
  // Por defecto, si es un registro nuevo, arrancamos en modo "crear empresa nueva".
  const [creandoEmpresa, setCreandoEmpresa] = useState(!usuarioInicial)
  const [nuevaEmpresa, setNuevaEmpresa] = useState({ nombre: '', rut: '' })
  const [responsables, setResponsables] = useState([{ nombre: '', telefono: '' }])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (usuarioInicial) {
      setForm({ ...usuarioInicial, password: '' })
    }
  }, [usuarioInicial])

  useEffect(() => {
    getEmpresas().then((res) => setEmpresas(res.data))
  }, [])

  // Si cambian el rol a Trabajador/Admin, la empresa no aplica.
  // Si vuelven a Cliente en un registro nuevo, retomamos el modo "empresa nueva".
  useEffect(() => {
    if (form.rol !== 'CLIENTE') {
      setCreandoEmpresa(false)
      setForm((f) => ({ ...f, empresa: '' }))
    } else if (!usuarioInicial) {
      setCreandoEmpresa(true)
    }
  }, [form.rol])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleNuevaEmpresaChange(e) {
    setNuevaEmpresa({ ...nuevaEmpresa, [e.target.name]: e.target.value })
  }

  function handleResponsableChange(idx, campo, valor) {
    setResponsables((prev) => prev.map((r, i) => (i === idx ? { ...r, [campo]: valor } : r)))
  }

  function agregarResponsable() {
    setResponsables((prev) => [...prev, { nombre: '', telefono: '' }])
  }

  function quitarResponsable(idx) {
    setResponsables((prev) => prev.filter((_, i) => i !== idx))
  }

  function usarEmpresaExistente() {
    setCreandoEmpresa(false)
    setNuevaEmpresa({ nombre: '', rut: '' })
  }

  function crearEmpresaNuevaEnSuLugar() {
    setCreandoEmpresa(true)
    setForm({ ...form, empresa: '' })
  }

  function tituloForm() {
    if (form.rol === 'CLIENTE') {
      return usuarioInicial && !creandoEmpresa ? 'Editar empresa' : 'Nueva empresa'
    }
    return usuarioInicial ? 'Editar usuario' : 'Nuevo usuario'
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    let datos = { ...form }
    if (usuarioInicial && !datos.password) {
      delete datos.password // no actualices la password si la dejaron vacía al editar
    }

    setGuardando(true)
    try {
      if (creandoEmpresa) {
        if (!nuevaEmpresa.nombre.trim()) {
          setError('Escribe el nombre de la empresa')
          setGuardando(false)
          return
        }
        const resEmpresa = await crearEmpresa(nuevaEmpresa)
        const empresaId = resEmpresa.data.id
        datos.empresa = empresaId

        // Crea de una vez los responsables que se hayan escrito
        const responsablesValidos = responsables.filter((r) => r.nombre.trim())
        for (const r of responsablesValidos) {
          await crearResponsable({ ...r, empresa: empresaId })
        }
      }
      await onGuardar(datos)
    } catch (err) {
      setError('Error al guardar. Revisa los datos e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4 border-t-4 border-primary">
      <h2 className="text-lg font-bold text-dark border-l-4 border-primary pl-3">
        {tituloForm()}
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

      {form.rol === 'CLIENTE' && (
        <div className="border border-primary/30 bg-primary/5 rounded p-4 flex flex-col gap-3">
          {creandoEmpresa ? (
            <>
              <p className="text-sm font-bold text-dark">Datos de la empresa</p>
              <input
                name="nombre"
                placeholder="Nombre de la empresa"
                value={nuevaEmpresa.nombre}
                onChange={handleNuevaEmpresaChange}
                className="w-full border rounded p-2 text-sm"
                required
              />
              <input
                name="rut"
                placeholder="RUT (opcional)"
                value={nuevaEmpresa.rut}
                onChange={handleNuevaEmpresaChange}
                className="w-full border rounded p-2 text-sm"
              />

              <div className="pt-2 border-t border-primary/20">
                <p className="text-sm font-bold text-dark mb-2">Responsables (contactos que encargan trabajos)</p>
                <div className="flex flex-col gap-2">
                  {responsables.map((r, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <input
                        placeholder="Nombre responsable"
                        value={r.nombre}
                        onChange={(e) => handleResponsableChange(idx, 'nombre', e.target.value)}
                        className="border rounded p-2 text-sm"
                      />
                      <input
                        placeholder="Teléfono (opcional)"
                        value={r.telefono}
                        onChange={(e) => handleResponsableChange(idx, 'telefono', e.target.value)}
                        className="border rounded p-2 text-sm"
                      />
                      {responsables.length > 1 && (
                        <button
                          type="button"
                          onClick={() => quitarResponsable(idx)}
                          className="text-danger text-xs hover:underline whitespace-nowrap"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={agregarResponsable}
                  className="text-xs text-primary font-medium hover:underline mt-2"
                >
                  + Agregar otro responsable
                </button>
              </div>

              {empresas.length > 0 && (
                <button
                  type="button"
                  onClick={usarEmpresaExistente}
                  className="text-xs text-gray-500 hover:underline w-fit pt-1"
                >
                  ¿Ya existe la empresa? Elegir de la lista
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-dark">Empresa</p>
              <select
                name="empresa"
                value={form.empresa || ''}
                onChange={handleChange}
                className="w-full border rounded p-2 text-sm"
              >
                <option value="">Sin empresa</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={crearEmpresaNuevaEnSuLugar}
                className="text-xs text-primary font-medium hover:underline w-fit"
              >
                + Crear una empresa nueva en su lugar
              </button>
            </>
          )}
        </div>
      )}

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

      {error && <p className="text-danger text-sm">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={guardando}
          className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-light font-medium disabled:opacity-60"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
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