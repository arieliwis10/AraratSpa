import { useState, useEffect } from 'react'
import { getProductosFerreteria, solicitarFerreteria } from '../api/ferreteria'

export default function CarritoFerreteria({ categoria, categoriaLabel, responsables, onEnviado, onCancelar }) {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [carrito, setCarrito] = useState({}) // { productoId: cantidad }
  const [centroCosto, setCentroCosto] = useState('')
  const [responsableId, setResponsableId] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setCargando(true)
    getProductosFerreteria({ categoria })
      .then((res) => setProductos(res.data))
      .finally(() => setCargando(false))
  }, [categoria])

  function cambiarCantidad(productoId, delta) {
    setCarrito((prev) => {
      const actual = prev[productoId] || 0
      const nueva = Math.max(0, actual + delta)
      const copia = { ...prev }
      if (nueva === 0) {
        delete copia[productoId]
      } else {
        copia[productoId] = nueva
      }
      return copia
    })
  }

  const itemsCarrito = Object.entries(carrito).map(([id, cantidad]) => {
    const producto = productos.find((p) => String(p.id) === id)
    return {
      producto_id: id,
      nombre: producto?.nombre || '',
      cantidad,
      precio: producto?.precio ? Number(producto.precio) : 0,
    }
  })

  const totalItems = itemsCarrito.reduce((acc, item) => acc + item.cantidad, 0)
  const totalCarrito = itemsCarrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0)

  async function handleEnviar() {
    setError('')
    if (itemsCarrito.length === 0) {
      setError('Agrega al menos un producto al carrito')
      return
    }
    if (!responsableId) {
      setError('Elige quién de tu empresa encarga este pedido')
      return
    }
    if (!centroCosto.trim()) {
      setError('Escribe el centro de costo')
      return
    }

    setEnviando(true)
    try {
      await solicitarFerreteria({
        categoria,
        responsable: responsableId,
        centro_costo: centroCosto,
        items: itemsCarrito.map(({ producto_id, nombre, cantidad }) => ({ producto_id, nombre, cantidad })),
      })
      onEnviado()
    } catch (err) {
      setError('Error al enviar la solicitud. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="inline-block bg-white rounded-lg shadow px-3 py-1.5 text-dark font-medium">
          {categoriaLabel}
        </h2>
        <button onClick={onCancelar} className="text-primary text-sm font-medium hover:underline">
          ← Volver a categorías
        </button>
      </div>

      {cargando ? (
        <p className="text-dark">Cargando catálogo...</p>
      ) : productos.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Todavía no hay productos cargados en esta categoría.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {productos.map((p) => {
            const cantidad = carrito[p.id] || 0
            return (
              <div key={p.id} className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
                <div className="h-24 bg-gray-50 flex items-center justify-center">
                  {p.imagen ? (
                    <img src={p.imagen} alt={p.nombre} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-gray-300 text-xs">Sin imagen</span>
                  )}
                </div>
                <div className="p-2 flex flex-col gap-1 flex-1">
                  <p className="text-sm font-bold text-dark leading-tight">{p.nombre}</p>
                  {p.descripcion && <p className="text-xs text-gray-500">{p.descripcion}</p>}
                  {p.precio && (
                    <p className="text-sm font-bold text-primary">
                      ${Number(p.precio).toLocaleString('es-CL')}
                    </p>
                  )}
                  <div className="mt-auto pt-2">
                    {cantidad === 0 ? (
                      <button
                        onClick={() => cambiarCantidad(p.id, 1)}
                        className="w-full bg-primary text-white text-xs font-medium py-1.5 rounded hover:bg-primary-light"
                      >
                        🛒 Agregar
                      </button>
                    ) : (
                      <div className="flex items-center justify-between bg-primary/10 rounded">
                        <button
                          onClick={() => cambiarCantidad(p.id, -1)}
                          className="px-2.5 py-1 text-primary font-bold"
                        >
                          −
                        </button>
                        <span className="text-sm font-bold text-dark">{cantidad}</span>
                        <button
                          onClick={() => cambiarCantidad(p.id, 1)}
                          className="px-2.5 py-1 text-primary font-bold"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalItems > 0 && (
        <div className="bg-white rounded-lg shadow p-4 flex flex-col gap-3 sticky bottom-4">
          <p className="text-sm font-bold text-dark">
            🛒 Tu carrito ({totalItems} {totalItems === 1 ? 'ítem' : 'ítems'})
          </p>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
            {itemsCarrito.map((item) => (
              <div key={item.producto_id} className="flex justify-between text-sm text-gray-700">
                <span>{item.nombre} x{item.cantidad}</span>
                {item.precio > 0 && (
                  <span className="font-medium">
                    ${Number(item.precio * item.cantidad).toLocaleString('es-CL')}
                  </span>
                )}
              </div>
            ))}
          </div>

          {totalCarrito > 0 && (
            <div className="flex justify-between text-sm font-bold text-dark border-t pt-2">
              <span>Total + IVA</span>
              <span>${totalCarrito.toLocaleString('es-CL')}</span>
            </div>
          )}

          <select
            value={responsableId}
            onChange={(e) => setResponsableId(e.target.value)}
            className="w-full border rounded p-2 text-sm"
          >
            <option value="">¿Quién de tu empresa encarga este pedido?</option>
            {responsables.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>

          <input
            value={centroCosto}
            onChange={(e) => setCentroCosto(e.target.value)}
            placeholder="Centro de costo"
            className="w-full border rounded p-2 text-sm"
          />

          {error && <p className="text-danger text-xs">{error}</p>}

          <button
            onClick={handleEnviar}
            disabled={enviando}
            className="w-full bg-primary text-white py-2 rounded text-sm font-medium hover:bg-primary-light disabled:opacity-50"
          >
            {enviando ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </div>
      )}
    </div>
  )
}