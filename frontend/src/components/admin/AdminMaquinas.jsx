import { useState, useEffect } from 'react'
import {
  getMaquinas, crearMaquina, actualizarMaquina, eliminarMaquina,
  getReservas, cambiarEstadoReserva, eliminarReserva,
  getProductosGas, crearProductoGas, actualizarProductoGas, eliminarProductoGas,
  getStockBajoGas, getPedidosGas, marcarPedidoGasRevisado,
  getCategoriasMaquinas, crearCategoriaMaquina, actualizarCategoriaMaquina, eliminarCategoriaMaquina,
} from '../../api/arriendo'
import { getUsuarios } from '../../api/usuarios'
import BadgeEstado from '../BadgeEstado'
import CotizacionModal from '../CotizacionModal'
import { parseDescripcionBullets } from '../../utils/parseDescripcionBullets'

const TIPOS_GAS = [
  { valor: 'KG5', etiqueta: 'Gas licuado 5kg' },
  { valor: 'KG11', etiqueta: 'Gas licuado 11kg' },
  { valor: 'KG15', etiqueta: 'Gas licuado 15kg' },
  { valor: 'KG45', etiqueta: 'Gas licuado 45kg' },
  { valor: 'GRUA', etiqueta: 'Gas grúa' },
]

function formatFecha(fechaISO) {
  if (!fechaISO) return '—'
  const [anio, mes, dia] = fechaISO.split('-')
  return `${dia}-${mes}-${anio}`
}

function formatSolicitado(createdAt) {
  if (!createdAt) return null
  const fecha = new Date(createdAt)
  const partes = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(fecha)
  const obtener = (tipo) => partes.find((p) => p.type === tipo)?.value
  return `${obtener('day')}-${obtener('month')}-${obtener('year')} ${obtener('hour')}:${obtener('minute')}`
}

function BadgeContador({ count }) {
  if (!count) return null
  return (
    <span className="absolute -top-1.5 -right-1.5 bg-danger text-white text-[10px] leading-none rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
      {count > 9 ? '9+' : count}
    </span>
  )
}

