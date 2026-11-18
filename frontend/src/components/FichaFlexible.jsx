import { useState } from 'react'
import { guardarDetalleFlexible } from '../api/maestranza'

// Formulario de la ficha técnica del flexible (manguera, largo, férulas,
// prensado y terminales). Lo usan el trabajador y el admin, así se carga
// el material de Flexibles hidráulicos de la misma forma en ambos paneles.
export default function FichaFlexible({ trabajo, productos, onGuardado }) {
  const [formEditado, setFormEditado] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const mangueras = productos.filter((p) => p.categoria === 'MANGUERA')
  const porCategoriaYDiametro = (categoria, diametro) =>
    productos.filter((p) => p.categoria === categoria && p.diametro === diametro)
  const terminalesPorDiametro = (d) => porCategoriaYDiametro('TERMINAL', d)
  const ferulasPorDiametro = (d) => porCategoriaYDiametro('FERULA', d)
  const prensadosPorDiametro = (d) => porCategoriaYDiametro('PRENSADO', d)
  const diametroDeManguera = (mangueraId) =>
    productos.find((p) => String(p.id) === String(mangueraId))?.diametro || ''

  // Valores iniciales: la ficha guardada o, si no hay, los primeros productos
  // del catálogo. Mientras el usuario no toque nada se calcula al vuelo (así
  // funciona aunque el catálogo termine de cargar después de abrir la ficha).
  function formInicial() {
    const existente = trabajo.detalle_flexible
    if (existente) {
      return {
        manguera: existente.manguera || '',
        largo_metros: existente.largo_metros || '',
        terminal_entrada: existente.terminal_entrada || '',
        terminal_salida: existente.terminal_salida || '',
        ferula: existente.ferula || '',
        prensado: existente.prensado || '',
        cantidad_ferulas: existente.cantidad_ferulas || 2,
      }
    }
    if (mangueras.length === 0) return null
    const d = mangueras[0].diametro || ''
    const terminalDefault = terminalesPorDiametro(d)[0]?.id || ''
    return {
      manguera: mangueras[0].id,
      largo_metros: '',
      terminal_entrada: terminalDefault,
      terminal_salida: terminalDefault,
      ferula: ferulasPorDiametro(d)[0]?.id || '',
      prensado: prensadosPorDiametro(d)[0]?.id || '',
      cantidad_ferulas: 2,
    }
  }

  const form = formEditado ?? formInicial()

  function actualizar(cambios) {
    setFormEditado({ ...form, ...cambios })
  }

  async function handleGuardar() {
    if (!form.manguera) return alert('Selecciona la manguera')
    if (!form.largo_metros) return alert('Indica el largo de la manguera en metros')
    if (!form.ferula) return alert('Selecciona la férula')
    if (form.cantidad_ferulas === 2 && !(form.terminal_entrada && form.terminal_salida)) {
      return alert('Indica el terminal de entrada y de salida')
    }
    if (form.cantidad_ferulas === 1 && !(form.terminal_entrada || form.terminal_salida)) {
      return alert('Indica el terminal usado')
    }

    setGuardando(true)
    try {
      await guardarDetalleFlexible(trabajo.id, {
        manguera: form.manguera,
        largo_metros: form.largo_metros,
        terminal_entrada: form.terminal_entrada || null,
        terminal_salida: form.terminal_salida || null,
        ferula: form.ferula,
        prensado: form.prensado || null,
        cantidad_ferulas: form.cantidad_ferulas,
      })
      alert('Ficha del flexible guardada')
      onGuardado?.()
    } catch (err) {
      const data = err.response?.data
      if (data?.productos_faltantes) {
        alert(`${data.error}\n\n- ${data.productos_faltantes.join('\n- ')}`)
      } else {
        alert(data?.error || 'Error al guardar la ficha del flexible')
      }
    } finally {
      setGuardando(false)
    }
  }

  if (!form) {
    return (
      <div className="mb-3 border rounded p-3 bg-blue-50">
        <p className="text-xs font-bold text-dark mb-2">🔧 Ficha técnica del flexible</p>
        <p className="text-xs text-gray-600">
          Todavía no hay mangueras en el catálogo de Flexibles. Cárgalas antes de continuar.
        </p>
      </div>
    )
  }

  const diametro = diametroDeManguera(form.manguera)
  const terminales = terminalesPorDiametro(diametro)
  const ferulas = ferulasPorDiametro(diametro)
  const prensados = prensadosPorDiametro(diametro)

  const opcionesTerminal = (
    <>
      {terminales.length === 0 && <option value="">Sin terminales cargados</option>}
      {terminales.map((p) => (
        <option key={p.id} value={p.id}>{p.nombre}</option>
      ))}
    </>
  )

  return (
    <div className="mb-3 border rounded p-3 bg-blue-50">
      <p className="text-xs font-bold text-dark mb-2">🔧 Ficha técnica del flexible</p>

      {mangueras.length === 0 ? (
        <p className="text-xs text-gray-600">
          Todavía no hay mangueras en el catálogo de Flexibles. Cárgalas antes de continuar.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1 text-dark">Manguera</label>
              <select
                value={form.manguera}
                onChange={(e) => {
                  const mangueraId = e.target.value
                  const d = diametroDeManguera(mangueraId)
                  const terminalDefault = terminalesPorDiametro(d)[0]?.id || ''
                  actualizar({
                    manguera: mangueraId,
                    terminal_entrada: terminalDefault,
                    terminal_salida: form.cantidad_ferulas === 2 ? terminalDefault : '',
                    ferula: ferulasPorDiametro(d)[0]?.id || '',
                    prensado: prensadosPorDiametro(d)[0]?.id || '',
                  })
                }}
                className="w-full border rounded p-2 text-sm bg-white"
              >
                {mangueras.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre} {m.diametro}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-dark">Largo (metros)</label>
              <input
                type="number" step="0.1"
                value={form.largo_metros}
                onChange={(e) => actualizar({ largo_metros: e.target.value })}
                className="w-full border rounded p-2 text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-dark">Cantidad férulas</label>
              <select
                value={form.cantidad_ferulas}
                onChange={(e) => {
                  const cantidad = Number(e.target.value)
                  const terminalDefault = terminales[0]?.id || ''
                  actualizar({
                    cantidad_ferulas: cantidad,
                    terminal_entrada: terminalDefault,
                    terminal_salida: cantidad === 2 ? terminalDefault : '',
                  })
                }}
                className="w-full border rounded p-2 text-sm bg-white"
              >
                <option value={1}>1 (arreglo de un lado)</option>
                <option value={2}>2 (manguera completa)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-dark">Férula</label>
              <select
                value={form.ferula}
                onChange={(e) => actualizar({ ferula: e.target.value })}
                className="w-full border rounded p-2 text-sm bg-white"
              >
                {ferulas.length === 0 && <option value="">Sin férulas cargadas para este diámetro</option>}
                {ferulas.map((f) => (
                  <option key={f.id} value={f.id}>{f.nombre} {f.diametro}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-dark">
                Prensado (× {form.cantidad_ferulas})
              </label>
              <select
                value={form.prensado}
                onChange={(e) => actualizar({ prensado: e.target.value })}
                className="w-full border rounded p-2 text-sm bg-white"
              >
                <option value="">Sin prensado</option>
                {prensados.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre} {p.diametro}</option>
                ))}
              </select>
            </div>

            {form.cantidad_ferulas === 2 ? (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1 text-dark">Terminal entrada</label>
                  <select
                    value={form.terminal_entrada}
                    onChange={(e) => actualizar({ terminal_entrada: e.target.value })}
                    className="w-full border rounded p-2 text-sm bg-white"
                  >
                    {opcionesTerminal}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-dark">Terminal salida</label>
                  <select
                    value={form.terminal_salida}
                    onChange={(e) => actualizar({ terminal_salida: e.target.value })}
                    className="w-full border rounded p-2 text-sm bg-white"
                  >
                    {opcionesTerminal}
                  </select>
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1 text-dark">¿Qué lado se repara?</label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => actualizar({
                      terminal_entrada: form.terminal_entrada || form.terminal_salida, terminal_salida: '',
                    })}
                    className={`px-3 py-1.5 rounded text-xs font-medium ${form.terminal_entrada ? 'bg-primary text-white' : 'bg-dark/10 text-dark'}`}
                  >
                    Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => actualizar({
                      terminal_salida: form.terminal_salida || form.terminal_entrada, terminal_entrada: '',
                    })}
                    className={`px-3 py-1.5 rounded text-xs font-medium ${form.terminal_salida ? 'bg-primary text-white' : 'bg-dark/10 text-dark'}`}
                  >
                    Salida
                  </button>
                </div>
                <label className="block text-xs font-medium mb-1 text-dark">Terminal usado</label>
                <select
                  value={form.terminal_entrada || form.terminal_salida}
                  onChange={(e) => {
                    const valor = e.target.value
                    const esEntrada = Boolean(form.terminal_entrada) || (!form.terminal_entrada && !form.terminal_salida)
                    actualizar({
                      terminal_entrada: esEntrada ? valor : '',
                      terminal_salida: esEntrada ? '' : valor,
                    })
                  }}
                  className="w-full border rounded p-2 text-sm bg-white"
                >
                  {opcionesTerminal}
                </select>
              </div>
            )}
          </div>

          <button
            onClick={handleGuardar}
            disabled={guardando || !form.manguera || !form.ferula}
            className="mt-2 text-xs bg-primary text-white px-3 py-1.5 rounded hover:bg-primary-light disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar ficha del flexible'}
          </button>
        </>
      )}
    </div>
  )
}
