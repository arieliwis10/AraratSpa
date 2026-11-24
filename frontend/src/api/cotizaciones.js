import api from './axios'

export const getCotizaciones = (params) => api.get('/cotizaciones/', { params })
export const crearCotizacion = (datos) => api.post('/cotizaciones/', datos)
export const actualizarCotizacion = (id, datos) => api.patch(`/cotizaciones/${id}/`, datos)
export const enviarCorreoCotizacion = (id, pdfBase64) =>
  api.post(`/cotizaciones/${id}/enviar_correo/`, { pdf_base64: pdfBase64 })
export const eliminarCotizacion = (id) => api.delete(`/cotizaciones/${id}/`)
export const desbloquearCotizacion = (id, clave) => api.patch(`/cotizaciones/${id}/desbloquear/`, { clave })
export const bloquearCotizacion = (id) => api.patch(`/cotizaciones/${id}/bloquear/`)
export const registrarFacturaCotizacion = (id, numeroFactura) =>
  api.patch(`/cotizaciones/${id}/registrar_factura/`, { numero_factura: numeroFactura })

// Papelera: "eliminar" manda la cotización a la papelera; desde ahí se restaura o se borra para siempre.
export const getPapeleraCotizaciones = () => api.get('/cotizaciones/papelera/')
export const restaurarCotizacion = (id) => api.post(`/cotizaciones/${id}/restaurar/`)
export const eliminarCotizacionDefinitivo = (id) => api.delete(`/cotizaciones/${id}/eliminar_definitivo/`)
// Cambia solo el trabajo de maestranza asociado (trabajoId null = sin trabajo). Funciona aunque esté bloqueada o facturada.
export const vincularTrabajoCotizacion = (id, trabajoId) =>
  api.patch(`/cotizaciones/${id}/vincular_trabajo/`, { trabajo: trabajoId })
