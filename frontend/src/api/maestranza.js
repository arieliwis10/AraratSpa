import api from './axios'


export const getTrabajos = (params = {}) => api.get('trabajos-maestranza/', { params })
export const crearTrabajo = (formData) =>
  api.post('trabajos-maestranza/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
export const actualizarTrabajo = (id, data) => api.patch(`trabajos-maestranza/${id}/`, data)
export const eliminarTrabajo = (id) => api.delete(`trabajos-maestranza/${id}/`)
export const actualizarProgreso = (id, data) => api.patch(`trabajos-maestranza/${id}/actualizar_progreso/`, data)
export const aprobarTrabajo = (id) => api.patch(`trabajos-maestranza/${id}/aprobar/`)
export const marcarCompletado = (id) => api.patch(`trabajos-maestranza/${id}/marcar_completado/`)
export const marcarComentariosVistos = (id) => api.patch(`trabajos-maestranza/${id}/marcar_comentarios_vistos/`)
export const elegirEntrega = (id, data) => api.patch(`trabajos-maestranza/${id}/elegir_entrega/`, data)
export const actualizarFoto = (id, formData) =>
  api.patch(`trabajos-maestranza/${id}/actualizar_foto/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
export const agregarMaterial = (id, data) => api.post(`trabajos-maestranza/${id}/agregar_material/`, data)
export const reportarRetraso = (id, motivo) => api.patch(`trabajos-maestranza/${id}/reportar_retraso/`, { motivo })

export const getSolicitudesMaterial = () => api.get('solicitudes-material/')
export const solicitarMaterial = (data) => api.post('solicitudes-material/solicitar/', data)
export const hayEnBodega = (id) => api.patch(`solicitudes-material/${id}/hay_en_bodega/`)
export const enviarACompras = (id) => api.patch(`solicitudes-material/${id}/enviar_a_compras/`)
export const marcarMaterialRecibido = (id, lugarCompra) =>
  api.patch(`solicitudes-material/${id}/marcar_recibido/`, { lugar_compra: lugarCompra })
export const agregarComentario = (id, mensaje, responsableId) =>
  api.post(`trabajos-maestranza/${id}/agregar_comentario/`, { mensaje, responsable: responsableId })

export const getProductosFlexibles = (categoria) =>
  api.get('productos-flexibles/', { params: categoria ? { categoria } : {} })
export const crearProductoFlexible = (data) => api.post('productos-flexibles/', data)
export const actualizarProductoFlexible = (id, data) => api.patch(`productos-flexibles/${id}/`, data)
export const eliminarProductoFlexible = (id) => api.delete(`productos-flexibles/${id}/`)
export const getStockBajoFlexibles = () => api.get('productos-flexibles/stock_bajo/')

export const guardarDetalleFlexible = (trabajoId, data) =>
  api.post(`trabajos-maestranza/${trabajoId}/guardar_detalle_flexible/`, data)