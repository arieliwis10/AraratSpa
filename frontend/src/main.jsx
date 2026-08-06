import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Fuerza un reload cuando el Service Worker nuevo toma control de la
// página (esto pasa apenas termina de instalarse, gracias a skipWaiting +
// clientsClaim en vite.config.js). Sin esto, la app se queda mostrando el
// HTML/JS viejo en memoria aunque el SW ya se haya actualizado en segundo
// plano, y el deploy no se ve reflejado hasta que el usuario cierre y
// vuelva a abrir la app manualmente.
if ('serviceWorker' in navigator) {
  let recargando = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return
    recargando = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)