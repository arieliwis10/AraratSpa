import api from './axios'

export const getProductosFerreteria = (params = {}) => api.get('productos-ferreteria/', { params })

export const crearProductoFerreteria = (formData) =>
  api.post('productos-ferreteria/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const actualizarProductoFerreteria = (id, formData) =>
  api.patch(`productos-ferreteria/${id}/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const eliminarProductoFerreteria = (id) => api.delete(`productos-ferreteria/${id}/`)

export const getPedidosFerreteria = (params = {}) => api.get('pedidos-ferreteria/', { params })
export const solicitarFerreteria = (data) => api.post('pedidos-ferreteria/solicitar/', data)
export const marcarPedidoRevisado = (id) => api.patch(`pedidos-ferreteria/${id}/marcar_revisado/`)