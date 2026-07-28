import api from './axios'

export const getTareas = (params) => api.get('/tareas-agenda/', { params })
export const crearTarea = (datos) => api.post('/tareas-agenda/', datos)
export const actualizarTarea = (id, datos) => api.patch(`/tareas-agenda/${id}/`, datos)
export const eliminarTarea = (id) => api.delete(`/tareas-agenda/${id}/`)
export const marcarTareaCompletada = (id) => api.patch(`/tareas-agenda/${id}/marcar_completada/`)