import { describe, it, expect } from 'vitest'
import { gabaritVide, normaliserGabarit, validerPourGeneration, EXCLUSION_DEFAUT } from './gabarit.js'
import { dimensions, RATIO_IDS } from './ratios.js'

describe('ratios', () => {
  it('toutes les dimensions sont des multiples de 16', () => {
    for (const id of RATIO_IDS) {
      const { width, height } = dimensions(id)
      expect(width % 16).toBe(0)
      expect(height % 16).toBe(0)
    }
  })
  it('refuse un format inconnu', () => {
    expect(() => dimensions('2:1')).toThrow('Format inconnu')
  })
})

describe('gabaritVide', () => {
  it('contient l\'exclusion par défaut et le format carré', () => {
    const g = gabaritVide()
    expect(g.exclusions).toEqual([EXCLUSION_DEFAUT])
    expect(g.format.ratio).toBe('1:1')
    expect(g.generation.seed).toBeNull()
  })
  it('est invalide sans sujet', () => {
    expect(validerPourGeneration(gabaritVide())).toEqual(["Décrivez le sujet de l'image."])
  })
})

describe('normaliserGabarit', () => {
  it('rejette ce qui n\'est pas un objet', () => {
    expect(() => normaliserGabarit(null)).toThrow('objet')
    expect(() => normaliserGabarit([])).toThrow('objet')
    expect(() => normaliserGabarit('x')).toThrow('objet')
  })
  it('remplit les valeurs par défaut', () => {
    const { gabarit } = normaliserGabarit({ sujet: { description: 'Un chat' } })
    expect(gabarit.sujet.description).toBe('Un chat')
    expect(gabarit.exclusions).toEqual([EXCLUSION_DEFAUT])
    expect(gabarit.format.ratio).toBe('1:1')
  })
  it('respecte une liste d\'exclusions vide fournie par l\'enseignant', () => {
    const { gabarit } = normaliserGabarit({ sujet: { description: 'a' }, exclusions: [] })
    expect(gabarit.exclusions).toEqual([])
  })
  it('range les clés inconnues dans personnalise avec un avertissement', () => {
    const { gabarit, avertissements } = normaliserGabarit({ sujet: { description: 'a' }, humeur: 'joyeuse', cadre: { x: 1 } })
    expect(gabarit.personnalise).toEqual([
      { nom: 'humeur', valeur: 'joyeuse' },
      { nom: 'cadre', valeur: '{"x":1}' },
    ])
    expect(avertissements).toHaveLength(2)
  })
  it('tronque les textes trop longs et nettoie les espaces', () => {
    const { gabarit } = normaliserGabarit({ sujet: { description: `  ${'a'.repeat(900)}  ` } })
    expect(gabarit.sujet.description).toHaveLength(500)
  })
  it('valide la graine et le format', () => {
    const a = normaliserGabarit({ sujet: { description: 'a' }, generation: { seed: 42 }, format: { ratio: '16:9' } })
    expect(a.gabarit.generation.seed).toBe(42)
    expect(a.gabarit.format.ratio).toBe('16:9')
    const b = normaliserGabarit({ sujet: { description: 'a' }, generation: { seed: -3 }, format: { ratio: '5:1' } })
    expect(b.gabarit.generation.seed).toBeNull()
    expect(b.gabarit.format.ratio).toBe('1:1')
    expect(b.avertissements).toHaveLength(2)
  })
  it('limite et nettoie personnalise', () => {
    const perso = Array.from({ length: 15 }, (_, i) => ({ nom: `n${i}`, valeur: `v${i}` }))
    perso.push({ nom: '', valeur: 'x' })
    const { gabarit } = normaliserGabarit({ sujet: { description: 'a' }, personnalise: perso })
    expect(gabarit.personnalise).toHaveLength(10)
  })
  it('ne contient jamais de clé dangereuse héritée', () => {
    const { gabarit } = normaliserGabarit(JSON.parse('{"sujet":{"description":"a"},"__proto__":{"x":1}}'))
    expect(Object.prototype.hasOwnProperty.call(gabarit, 'x')).toBe(false)
    expect({}.x).toBeUndefined()
  })
})
