import api from './axios'

export const getUsuarios = () => api.get('usuarios/')
export const getUsuario = (id) => api.get(`usuarios/${id}/`)
export const crearUsuario = (data) => api.post('usuarios/', data)
export const actualizarUsuario = (id, data) => api.patch(`usuarios/${id}/`, data)
export const eliminarUsuario = (id) => api.delete(`usuarios/${id}/`)