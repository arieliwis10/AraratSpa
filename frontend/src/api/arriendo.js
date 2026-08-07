import api from './axios'

export const getMaquinas = () => api.get('maquinas/')
export const crearMaquina = (formData) =>
  api.post('maquinas/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const actualizarMaquina = (id, formData) =>
  api.patch(`maquinas/${id}/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const eliminarMaquina = (id) => api.delete(`maquinas/${id}/`)
export const getReservas = (params = {}) => api.get('reservas-maquinas/', { params })
export const crearReserva = (data) => api.post('reservas-maquinas/', data)
export const cambiarEstadoReserva = (id, estado) =>
  api.patch(`reservas-maquinas/${id}/cambiar_estado/`, { estado })
export const cancelarReserva = (id) => api.delete(`reservas-maquinas/${id}/`)
export const cotizarMaquina = (id, fecha_inicio, fecha_fin, modalidad = 'RETIRO') =>
  api.get(`/maquinas/${id}/cotizar/`, { params: { fecha_inicio, fecha_fin, modalidad } })
export const getProductosGas = () => api.get('productos-gas/')
export const crearProductoGas = (data) => api.post('productos-gas/', data)
export const actualizarProductoGas = (id, data) => api.patch(`productos-gas/${id}/`, data)
export const eliminarProductoGas = (id) => api.delete(`productos-gas/${id}/`)
export const getStockBajoGas = () => api.get('productos-gas/stock_bajo/')
export const getPedidosGas = () => api.get('pedidos-gas/')
export const solicitarGas = (data) => api.post('pedidos-gas/solicitar/', data)
export const marcarPedidoGasRevisado = (id) => api.patch(`pedidos-gas/${id}/marcar_revisado/`)
export const marcarReservasVistas = () => api.post('reservas-maquinas/marcar_vistas/')
export const getCategoriasMaquinas = () => api.get('categorias-maquinas/')
export const crearCategoriaMaquina = (formData) =>
  api.post('categorias-maquinas/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
export const actualizarCategoriaMaquina = (id, formData) =>
  api.patch(`categorias-maquinas/${id}/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
export const eliminarCategoriaMaquina = (id) => api.delete(`categorias-maquinas/${id}/`)