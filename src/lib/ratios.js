// Dimensions ~1 mégapixel, multiples de 16.
export const RATIOS = {
  '1:1': { width: 1024, height: 1024, label: 'Carré (1:1)' },
  '4:3': { width: 1152, height: 864, label: 'Paysage classique (4:3)' },
  '3:4': { width: 864, height: 1152, label: 'Portrait (3:4)' },
  '16:9': { width: 1344, height: 768, label: 'Écran large (16:9)' },
  '9:16': { width: 768, height: 1344, label: 'Vertical (9:16)' },
}

export const RATIO_IDS = Object.keys(RATIOS)

export function dimensions(ratio) {
  const r = RATIOS[ratio]
  if (!r) throw new Error(`Format inconnu : ${ratio}`)
  return { width: r.width, height: r.height }
}
