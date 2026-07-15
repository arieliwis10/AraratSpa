import axios from 'axios'

const api = axios.create({
  baseURL: 'https://api.araratchile.com/api/',
})

// Interceptor: agrega el token a cada petición automáticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api