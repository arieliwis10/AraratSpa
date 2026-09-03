import api from './axios'

export const getHistorialEliminaciones = (params) => api.get('/historial-eliminaciones/', { params })