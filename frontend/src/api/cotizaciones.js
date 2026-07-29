import api from './axios'

export const getCotizaciones = (params) => api.get('/cotizaciones/', { params })
export const crearCotizacion = (datos) => api.post('/cotizaciones/', datos)
export const actualizarCotizacion = (id, datos) => api.patch(`/cotizaciones/${id}/`, datos)
export const enviarCorreoCotizacion = (id, pdfBase64) =>
  api.post(`/cotizaciones/${id}/enviar_correo/`, { pdf_base64: pdfBase64 })