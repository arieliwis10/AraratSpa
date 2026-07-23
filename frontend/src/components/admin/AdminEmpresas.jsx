import { useState, useEffect } from 'react'
import {
  getEmpresas, crearEmpresa, actualizarEmpresa, eliminarEmpresa,
  crearResponsable, actualizarResponsable, eliminarResponsable, getUsuarios
} from '../../api/usuarios'

export default function AdminEmpresas() {
  const [empresas, setEmpresas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', rut: '' })
  const [empresaExpandida, setEmpresaExpandida] = useState(null)
  const [nuevoResponsable, setNuevoResponsable] = useState({ nombre: '', telefono: '', email: '' })
  const [responsableEditando, setResponsableEditando] = useState(null)
  const [formResponsable, setFormResponsable] = useState({ nombre: '', telefono: '', email: '' })
  const [guardandoResponsable, setGuardandoResponsable] = useState(null)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    try {
      const [resEmpresas, resUsuarios] = await Promise.all([getEmpresas(), getUsuarios()])
      setEmpresas(resEmpresas.data)
      setUsuarios(resUsuarios.data)
    } finally {
      setCargando(false)
    }
  }

  function abrirNuevo() {
    setEditando(null)
    setForm({ nombre: '', rut: '' })
    setMostrarForm(true)
  }

  function abrirEditar(e) {
    setEditando(e)
    setForm({ nombre: e.nombre, rut: e.rut })
    setMostrarForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (editando) {
        await actualizarEmpresa(editando.id, form)
      } else {
        await crearEmpresa(form)
      }
      setMostrarForm(false)
      cargar()
    } catch (err) {
      alert('Error al guardar la empresa')
    }
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar esta empresa? Esto no elimina a sus clientes, pero quedan sin empresa asignada.')) return
    await eliminarEmpresa(id)
    cargar()
  }

  async function handleAgregarResponsable(empresaId) {
    if (!nuevoResponsable.nombre) return
    try {
      await crearResponsable({ ...nuevoResponsable, empresa: empresaId })
      setNuevoResponsable({ nombre: '', telefono: '', email: '' })
      cargar()
    } catch (err) {
      alert('Error al agregar responsable')
    }
  }

  async function handleEliminarResponsable(id) {
    if (!confirm('¿Eliminar este responsable?')) return
    await eliminarResponsable(id)
    cargar()
  }

  function abrirEditarResponsable(r) {
    setResponsableEditando(r.id)
    setFormResponsable({
      nombre: r.nombre || '',
      telefono: r.telefono || '',
      email: r.email || '',
    })
  }

  function cerrarEditarResponsable() {
    setResponsableEditando(null)
    setFormResponsable({ nombre: '', telefono: '', email: '' })
  }

  function handleFormResponsableChange(campo, valor) {
    setFormResponsable((prev) => ({ ...prev, [campo]: valor }))
  }

  async function handleGuardarResponsable(id) {
    if (!formResponsable.nombre.trim()) {
      alert('El nombre no puede quedar vacío')
      return
    }
    setGuardandoResponsable(id)
    try {
      await actualizarResponsable(id, formResponsable)
      cerrarEditarResponsable()
      cargar()
    } catch (err) {
      alert('Error al guardar los datos del responsable')
    } finally {
      setGuardandoResponsable(null)
    }
  }

  function usuariosDeEmpresa(empresaId) {
    return usuarios.filter((u) => String(u.empresa) === String(empresaId))
  }

  if (mostrarForm) {
    return (
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4 border-t-4 border-primary">
        <h2 className="text-lg font-bold text-dark border-l-4 border-primary pl-3">
          {editando ? 'Editar empresa' : 'Nueva empresa'}
        </h2>
        <div>
          <label className="block text-sm font-medium mb-1 text-dark">Nombre</label>
          <input
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="w-full border rounded p-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-dark">RUT (opcional)</label>
          <input
            value={form.rut}
            onChange={(e) => setForm({ ...form, rut: e.target.value })}
            className="w-full border rounded p-2"
          />
        </div>
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
          + Nueva empresa
        </button>
      </div>

      {cargando ? (
        <p className="text-dark">Cargando...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {empresas.map((emp) => {
            const usuariosEmp = usuariosDeEmpresa(emp.id)
            return (
              <div key={emp.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-dark">{emp.nombre}</h3>
                    {emp.rut && <p className="text-xs text-gray-500">RUT: {emp.rut}</p>}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => abrirEditar(emp)} className="text-primary text-sm font-medium hover:underline">
                      Editar
                    </button>
                    <button onClick={() => handleEliminar(emp.id)} className="text-danger text-sm font-medium hover:underline">
                      Eliminar
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setEmpresaExpandida(empresaExpandida === emp.id ? null : emp.id)}
                  className="text-xs text-primary mt-2 hover:underline"
                >
                  {empresaExpandida === emp.id ? '▲ Ocultar' : '▼ Ver'} detalle
                  ({usuariosEmp.length} usuario{usuariosEmp.length !== 1 ? 's' : ''}, {emp.responsables.length} responsable{emp.responsables.length !== 1 ? 's' : ''})
                </button>

                {empresaExpandida === emp.id && (
                  <div className="mt-3 border-t pt-3 flex flex-col gap-4">
                    <div>
                      <p className="text-xs font-bold text-dark mb-2">Usuarios asignados a esta empresa</p>
                      {usuariosEmp.length === 0 ? (
                        <p className="text-xs text-gray-400">Ningún usuario tiene esta empresa asignada todavía.</p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {usuariosEmp.map((u) => (
                            <div key={u.id} className="flex justify-between items-center bg-primary/5 rounded p-2 text-sm">
                              <span className="text-dark">{u.username} {u.first_name && `(${u.first_name} ${u.last_name})`}</span>
                              <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">{u.rol}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-bold text-dark mb-2">Responsables (contactos que encargan trabajos)</p>
                      <div className="flex flex-col gap-2">
                        {emp.responsables.map((r) => {
                          const estaEditando = responsableEditando === r.id
                          return (
                            <div key={r.id} className="bg-gray-50 rounded p-2 text-sm">
                              {estaEditando ? (
  <div className="flex flex-col gap-2">
    <div className="grid grid-cols-2 gap-2">
      <input
        placeholder="Nombre"
        value={formResponsable.nombre}
        onChange={(e) => handleFormResponsableChange('nombre', e.target.value)}
        className="border rounded p-1.5 text-xs"
      />
      <input
        type="email"
        placeholder="Email (opcional)"
        value={formResponsable.email}
        onChange={(e) => handleFormResponsableChange('email', e.target.value)}
        className="border rounded p-1.5 text-xs"
      />
    </div>
    <div className="flex gap-2">
      <button
        onClick={() => handleGuardarResponsable(r.id)}
        disabled={guardandoResponsable === r.id}
        className="bg-primary text-white px-2.5 py-1 rounded text-xs font-medium hover:bg-primary-light disabled:opacity-50"
      >
        {guardandoResponsable === r.id ? 'Guardando...' : 'Guardar'}
      </button>
      <button
        onClick={cerrarEditarResponsable}
        className="text-dark/60 text-xs font-medium hover:underline"
      >
        Cancelar
      </button>
    </div>
  </div>
) : (
  <div className="flex justify-between items-center">
    <div>
      <p className="text-dark">{r.nombre}</p>
      <p className="text-xs text-gray-500">
        {r.email || 'Sin email registrado'}
      </p>
    </div>
    <div className="flex gap-3 shrink-0">
      <button
        onClick={() => abrirEditarResponsable(r)}
        className="text-primary text-xs font-medium hover:underline"
      >
        Editar
      </button>
      <button
        onClick={() => handleEliminarResponsable(r.id)}
        className="text-danger text-xs hover:underline"
      >
        Eliminar
      </button>
    </div>
  </div>
)}
                            </div>
                          )
                        })}
                        <div className="grid grid-cols-3 gap-2 mt-1">
                          <input
                            placeholder="Nombre responsable"
                            value={nuevoResponsable.nombre}
                            onChange={(e) => setNuevoResponsable({ ...nuevoResponsable, nombre: e.target.value })}
                            className="border rounded p-2 text-sm"
                          />
                          <input
                            placeholder="Teléfono (opcional)"
                            value={nuevoResponsable.telefono}
                            onChange={(e) => setNuevoResponsable({ ...nuevoResponsable, telefono: e.target.value })}
                            className="border rounded p-2 text-sm"
                          />
                          <input
                            type="email"
                            placeholder="Email (opcional)"
                            value={nuevoResponsable.email}
                            onChange={(e) => setNuevoResponsable({ ...nuevoResponsable, email: e.target.value })}
                            className="border rounded p-2 text-sm"
                          />
                        </div>
                        <button
                          onClick={() => handleAgregarResponsable(emp.id)}
                          className="bg-dark text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-dark-soft w-fit"
                        >
                          + Agregar responsable
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}