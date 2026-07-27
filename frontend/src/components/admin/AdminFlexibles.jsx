import { useState, useEffect } from 'react'
import {
  getProductosFlexibles, crearProductoFlexible, actualizarProductoFlexible,
  eliminarProductoFlexible, getStockBajoFlexibles, getTrabajos, guardarDetalleFlexible
} from '../../api/maestranza'
import { DIAMETROS_FLEXIBLE, CATEGORIAS_PRODUCTO_FLEXIBLE } from '../../constants/flexibles'

const FORM_VACIO = { categoria: 'MANGUERA', nombre: '', diametro: '1/2"', unidad_medida: 'METRO', precio: '', stock_actual: '', stock_minimo: '5' }

export default function AdminFlexibles() {
  const [tab, setTab] = useState('productos')

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="bg-white rounded-lg shadow px-3 py-1.5 inline-block mb-4">
        <h2 className="text-xl font-bold text-dark">Catálogo Flexibles Hidráulicos</h2>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('productos')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'productos' ? 'bg-primary text-white' : 'bg-white text-dark border'
          }`}
        >
          Productos
        </button>
        <button
          onClick={() => setTab('pedidos')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'pedidos' ? 'bg-primary text-white' : 'bg-white text-dark border'
          }`}
        >
          Pedidos
        </button>
      </div>

      {tab === 'productos' ? <ProductosFlexibles /> : <PedidosFlexibles />}
    </div>
  )
}

