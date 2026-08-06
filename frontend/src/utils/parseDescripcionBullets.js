// Convierte una descripción escrita con guiones como separador
// (ej: "-Punto uno -Punto dos -Punto tres") en un array de puntos limpios,
// para poder renderizarla como lista con viñetas.
//
// Si el texto no usa guiones como separador (una descripción normal en
// párrafo), devuelve un array de un solo elemento con el texto completo,
// para que el componente que lo use pueda decidir mostrarlo como párrafo
// en vez de lista.
export function parseDescripcionBullets(texto) {
  if (!texto) return []

  const limpio = texto.trim().replace(/^-\s*/, '')
  const partes = limpio
    .split(/\s+-\s*/)
    .map((p) => p.trim())
    .filter(Boolean)

  return partes.length > 0 ? partes : [texto.trim()]
}