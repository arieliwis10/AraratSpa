import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import fondoLogin from '../assets/fondo-login.jpg'

function IconoOjo({ visible }) {
  if (visible) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.53 13.53 0 0 0 1 12s4 7 11 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      const perfil = await login(username, password)
      if (perfil.rol === 'ADMIN') navigate('/admin')
      else if (perfil.rol === 'TRABAJADOR') navigate('/trabajador')
      else navigate('/cliente')
    } catch (err) {
      setError('Usuario o contraseña incorrectos')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center px-4 bg-dark bg-cover bg-center"
      style={{ backgroundImage: `url(${fondoLogin})` }}
    >
      {/* Overlay oscuro para que la tarjeta blanca siga contrastando bien sobre cualquier imagen */}
      <div className="absolute inset-0 bg-black/50" />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 bg-white p-8 rounded-lg shadow-md w-full max-w-sm border-t-4 border-primary"
      >
        <h1 className="text-2xl font-bold mb-6 text-center text-dark">Iniciar sesión</h1>

        {error && (
          <div className="bg-danger/10 text-danger p-2 rounded mb-4 text-sm border border-danger/30">
            {error}
          </div>
        )}

        <label className="block text-sm font-medium mb-1">Usuario</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border rounded p-2 mb-4"
          required
        />

        <label className="block text-sm font-medium mb-1">Contraseña</label>
        <div className="relative mb-6">
          <input
            type={mostrarPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded p-2 pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setMostrarPassword(!mostrarPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-dark"
            tabIndex={-1}
            aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            <IconoOjo visible={mostrarPassword} />
          </button>
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-primary text-white py-2 rounded hover:bg-primary-light disabled:opacity-50 font-medium"
        >
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}