import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import fondoLogin from '../assets/fondo-login.jpg'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded p-2 mb-6"
          required
        />

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