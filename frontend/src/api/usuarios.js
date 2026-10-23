import api from './axios'

// Caché corta para usuarios y empresas: varias pestañas del panel admin los
// piden al abrirse, y en el hosting cada petición simultánea extra puede
// obligar a levantar otro proceso de Python (varios segundos). Cualquier
// cambio (crear/editar/eliminar) vacía la caché, así nunca se muestra algo
// que el propio admin acaba de modificar.
const TTL_MS = 60 * 1000
const cache = {}

function getConCache(clave, url) {
  const entrada = cache[clave]
  if (entrada && Date.now() - entrada.creado < TTL_MS) return entrada.promesa
  const promesa = api.get(url).catch((err) => {
    delete cache[clave]
    throw err
  })
  cache[clave] = { promesa, creado: Date.now() }
  return promesa
}

// Se llama también al cerrar sesión, para que otra cuenta no vea estos datos.
export function limpiarCacheUsuarios() {
  delete cache.usuarios
  delete cache.empresas
}

function invalidar(promesa) {
  // Las empresas traen sus responsables anidados y los usuarios su empresa,
  // así que cualquier cambio invalida ambas.
  limpiarCacheUsuarios()
  return promesa.finally(limpiarCacheUsuarios)
}

export const getUsuarios = () => getConCache('usuarios', 'usuarios/')
export const getUsuario = (id) => api.get(`usuarios/${id}/`)
export const crearUsuario = (data) => invalidar(api.post('usuarios/', data))
export const actualizarUsuario = (id, data) => invalidar(api.patch(`usuarios/${id}/`, data))
export const eliminarUsuario = (id) => invalidar(api.delete(`usuarios/${id}/`))

export const getEmpresas = () => getConCache('empresas', 'empresas/')
export const crearEmpresa = (data) => invalidar(api.post('empresas/', data))
export const actualizarEmpresa = (id, data) => invalidar(api.patch(`empresas/${id}/`, data))
export const eliminarEmpresa = (id) => invalidar(api.delete(`empresas/${id}/`))

export const getResponsables = (params = {}) => api.get('responsables/', { params })
export const crearResponsable = (data) => invalidar(api.post('responsables/', data))
export const actualizarResponsable = (id, data) => invalidar(api.patch(`responsables/${id}/`, data))
export const eliminarResponsable = (id) => invalidar(api.delete(`responsables/${id}/`))
export const getResumenCliente = () => api.get('resumen-cliente/')
export const guardarPushSubscription = (subscription) => {
  return api.post('/push-subscription/', subscription.toJSON());
};