function CategoriasMaquinas({ onCategoriasChange }) {
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [nombre, setNombre] = useState('')
  const [imagen, setImagen] = useState(null)
  const [preview, setPreview] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    try {
      const res = await getCategoriasMaquinas()
      setCategorias(res.data)
      onCategoriasChange?.(res.data)
    } finally {
      setCargando(false)
    }
  }

  function abrirNueva() {
    setEditando(null)
    setNombre('')
    setImagen(null)
    setPreview(null)
    setMostrarForm(true)
  }

  function abrirEditar(cat) {
    setEditando(cat)
    setNombre(cat.nombre)
    setImagen(null)
    setPreview(cat.imagen || null)
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
    if (!nombre.trim()) {
      alert('Escribe el nombre de la categoría')
      return
    }
    const formData = new FormData()
    formData.append('nombre', nombre.trim())
    if (imagen) formData.append('imagen', imagen)
    if (!editando) formData.append('activa', true)

    setGuardando(true)
    try {
      if (editando) {
        await actualizarCategoriaMaquina(editando.id, formData)
      } else {
        await crearCategoriaMaquina(formData)
      }
      setMostrarForm(false)
      cargar()
    } catch (err) {
      alert('Error al guardar la categoría. Puede que ya exista una con ese nombre.')
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActiva(cat) {
    const formData = new FormData()
    formData.append('activa', !cat.activa)
    try {
      await actualizarCategoriaMaquina(cat.id, formData)
      cargar()
    } catch (err) {
      alert('Error al actualizar la categoría')
    }
  }

  async function handleEliminar(cat) {
    if (!confirm(`¿Eliminar la categoría "${cat.nombre}"? Las máquinas que la tengan asignada quedarán sin categoría.`)) return
    try {
      await eliminarCategoriaMaquina(cat.id)
      cargar()
    } catch (err) {
      alert('Error al eliminar la categoría')
    }
  }

  if (mostrarForm) {
    return (
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4 border-t-4 border-primary max-w-md">
        <h2 className="text-lg font-bold text-dark border-l-4 border-primary pl-3">
          {editando ? 'Editar categoría' : 'Nueva categoría'}
        </h2>
        <div>
          <label className="block text-sm font-medium mb-1 text-dark">Nombre</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Autocargables"
            className="w-full border rounded p-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-dark">Imagen representativa</label>
          <input type="file" accept="image/*" onChange={handleImagen} className="w-full border rounded p-2 bg-white" />
          {preview && <img src={preview} alt="preview" className="mt-2 w-32 h-24 object-cover rounded border" />}
          <p className="text-xs text-gray-400 mt-1">
            Se muestra en el botón de la categoría cuando el cliente elige qué tipo de máquina arrendar.
          </p>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={guardando} className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-light font-medium disabled:opacity-60">
            {guardando ? 'Guardando...' : 'Guardar'}
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
        <button onClick={abrirNueva} className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-light font-medium">
          + Nueva categoría
        </button>
      </div>
      {cargando ? (
        <p className="text-dark">Cargando...</p>
      ) : categorias.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Todavía no hay categorías. Creá la primera para poder asignarla a las máquinas.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {categorias.map((cat) => (
            <div key={cat.id} className="bg-white rounded-lg shadow overflow-hidden flex">
              <div className="w-24 h-24 shrink-0 bg-gray-100 flex items-center justify-center">
                {cat.imagen ? (
                  <img src={cat.imagen} alt={cat.nombre} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-300 text-[10px] text-center px-1">Sin imagen</span>
                )}
              </div>
              <div className="p-3 flex flex-col gap-1 flex-1">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-bold text-dark text-sm">{cat.nombre}</h3>
                  <button
                    onClick={() => toggleActiva(cat)}
                    className={`shrink-0 text-[10px] px-2 py-0.5 rounded font-medium ${
                      cat.activa ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {cat.activa ? 'Visible' : 'Oculta'}
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  {cat.activa ? 'Los clientes la ven en el catálogo' : 'Los clientes NO la ven — pero las máquinas siguen ahí'}
                </p>
                <div className="flex gap-3 mt-auto pt-2">
                  <button onClick={() => abrirEditar(cat)} className="text-primary text-xs font-medium hover:underline">Editar</button>
                  <button onClick={() => handleEliminar(cat)} className="text-danger text-xs font-medium hover:underline">Eliminar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProductosMaquinas() {
  const [maquinas, setMaquinas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({
    nombre: '', categoria_fk: '', descripcion: '', precio_hora: '', precio_dia: '', precio_semana: '', precio_mes: '', activo: true,
  })
  const [imagen, setImagen] = useState(null)
  const [preview, setPreview] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarMaquinas()
    getCategoriasMaquinas().then((res) => setCategorias(res.data))
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
    setForm({ nombre: '', categoria_fk: categorias[0]?.id || '', descripcion: '', precio_dia: '', precio_semana: '', precio_mes: '', activo: true })
    setImagen(null)
    setPreview(null)
    setMostrarForm(true)
  }

  function abrirEditar(m) {
    setEditando(m)
    setForm({
      nombre: m.nombre,
      categoria_fk: m.categoria_fk || '',
      descripcion: m.descripcion,
      precio_dia: m.precio_dia || '',
      precio_semana: m.precio_semana || '',
      precio_mes: m.precio_mes || '',
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
    if (form.categoria_fk) formData.append('categoria_fk', form.categoria_fk)
    formData.append('descripcion', form.descripcion)
    if (form.precio_dia) formData.append('precio_dia', form.precio_dia)
    if (form.precio_semana) formData.append('precio_semana', form.precio_semana)
    if (form.precio_mes) formData.append('precio_mes', form.precio_mes)
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
          <label className="block text-sm font-medium mb-1 text-dark">Categoría</label>
          <select
            value={form.categoria_fk}
            onChange={(e) => setForm({ ...form, categoria_fk: e.target.value })}
            className="w-full border rounded p-2"
          >
            <option value="">Sin categoría</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.nombre}</option>
            ))}
          </select>
          {categorias.length === 0 && (
            <p className="text-xs text-danger mt-1">
              No hay categorías creadas todavía — andá a la pestaña "Categorías" y creá al menos una.
            </p>
          )}
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
        <div className="grid grid-cols-3 gap-3">
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
          <div>
            <label className="block text-sm font-medium mb-1 text-dark">Precio / mes</label>
            <input
              type="number" step="0.01" value={form.precio_mes}
              onChange={(e) => setForm({ ...form, precio_mes: e.target.value })}
              className="w-full border rounded p-2" placeholder="Ej: 800000"
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

  const maquinasFiltradas = maquinas.filter((m) =>
    filtroCategoria === 'TODAS' ? true : m.categoria_fk === filtroCategoria
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFiltroCategoria('TODAS')}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              filtroCategoria === 'TODAS' ? 'bg-primary text-white' : 'bg-white text-dark border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Todas
          </button>
          {categorias.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFiltroCategoria(cat.id)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                filtroCategoria === cat.id ? 'bg-primary text-white' : 'bg-white text-dark border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {cat.nombre}
            </button>
          ))}
        </div>
        <button onClick={abrirNuevo} className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-light font-medium whitespace-nowrap">
          + Nueva máquina
        </button>
      </div>
      {cargando ? (
        <p className="text-dark">Cargando...</p>
      ) : maquinasFiltradas.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No hay máquinas en esta categoría todavía.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {maquinasFiltradas.map((m) => (
            <div key={m.id} className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
              <div className="w-full aspect-[4/3] bg-gray-100 flex items-center justify-center relative">
                {m.imagen ? (
                  <img src={m.imagen} alt={m.nombre} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-300 text-xs">Sin imagen</span>
                )}
                <span className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded font-medium ${m.activo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                  {m.activo ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <div className="p-3 flex flex-col gap-1 flex-1">
                <h3 className="font-bold text-dark text-sm leading-tight">{m.nombre}</h3>
                {m.categoria_nombre && (
                  <span className="inline-block w-fit text-[10px] font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5">
                    {m.categoria_nombre}
                  </span>
                )}
                {(() => {
                  const bullets = parseDescripcionBullets(m.descripcion)
                  if (bullets.length <= 1) {
                    return (
                      <p className="text-xs text-gray-500 line-clamp-2 min-h-[2rem]">
                        {m.descripcion || ''}
                      </p>
                    )
                  }
                  const visibles = bullets.slice(0, 2)
                  const hayMas = bullets.length > 2
                  return (
                    <ul className="text-xs text-gray-500 list-disc pl-4 min-h-[2rem]">
                      {visibles.map((punto, i) => (
                        <li key={i} className="truncate">
                          {punto}{hayMas && i === visibles.length - 1 ? '…' : ''}
                        </li>
                      ))}
                    </ul>
                  )
                })()}
                <div className="text-primary font-bold text-xs space-y-0.5 mt-auto pt-1">
                  {m.precio_dia && <p>${Number(m.precio_dia).toLocaleString('es-CL')} / día</p>}
                  {m.precio_semana && <p>${Number(m.precio_semana).toLocaleString('es-CL')} / semana</p>}
                  {m.precio_mes && <p>${Number(m.precio_mes).toLocaleString('es-CL')} / mes</p>}
                </div>
                <div className="flex gap-3 pt-2 mt-2 border-t">
                  <button onClick={() => abrirEditar(m)} className="text-primary text-xs font-medium hover:underline">Editar</button>
                  <button onClick={() => handleEliminar(m.id)} className="text-danger text-xs font-medium hover:underline">Eliminar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PedidosMaquinas({ onPendientesChange }) {
  const [reservas, setReservas] = useState([])
  const [clientes, setClientes] = useState([])
  const [filtroCliente, setFiltroCliente] = useState('')
  const [cargando, setCargando] = useState(true)
  const [cotizando, setCotizando] = useState(null)
  const [eliminando, setEliminando] = useState(null)

  useEffect(() => {
    getUsuarios().then((res) => setClientes(res.data.filter((u) => u.rol === 'CLIENTE')))
  }, [])

  useEffect(() => {
    cargarReservas()
  }, [filtroCliente])

  async function cargarReservas() {
    setCargando(true)
    try {
      const params = filtroCliente ? { cliente: filtroCliente } : {}
      const res = await getReservas(params)
      setReservas(res.data)
      // Solo actualizamos el badge global con el conteo SIN filtrar por cliente,
      // para que siga reflejando el total real de pendientes.
      if (onPendientesChange && !filtroCliente) {
        onPendientesChange(res.data.filter((r) => r.estado === 'PENDIENTE').length)
      }
    } finally {
      setCargando(false)
    }
  }

  async function handleCambiarEstado(id, estado) {
    try {
      await cambiarEstadoReserva(id, estado)
      cargarReservas()
    } catch (err) {
      alert('Error al actualizar la reserva')
    }
  }

  async function handleEliminarReserva(id) {
    if (!confirm('¿Eliminar esta reserva rechazada? Esta acción no se puede deshacer.')) return
    setEliminando(id)
    try {
      await eliminarReserva(id)
      cargarReservas()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar la reserva')
    } finally {
      setEliminando(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-lg shadow p-4 w-fit">
        <label className="block text-sm font-medium mb-1 text-dark">Filtrar por cliente</label>
        <select
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
          className="border rounded p-2 text-sm w-full sm:w-64"
        >
          <option value="">Todos los clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.username}</option>
          ))}
        </select>
      </div>

      {cargando ? (
        <p className="text-dark">Cargando...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reservas.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No hay reservas.</div>
          )}
          {reservas.map((r) => (
            <div key={r.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center flex-wrap gap-3">
              <div>
                <p className="font-bold text-dark">{r.maquina_nombre}</p>
                <p className="text-sm text-gray-600">Cliente: {r.cliente_nombre}</p>
                <p className="text-xs text-gray-500">{formatFecha(r.fecha_inicio)} a {formatFecha(r.fecha_fin)}</p>
                <p className="text-xs text-gray-500">
                  {r.modalidad_entrega === 'DESPACHO' ? `Entrega en obra: ${r.direccion_entrega}` : 'Retiro en local'}
                </p>
                {r.precio_total && (
                  <p className="text-xs text-primary font-medium mt-0.5">
                    Total: ${Number(r.precio_total).toLocaleString('es-CL')}
                  </p>
                )}
                {r.created_at && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Solicitado: {formatSolicitado(r.created_at)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <BadgeEstado estado={r.estado} />
                {r.estado === 'PENDIENTE' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleCambiarEstado(r.id, 'APROBADA')} className="bg-primary text-white px-3 py-1 rounded text-sm hover:bg-primary-light">
                      Aprobar
                    </button>
                    <button onClick={() => handleCambiarEstado(r.id, 'RECHAZADA')} className="bg-danger text-white px-3 py-1 rounded text-sm hover:bg-danger-light">
                      Rechazar
                    </button>
                  </div>
                )}
                {r.estado === 'APROBADA' && (
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => setCotizando(r)}
                      className="text-primary text-sm font-medium hover:underline whitespace-nowrap"
                    >
                      💰 Generar cotización
                    </button>
                    <button onClick={() => handleCambiarEstado(r.id, 'RECHAZADA')} className="bg-danger text-white px-3 py-1 rounded text-sm hover:bg-danger-light whitespace-nowrap">
                      Cancelar reserva
                    </button>
                  </div>
                )}
                {r.estado === 'RECHAZADA' && (
                  <button
                    onClick={() => handleEliminarReserva(r.id)}
                    disabled={eliminando === r.id}
                    className="bg-danger text-white px-3 py-1 rounded text-sm hover:bg-danger-light whitespace-nowrap disabled:opacity-50"
                  >
                    {eliminando === r.id ? 'Eliminando...' : '🗑 Eliminar'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {cotizando && (
        <CotizacionModal reserva={cotizando} onCerrar={() => setCotizando(null)} />
      )}
    </div>
  )
}

function VistaMaquinas({ pendientesCount, onPendientesChange }) {
  const [subTab, setSubTab] = useState('productos')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 bg-white rounded-lg shadow p-1 w-fit">
        <button
          onClick={() => setSubTab('productos')}
          className={`px-4 py-1.5 rounded text-sm font-medium ${subTab === 'productos' ? 'bg-primary text-white' : 'text-dark hover:bg-gray-50'}`}
        >
          Productos
        </button>
        <button
          onClick={() => setSubTab('categorias')}
          className={`px-4 py-1.5 rounded text-sm font-medium ${subTab === 'categorias' ? 'bg-primary text-white' : 'text-dark hover:bg-gray-50'}`}
        >
          Categorías
        </button>
        <button
          onClick={() => setSubTab('pedidos')}
          className={`relative px-4 py-1.5 rounded text-sm font-medium ${subTab === 'pedidos' ? 'bg-primary text-white' : 'text-dark hover:bg-gray-50'}`}
        >
          Pedidos
          <BadgeContador count={pendientesCount} />
        </button>
      </div>

      {subTab === 'productos' ? <ProductosMaquinas />
        : subTab === 'categorias' ? <CategoriasMaquinas />
        : <PedidosMaquinas onPendientesChange={onPendientesChange} />}
    </div>
  )
}

function SeccionProductosGas({ onStockBajoChange }) {
  const FORM_VACIO = { tipo: 'KG5', nombre: '', precio: '', stock_actual: '', stock_minimo: '5', activo: true }
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    try {
      const [resProductos, resStockBajo] = await Promise.all([getProductosGas(), getStockBajoGas()])
      setProductos(resProductos.data)
      onStockBajoChange(resStockBajo.data.length)
    } finally {
      setCargando(false)
    }
  }

  function abrirNuevo() {
    setEditando(null)
    setForm(FORM_VACIO)
    setMostrarForm(true)
  }

  function abrirEditar(p) {
    setEditando(p)
    setForm({
      tipo: p.tipo, nombre: p.nombre || '', precio: p.precio,
      stock_actual: p.stock_actual, stock_minimo: p.stock_minimo, activo: p.activo,
    })
    setMostrarForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.precio || form.stock_actual === '') {
      alert('Completa precio y stock')
      return
    }
    try {
      if (editando) {
        await actualizarProductoGas(editando.id, form)
      } else {
        await crearProductoGas(form)
      }
      setMostrarForm(false)
      cargar()
    } catch (err) {
      alert('Error al guardar el producto')
    }
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar este producto de gas?')) return
    await eliminarProductoGas(id)
    cargar()
  }

  if (mostrarForm) {
    return (
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4 border-t-4 border-primary">
        <h2 className="text-lg font-bold text-dark border-l-4 border-primary pl-3">
          {editando ? 'Editar producto de gas' : 'Nuevo producto de gas'}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1 text-dark">Tipo</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className="w-full border rounded p-2"
            >
              {TIPOS_GAS.map((t) => (
                <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-dark">Nombre / marca (opcional)</label>
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-dark">Precio</label>
            <input
              type="number" step="0.01" value={form.precio}
              onChange={(e) => setForm({ ...form, precio: e.target.value })}
              className="w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-dark">Stock actual</label>
            <input
              type="number" value={form.stock_actual}
              onChange={(e) => setForm({ ...form, stock_actual: e.target.value })}
              className="w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-dark">Stock mínimo</label>
            <input
              type="number" value={form.stock_minimo}
              onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })}
              className="w-full border rounded p-2"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-dark">
          <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
          Activo (visible para clientes)
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
          + Nuevo producto de gas
        </button>
      </div>
      {cargando ? (
        <p className="text-dark">Cargando...</p>
      ) : productos.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No hay productos de gas.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {productos.map((p) => (
            <div
              key={p.id}
              className={`bg-white rounded-lg shadow p-3 flex justify-between items-center ${p.stock_bajo ? 'border-l-4 border-danger' : ''}`}
            >
              <div>
                <p className="text-sm font-bold text-dark">
                  {p.tipo_display}{p.nombre && <span className="text-gray-400 font-normal"> — {p.nombre}</span>}
                </p>
                <p className="text-xs text-gray-500">
                  ${Number(p.precio).toLocaleString('es-CL')} · Stock: {p.stock_actual}
                  {p.stock_bajo && <span className="text-danger font-bold"> · ⚠️ Stock bajo</span>}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => abrirEditar(p)} className="text-primary text-xs font-medium hover:underline">Editar</button>
                <button onClick={() => handleEliminar(p.id)} className="text-danger text-xs font-medium hover:underline">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SeccionPedidosGas({ onPendientesChange }) {
  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(null)
  const [cotizando, setCotizando] = useState(null)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    try {
      const res = await getPedidosGas()
      setPedidos(res.data)
      if (onPendientesChange) {
        onPendientesChange(res.data.filter((p) => p.estado === 'PENDIENTE').length)
      }
    } finally {
      setCargando(false)
    }
  }

  async function handleMarcarRevisado(id) {
    setProcesando(id)
    try {
      await marcarPedidoGasRevisado(id)
      cargar()
    } catch (err) {
      alert('Error al actualizar el pedido')
    } finally {
      setProcesando(null)
    }
  }

  if (cargando) return <p className="text-dark">Cargando...</p>

  if (pedidos.length === 0) {
    return <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No hay pedidos de gas.</div>
  }

  return (
    <div className="flex flex-col gap-3">
      {pedidos.map((p) => (
        <div key={p.id} className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-sm font-bold text-dark">{p.empresa_nombre || p.cliente_nombre}</p>
              <p className="text-xs text-gray-500">
                Solicitado por {p.responsable_nombre || 'sin especificar'} · Centro de costo: {p.centro_costo}
              </p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${p.estado === 'REVISADO' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {p.estado_display}
            </span>
          </div>
          <ul className="text-sm text-gray-700 list-disc pl-4 mb-2">
            {p.items.map((item) => (
              <li key={item.id}>{item.nombre} — x{item.cantidad}</li>
            ))}
          </ul>
          <div className="flex gap-3 flex-wrap items-center">
            {p.estado === 'PENDIENTE' && (
              <button
                onClick={() => handleMarcarRevisado(p.id)}
                disabled={procesando === p.id}
                className="bg-primary text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-primary-light disabled:opacity-50"
              >
                {procesando === p.id ? 'Guardando...' : '✓ Marcar como revisado'}
              </button>
            )}
            {p.estado === 'REVISADO' && (
              <button
                onClick={() => setCotizando(p)}
                className="text-primary text-xs font-medium hover:underline"
              >
                💰 Generar cotización
              </button>
            )}
          </div>
        </div>
      ))}

      {cotizando && (
        <CotizacionModal pedido={cotizando} pedidoTipo="gas" onCerrar={() => setCotizando(null)} />
      )}
    </div>
  )
}

function VistaGas({ pendientesCount, onPendientesChange }) {
  const [subTab, setSubTab] = useState('productos')
  const [stockBajoCount, setStockBajoCount] = useState(0)

  return (
    <div className="flex flex-col gap-4">
      {stockBajoCount > 0 && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-3">
          <p className="text-sm font-bold text-danger">
            ⚠️ {stockBajoCount} producto(s) de gas con stock bajo — revisa antes de que se agote.
          </p>
        </div>
      )}
      <div className="flex gap-1 bg-white rounded-lg shadow p-1 w-fit">
        <button
          onClick={() => setSubTab('productos')}
          className={`px-4 py-1.5 rounded text-sm font-medium ${subTab === 'productos' ? 'bg-primary text-white' : 'text-dark hover:bg-gray-50'}`}
        >
          Productos
        </button>
        <button
          onClick={() => setSubTab('pedidos')}
          className={`relative px-4 py-1.5 rounded text-sm font-medium ${subTab === 'pedidos' ? 'bg-primary text-white' : 'text-dark hover:bg-gray-50'}`}
        >
          Pedidos
          <BadgeContador count={pendientesCount} />
        </button>
      </div>
      {subTab === 'productos' ? <SeccionProductosGas onStockBajoChange={setStockBajoCount} /> : <SeccionPedidosGas onPendientesChange={onPendientesChange} />}
    </div>
  )
}

export default function AdminMaquinas() {
  const [seccion, setSeccion] = useState('maquinas')
  const [reservasPendientes, setReservasPendientes] = useState(0)
  const [pedidosGasPendientes, setPedidosGasPendientes] = useState(0)

  // Conteo inicial al montar, independiente de qué sub-pestaña esté activa,
  // para que el badge aparezca desde el primer momento sin tener que navegar.
  useEffect(() => {
    getReservas().then((res) => {
      setReservasPendientes(res.data.filter((r) => r.estado === 'PENDIENTE').length)
    })
    getPedidosGas().then((res) => {
      setPedidosGasPendientes(res.data.filter((p) => p.estado === 'PENDIENTE').length)
    })
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 bg-white rounded-lg shadow p-1 w-fit">
        <button
          onClick={() => setSeccion('maquinas')}
          className={`relative px-4 py-1.5 rounded text-sm font-medium ${seccion === 'maquinas' ? 'bg-primary text-white' : 'text-dark hover:bg-gray-50'}`}
        >
          Máquinas
          <BadgeContador count={reservasPendientes} />
        </button>
        <button
          onClick={() => setSeccion('gas')}
          className={`relative px-4 py-1.5 rounded text-sm font-medium ${seccion === 'gas' ? 'bg-primary text-white' : 'text-dark hover:bg-gray-50'}`}
        >
          Gas
          <BadgeContador count={pedidosGasPendientes} />
        </button>
      </div>

      {seccion === 'maquinas' ? (
        <VistaMaquinas pendientesCount={reservasPendientes} onPendientesChange={setReservasPendientes} />
      ) : (
        <VistaGas pendientesCount={pedidosGasPendientes} onPendientesChange={setPedidosGasPendientes} />
      )}
    </div>
  )
}