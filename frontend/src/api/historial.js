import api from './axios'

export const getHistorialEliminaciones = (params) => api.get('/historial-eliminaciones/', { params })

// Recupera un trabajo de maestranza borrado definitivamente. data: { cliente, estado }
export const recuperarTrabajoHistorial = (id, data) =>
  api.post(`/historial-eliminaciones/${id}/recuperar_trabajo/`, data)

// Recupera una cotización eliminada definitivamente desde la papelera.
export const recuperarCotizacionHistorial = (id) =>
  api.post(`/historial-eliminaciones/${id}/recuperar_cotizacion/`)