function ProductosFlexibles() {
  const [productos, setProductos] = useState([])
  const [stockBajoIds, setStockBajoIds] = useState([])
  const [form, setForm] = useState(FORM_VACIO)
  const [editandoId, setEditandoId] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    try {
      const [resProductos, resStockBajo] = await Promise.all([
        getProductosFlexibles(),
        getStockBajoFlexibles(),
      ])
      setProductos(resProductos.data)
      setStockBajoIds(resStockBajo.data.map((p) => p.id))
    } finally {
      setCargando(false)
    }
  }

  function categoriaInfo(categoriaValue) {
    return CATEGORIAS_PRODUCTO_FLEXIBLE.find((c) => c.value === categoriaValue)
  }

  function handleCategoriaChange(categoria) {
    const info = categoriaInfo(categoria)
    setForm({ ...form, categoria, unidad_medida: info?.unidad })
  }

  async function handleGuardar() {
    if (!form.nombre.trim()) {
      alert('Escribe el nombre del producto (ej: R1, JIC, Hembra Recto...)')
      return
    }
    if (!form.precio || form.stock_actual === '') {
      alert('Completa precio y stock')
      return
    }
    const info = categoriaInfo(form.categoria)
    const payload = { ...form, unidad_medida: info.unidad }
    try {
      if (editandoId) {
        await actualizarProductoFlexible(editandoId, payload)
      } else {
        await crearProductoFlexible(payload)
      }
      setForm(FORM_VACIO)
      setEditandoId(null)
      cargar()
    } catch (err) {
      alert('Error al guardar el producto')
    }
  }

  function handleEditar(producto) {
    setEditandoId(producto.id)
    setForm({
      categoria: producto.categoria,
      nombre: producto.nombre,
      diametro: producto.diametro,
      unidad_medida: producto.unidad_medida,
      precio: producto.precio,
      stock_actual: producto.stock_actual,
      stock_minimo: producto.stock_minimo,
    })
    setMostrarFormulario(true)
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar este producto del catálogo?')) return
    try {
      await eliminarProductoFlexible(id)
      cargar()
    } catch (err) {
      alert('Error al eliminar')
    }
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setForm(FORM_VACIO)
  }

  const productosFiltrados = filtroCategoria === 'TODAS'
    ? productos
    : productos.filter((p) => p.categoria === filtroCategoria)

  return (
    <>
      {stockBajoIds.length > 0 && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 mb-4">
          <p className="text-sm font-bold text-danger">
            ⚠️ {stockBajoIds.length} producto(s) con stock bajo — revisa antes de tomar nuevos trabajos.
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <button
          type="button"
          onClick={() => setMostrarFormulario(!mostrarFormulario)}
          className="w-full flex justify-between items-center text-left"
        >
          <h3 className="font-bold text-dark">
            {editandoId ? 'Editar producto' : '+ Nuevo producto'}
          </h3>
          <span className="text-gray-400 text-sm">{mostrarFormulario ? '▲' : '▼'}</span>
        </button>

        {mostrarFormulario && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-dark">Categoría</label>
                <select
                  value={form.categoria}
                  onChange={(e) => handleCategoriaChange(e.target.value)}
                  className="w-full border rounded p-2 text-sm"
                >
                  {CATEGORIAS_PRODUCTO_FLEXIBLE.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-dark">Nombre</label>
                <input
                  type="text"
                  placeholder="Ej: R1, JIC, Hembra Recto..."
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-dark">Diámetro</label>
                <select
                  value={form.diametro}
                  onChange={(e) => setForm({ ...form, diametro: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                >
                  {DIAMETROS_FLEXIBLE.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-dark">Precio</label>
                <input
                  type="number" value={form.precio}
                  onChange={(e) => setForm({ ...form, precio: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-dark">Stock actual</label>
                <input
                  type="number" value={form.stock_actual}
                  onChange={(e) => setForm({ ...form, stock_actual: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-dark">Stock mínimo</label>
                <input
                  type="number" value={form.stock_minimo}
                  onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleGuardar}
                className="bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:bg-primary-light"
              >
                {editandoId ? 'Guardar cambios' : '+ Agregar producto'}
              </button>
              {editandoId && (
                <button onClick={cancelarEdicion} className="bg-dark/10 text-dark px-4 py-2 rounded text-sm">
                  Cancelar
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setFiltroCategoria('TODAS')}
          className={`px-3 py-1.5 rounded text-xs font-medium ${filtroCategoria === 'TODAS' ? 'bg-dark text-white' : 'bg-white text-dark border'}`}
        >
          Todas
        </button>
        {CATEGORIAS_PRODUCTO_FLEXIBLE.map((c) => (
          <button
            key={c.value}
            onClick={() => setFiltroCategoria(c.value)}
            className={`px-3 py-1.5 rounded text-xs font-medium ${filtroCategoria === c.value ? 'bg-dark text-white' : 'bg-white text-dark border'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <p className="text-dark">Cargando...</p>
      ) : (
        <div className="flex flex-col gap-2">
          {productosFiltrados.map((p) => (
            <div
              key={p.id}
              className={`bg-white rounded-lg shadow p-3 flex justify-between items-center ${
                p.stock_bajo ? 'border-l-4 border-danger' : ''
              }`}
            >
              <div>
                <p className="text-sm font-bold text-dark">
                  <span className="text-xs text-gray-400 font-normal mr-1">{p.categoria_display}</span>
                  {p.nombre} {p.diametro}
                </p>
                <p className="text-xs text-gray-500">
                  ${Number(p.precio).toLocaleString('es-CL')} · Stock: {p.stock_actual} {p.unidad_medida === 'METRO' ? 'm' : 'un'}
                  {p.stock_bajo && <span className="text-danger font-bold"> · ⚠️ Stock bajo</span>}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEditar(p)} className="text-primary text-xs font-medium hover:underline">
                  Editar
                </button>
                <button onClick={() => handleEliminar(p.id)} className="text-danger text-xs font-medium hover:underline">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          {productosFiltrados.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">No hay productos en esta categoría todavía.</p>
          )}
        </div>
      )}
    </>
  )
}

function PedidosFlexibles() {
  const [trabajos, setTrabajos] = useState([])
  const [precios, setPrecios] = useState({})
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState(null)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    try {
      const res = await getTrabajos()
      const flexibles = res.data.filter((t) => t.categoria === 'FLEXIBLES' && t.detalle_flexible)
      setTrabajos(flexibles)
      const preciosIniciales = {}
      flexibles.forEach((t) => {
        preciosIniciales[t.id] = t.detalle_flexible.precio_total ?? t.detalle_flexible.precio_sugerido
      })
      setPrecios(preciosIniciales)
    } finally {
      setCargando(false)
    }
  }

  async function handleGuardarPrecio(trabajoId) {
    setGuardandoId(trabajoId)
    try {
      await guardarDetalleFlexible(trabajoId, { precio_total: precios[trabajoId] })
      cargar()
    } catch (err) {
      alert('Error al guardar el precio')
    } finally {
      setGuardandoId(null)
    }
  }

  if (cargando) return <p className="text-dark">Cargando...</p>

  if (trabajos.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        Todavía no hay trabajos de Flexibles con ficha técnica.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {trabajos.map((t) => {
        const d = t.detalle_flexible
        return (
          <div key={t.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-xs font-bold text-primary bg-primary/10 rounded px-1.5 py-0.5 inline-block mb-1">
                  #{t.correlativo}
                </p>
                <p className="text-sm font-bold text-dark">{t.cliente_nombre}</p>
                <p className="text-xs text-gray-500">{t.estado_display}</p>
              </div>
            </div>

            <div className="text-xs text-gray-600 grid grid-cols-2 gap-1 mb-3 bg-gray-50 rounded p-2">
              <span>Manguera: {d.manguera_info ? `${d.manguera_info.nombre} ${d.manguera_info.diametro}` : '—'}</span>
              <span>Largo: {d.largo_metros} m</span>
              {d.cantidad_ferulas === 2 ? (
                <>
                  <span>Terminal entrada: {d.terminal_entrada_info?.nombre || '—'}</span>
                  <span>Terminal salida: {d.terminal_salida_info?.nombre || '—'}</span>
                </>
              ) : (
                <span>
                  Terminal: {(d.terminal_entrada_info || d.terminal_salida_info)?.nombre || '—'}
                  {' '}({d.terminal_entrada_info ? 'entrada' : 'salida'})
                </span>
              )}
              <span>Férula: {d.ferula_info?.nombre || '—'} · Cantidad: {d.cantidad_ferulas}</span>
            </div>

            <div className="flex items-end gap-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-dark">
                  Precio total {d.precio_total == null && '(sugerido)'}
                </label>
                <input
                  type="number"
                  value={precios[t.id] ?? ''}
                  onChange={(e) => setPrecios({ ...precios, [t.id]: e.target.value })}
                  className="border rounded p-2 text-sm w-40"
                />
              </div>
              <p className="text-xs text-gray-400 mb-2">
                Sugerido: ${Number(d.precio_sugerido).toLocaleString('es-CL')}
              </p>
              <button
                onClick={() => handleGuardarPrecio(t.id)}
                disabled={guardandoId === t.id}
                className="bg-primary text-white px-3 py-2 rounded text-sm font-medium hover:bg-primary-light disabled:opacity-50"
              >
                {guardandoId === t.id ? 'Guardando...' : 'Guardar precio'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}