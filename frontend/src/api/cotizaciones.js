import api from './axios'

export const getCotizaciones = (params) => api.get('/cotizaciones/', { params })
export const crearCotizacion = (datos) => api.post('/cotizaciones/', datos)