import api from './axios'

export const getUsuarios = () => api.get('usuarios/')
export const getUsuario = (id) => api.get(`usuarios/${id}/`)
export const crearUsuario = (data) => api.post('usuarios/', data)
export const actualizarUsuario = (id, data) => api.patch(`usuarios/${id}/`, data)
export const eliminarUsuario = (id) => api.delete(`usuarios/${id}/`)

export const getEmpresas = () => api.get('empresas/')
export const crearEmpresa = (data) => api.post('empresas/', data)
export const actualizarEmpresa = (id, data) => api.patch(`empresas/${id}/`, data)
export const eliminarEmpresa = (id) => api.delete(`empresas/${id}/`)

export const getResponsables = () => api.get('responsables/')
export const crearResponsable = (data) => api.post('responsables/', data)
export const actualizarResponsable = (id, data) => api.patch(`responsables/${id}/`, data)
export const eliminarResponsable = (id) => api.delete(`responsables/${id}/`)