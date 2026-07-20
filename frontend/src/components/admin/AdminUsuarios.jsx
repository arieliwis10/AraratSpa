import { useState, useEffect } from 'react'
import { getUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario, getEmpresas } from '../../api/usuarios'
import FormularioUsuario from '../FormularioUsuario'
import AdminEmpresas from './AdminEmpresas'

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [mostrarEmpresas, setMostrarEmpresas] = useState(false)
  const [editando, setEditando] = useState(null)
  const [filtroRol, setFiltroRol] = useState('TODOS')
  const [filtroEmpresa, setFiltroEmpresa] = useState('TODAS')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarUsuarios()
    cargarEmpresas()
  }, [])

  async function cargarUsuarios() {
    setCargando(true)
    try {
      const res = await getUsuarios()
      setUsuarios(res.data)
    } catch (err) {
      setError('Error al cargar usuarios')
    } finally {
      setCargando(false)
    }
  }

  async function cargarEmpresas() {
    const res = await getEmpresas()
    setEmpresas(res.data)
  }

  async function handleGuardar(datos) {
    try {
      if (editando) {
        await actualizarUsuario(editando.id, datos)
      } else {
        await crearUsuario(datos)
      }
      setMostrarForm(false)
      setEditando(null)
      // Si se creó una empresa nueva desde el formulario, esto la trae al filtro.
      cargarUsuarios()
      cargarEmpresas()
    } catch (err) {
      alert('Error al guardar: revisa que el usuario no exista ya')
    }
  }

  async function handleEliminar(id) {
    if (!confirm('¿Seguro que quieres eliminar este usuario?')) return
    try {
      await eliminarUsuario(id)
      cargarUsuarios()
    } catch (err) {
      alert('Error al eliminar usuario')
    }
  }

  const usuariosFiltrados = usuarios.filter((u) => {
    const pasaRol = filtroRol === 'TODOS' ? true : u.rol === filtroRol
    const pasaEmpresa = filtroEmpresa === 'TODAS' ? true : String(u.empresa) === String(filtroEmpresa)
    return pasaRol && pasaEmpresa
  })

  if (mostrarEmpresas) {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => { setMostrarEmpresas(false); cargarEmpresas() }}
          className="text-primary text-sm font-medium hover:underline w-fit"
        >
          ← Volver a usuarios
        </button>
        <AdminEmpresas />
      </div>
    )
  }

  if (mostrarForm) {
    return (
      <FormularioUsuario
        usuarioInicial={editando}
        onGuardar={handleGuardar}
        onCancelar={() => {
          setMostrarForm(false)
          setEditando(null)
        }}
      />
    )
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex gap-2 flex-wrap items-center">
          {['TODOS', 'CLIENTE', 'TRABAJADOR', 'ADMIN'].map((r) => (
            <button
              key={r}
              onClick={() => setFiltroRol(r)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                filtroRol === r ? 'bg-primary text-white' : 'bg-white text-dark border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {r === 'TODOS' ? 'Todos' : r.charAt(0) + r.slice(1).toLowerCase()}
            </button>
          ))}

          <select
            value={filtroEmpresa}
            onChange={(e) => setFiltroEmpresa(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm text-dark bg-white"
          >
            <option value="TODAS">Todas las empresas</option>
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.nombre}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setMostrarEmpresas(true)}
            className="bg-dark text-white px-4 py-2 rounded hover:bg-dark-soft font-medium whitespace-nowrap"
          >
            Gestionar empresas
          </button>
          <button
            onClick={() => setMostrarForm(true)}
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-light font-medium whitespace-nowrap"
          >
            + Nueva empresa
          </button>
        </div>
      </div>

      {error && <p className="text-danger">{error}</p>}
      {cargando ? (
        <p className="text-dark">Cargando...</p>
      ) : (
        <div className="w-full bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-dark text-white text-left">
              <tr>
                <th className="p-3">Usuario</th>
                <th className="p-3">Nombre</th>
                <th className="p-3">Rol</th>
                <th className="p-3">Empresa</th>
                <th className="p-3">Teléfono</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map((u) => (
                <tr key={u.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="p-3 font-medium text-dark">{u.username}</td>
                  <td className="p-3 text-dark">{u.first_name} {u.last_name}</td>
                  <td className="p-3">
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                      {u.rol}
                    </span>
                  </td>
                  <td className="p-3 text-dark">{u.empresa_nombre || '—'}</td>
                  <td className="p-3 text-dark">{u.telefono}</td>
                  <td className="p-3 text-right space-x-3 whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditando(u)
                        setMostrarForm(true)
                      }}
                      className="text-primary font-medium hover:underline"
                    >
                      Editar
                    </button>
                    <button onClick={() => handleEliminar(u.id)} className="text-danger font-medium hover:underline">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {usuariosFiltrados.length === 0 && (
            <p className="p-6 text-gray-500 text-center">No hay usuarios en esta categoría</p>
          )}
        </div>
      )}
    </div>
  )
}