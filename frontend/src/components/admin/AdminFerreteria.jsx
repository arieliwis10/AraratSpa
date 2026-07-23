import { useState, useEffect } from 'react'
import {
  getProductosFerreteria, crearProductoFerreteria,
  actualizarProductoFerreteria, eliminarProductoFerreteria,
  getPedidosFerreteria, marcarPedidoRevisado
} from '../../api/ferreteria'

const CATEGORIAS_FERRETERIA = [
  { valor: 'INSUMOS', etiqueta: 'Insumos ferretería' },
  { valor: 'REPUESTOS', etiqueta: 'Repuestos industriales' },
]

const FORM_VACIO = { nombre: '', sku: '', descripcion: '', categoria: 'INSUMOS', precio: '', activo: true }

function etiquetaCategoria(valor) {
  return CATEGORIAS_FERRETERIA.find((c) => c.valor === valor)?.etiqueta || valor
}

function SeccionProductos() {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [imagenFile, setImagenFile] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    try {
      const res = await getProductosFerreteria()
      setProductos(res.data)
    } finally {
      setCargando(false)
    }
  }

  function abrirNuevo() {
    setEditando(null)
    setForm(FORM_VACIO)
    setImagenFile(null)
    setError('')
    setMostrarForm(true)
  }

    function abrirEditar(p) {
    setEditando(p)
    setForm({
        nombre: p.nombre,
        sku: p.sku || '',
        descripcion: p.descripcion || '',
        categoria: p.categoria,
        precio: p.precio ?? '',
        activo: p.activo,
    })
    setImagenFile(null)
    setError('')
    setMostrarForm(true)
    }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim()) {
      setError('Escribe el nombre del producto')
      return
    }
    setError('')
    setGuardando(true)

    const datos = new FormData()
    datos.append('nombre', form.nombre)
    datos.append('sku', form.sku)
    datos.append('descripcion', form.descripcion)
    datos.append('categoria', form.categoria)
    if (form.precio !== '') {
    datos.append('precio', form.precio)
    }
    datos.append('activo', form.activo)
    if (imagenFile) {
    datos.append('imagen', imagenFile)
    }

    try {
      if (editando) {
        await actualizarProductoFerreteria(editando.id, datos)
      } else {
        await crearProductoFerreteria(datos)
      }
      setMostrarForm(false)
      cargar()
    } catch (err) {
      setError('Error al guardar el producto')
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar este producto? Ya no aparecerá en el catálogo del cliente.')) return
    try {
      await eliminarProductoFerreteria(id)
      cargar()
    } catch (err) {
      alert('Error al eliminar el producto')
    }
  }

  async function toggleActivo(p) {
    const datos = new FormData()
    datos.append('activo', !p.activo)
    try {
      await actualizarProductoFerreteria(p.id, datos)
      cargar()
    } catch (err) {
      alert('Error al actualizar el estado')
    }
  }

  const productosFiltrados = productos.filter((p) =>
    filtroCategoria === 'TODAS' ? true : p.categoria === filtroCategoria
  )

  if (mostrarForm) {
    return (
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4 border-t-4 border-primary max-w-lg">
        <h2 className="text-lg font-bold text-dark border-l-4 border-primary pl-3">
          {editando ? 'Editar producto' : 'Nuevo producto'}
        </h2>

        <div>
          <label className="block text-sm font-medium mb-1 text-dark">Nombre</label>
          <input
            name="nombre"
            value={form.nombre}
            onChange={handleChange}
            className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
        <div>
        <label className="block text-sm font-medium mb-1 text-dark">SKU (opcional)</label>
        <input
            name="sku"
            value={form.sku}
            onChange={handleChange}
            className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        </div>

        <div>
        <label className="block text-sm font-medium mb-1 text-dark">Precio (opcional, uso interno)</label>
        <input
            type="number"
            step="0.01"
            name="precio"
            value={form.precio}
            onChange={handleChange}
            className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-dark">Descripción (opcional)</label>
          <input
            name="descripcion"
            value={form.descripcion}
            onChange={handleChange}
            className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-dark">Categoría</label>
          <select
            name="categoria"
            value={form.categoria}
            onChange={handleChange}
            className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {CATEGORIAS_FERRETERIA.map((c) => (
              <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-dark">Imagen</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImagenFile(e.target.files[0])}
            className="w-full border rounded p-2 text-sm"
          />
          {editando?.imagen && !imagenFile && (
            <img src={editando.imagen} alt={editando.nombre} className="w-20 h-20 object-contain mt-2 border rounded" />
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-dark">
          <input
            type="checkbox"
            name="activo"
            checked={form.activo}
            onChange={handleChange}
          />
          Activo (visible para los clientes)
        </label>

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
            onClick={() => setMostrarForm(false)}
            className="bg-dark/10 text-dark px-4 py-2 rounded hover:bg-dark/20"
          >
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFiltroCategoria('TODAS')}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              filtroCategoria === 'TODAS' ? 'bg-primary text-white' : 'bg-white text-dark border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Todas
          </button>
          {CATEGORIAS_FERRETERIA.map((c) => (
            <button
              key={c.valor}
              onClick={() => setFiltroCategoria(c.valor)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                filtroCategoria === c.valor ? 'bg-primary text-white' : 'bg-white text-dark border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {c.etiqueta}
            </button>
          ))}
        </div>

        <button
          onClick={abrirNuevo}
          className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-light font-medium whitespace-nowrap"
        >
          + Nuevo producto
        </button>
      </div>

      {cargando ? (
        <p className="text-dark">Cargando...</p>
      ) : productosFiltrados.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No hay productos en esta categoría todavía.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {productosFiltrados.map((p) => (
            <div key={p.id} className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
              <div className="h-28 bg-gray-50 flex items-center justify-center">
                {p.imagen ? (
                  <img src={p.imagen} alt={p.nombre} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-gray-300 text-xs">Sin imagen</span>
                )}
              </div>
              <div className="p-3 flex flex-col gap-1 flex-1">
                <p className="text-xs text-primary font-medium">{etiquetaCategoria(p.categoria)}</p>
                <p className="text-sm font-bold text-dark">{p.nombre}</p>
                {p.descripcion && <p className="text-xs text-gray-500">{p.descripcion}</p>}
                <div className="mt-auto pt-2 flex justify-between items-center">
                  <button
                    onClick={() => toggleActivo(p)}
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      p.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => abrirEditar(p)} className="text-primary text-xs font-medium hover:underline">
                      Editar
                    </button>
                    <button onClick={() => handleEliminar(p.id)} className="text-danger text-xs font-medium hover:underline">
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SeccionPedidos() {
  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS')
  const [filtroEstado, setFiltroEstado] = useState('TODOS')
  const [expandido, setExpandido] = useState({})
  const [procesando, setProcesando] = useState(null)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    try {
      const res = await getPedidosFerreteria()
      setPedidos(res.data)
    } finally {
      setCargando(false)
    }
  }

  function toggleExpandido(id) {
    setExpandido((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleMarcarRevisado(id) {
    setProcesando(id)
    try {
      await marcarPedidoRevisado(id)
      cargar()
    } catch (err) {
      alert('Error al actualizar el pedido')
    } finally {
      setProcesando(null)
    }
  }

  const pedidosFiltrados = pedidos.filter((p) => {
    const pasaCategoria = filtroCategoria === 'TODAS' ? true : p.categoria === filtroCategoria
    const pasaEstado = filtroEstado === 'TODOS' ? true : p.estado === filtroEstado
    return pasaCategoria && pasaEstado
  })

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFiltroCategoria('TODAS')}
          className={`px-3 py-1.5 rounded text-sm font-medium ${
            filtroCategoria === 'TODAS' ? 'bg-primary text-white' : 'bg-white text-dark border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Todas
        </button>
        {CATEGORIAS_FERRETERIA.map((c) => (
          <button
            key={c.valor}
            onClick={() => setFiltroCategoria(c.valor)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              filtroCategoria === c.valor ? 'bg-primary text-white' : 'bg-white text-dark border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {c.etiqueta}
          </button>
        ))}

        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm text-dark bg-white"
        >
          <option value="TODOS">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="REVISADO">Revisado</option>
        </select>
      </div>

      {cargando ? (
        <p className="text-dark">Cargando...</p>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No hay pedidos que coincidan con este filtro.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pedidosFiltrados.map((p) => {
            const estaExpandido = Boolean(expandido[p.id])
            return (
              <div key={p.id} className="bg-white rounded-lg shadow p-4">
                <button
                  type="button"
                  onClick={() => toggleExpandido(p.id)}
                  className="w-full flex justify-between items-start text-left gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary uppercase">{p.categoria_display}</p>
                    <p className="text-sm font-bold text-dark mt-0.5">{p.empresa_nombre || p.cliente_nombre}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Solicitado por {p.responsable_nombre || 'sin especificar'} · {p.items.length} ítem{p.items.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      p.estado === 'REVISADO' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {p.estado_display}
                    </span>
                    <span className="text-xs text-gray-400">{estaExpandido ? '▲' : '▼'}</span>
                  </div>
                </button>

                {estaExpandido && (
                  <div className="mt-3 pt-3 border-t flex flex-col gap-3">
                    <div className="text-xs text-gray-500">
                      Centro de costo: {p.centro_costo} · {new Date(p.created_at).toLocaleString('es-CL')}
                    </div>
                    <div className="border rounded p-2 bg-gray-50">
                      <p className="text-xs font-bold text-dark mb-1">Ítems pedidos:</p>
                      <ul className="text-sm text-gray-700 list-disc pl-4">
                        {p.items.map((item) => (
                          <li key={item.id}>{item.nombre} — x{item.cantidad}</li>
                        ))}
                      </ul>
                    </div>
                    {p.estado === 'PENDIENTE' && (
                      <button
                        onClick={() => handleMarcarRevisado(p.id)}
                        disabled={procesando === p.id}
                        className="bg-primary text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-primary-light disabled:opacity-50 w-fit"
                      >
                        {procesando === p.id ? 'Guardando...' : '✓ Marcar como revisado'}
                      </button>
                    )}
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

export default function AdminFerreteria() {
  const [subTab, setSubTab] = useState('productos')

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex gap-1 bg-white rounded-lg shadow p-1 w-fit">
        <button
          onClick={() => setSubTab('productos')}
          className={`px-4 py-1.5 rounded text-sm font-medium ${
            subTab === 'productos' ? 'bg-primary text-white' : 'text-dark hover:bg-gray-50'
          }`}
        >
          Productos
        </button>
        <button
          onClick={() => setSubTab('pedidos')}
          className={`px-4 py-1.5 rounded text-sm font-medium ${
            subTab === 'pedidos' ? 'bg-primary text-white' : 'text-dark hover:bg-gray-50'
          }`}
        >
          Pedidos
        </button>
      </div>

      {subTab === 'productos' ? <SeccionProductos /> : <SeccionPedidos />}
    </div>
  )
}