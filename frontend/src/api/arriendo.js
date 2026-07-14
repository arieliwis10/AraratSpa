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