import { describe, it, expect } from 'vitest'
import { CHAMPS } from './champs.js'
import { gabaritVide } from './gabarit.js'
import { getIn } from './path.js'

describe('CHAMPS', () => {
  it('chaque champ a un label et une aide non vides', () => {
    for (const c of CHAMPS) {
      expect(c.label?.trim(), c.path).toBeTruthy()
      expect(c.aide?.trim(), c.path).toBeTruthy()
    }
  })

  it('chaque champ texte ou textarea a un placeholder', () => {
    for (const c of CHAMPS.filter((x) => ['texte', 'textarea'].includes(x.type))) {
      expect(c.placeholder?.trim(), c.path).toBeTruthy()
    }
  })

  it('les listes ont des colonnes complètes et un maximum', () => {
    for (const c of CHAMPS.filter((x) => x.type === 'liste-objets')) {
      expect(c.max, c.path).toBeGreaterThan(0)
      expect(c.colonnes.length, c.path).toBeGreaterThan(0)
      for (const col of c.colonnes) {
        expect(col.cle && col.label && col.placeholder, c.path).toBeTruthy()
      }
    }
  })

  it('chaque chemin existe dans gabaritVide()', () => {
    const vide = gabaritVide()
    for (const c of CHAMPS) expect(getIn(vide, c.path), c.path).not.toBeUndefined()
  })

  it('les chemins sont uniques', () => {
    const chemins = CHAMPS.map((c) => c.path)
    expect(new Set(chemins).size).toBe(chemins.length)
  })

  it('les champs avancés sont contigus, avec une section, et suivent lumiere', () => {
    const idx = CHAMPS.map((c, i) => (c.avance ? i : -1)).filter((i) => i >= 0)
    expect(idx.length).toBeGreaterThan(0)
    expect(idx[idx.length - 1] - idx[0] + 1).toBe(idx.length)
    expect(CHAMPS[idx[0] - 1].path).toBe('lumiere')
    for (const i of idx) expect(CHAMPS[i].section, CHAMPS[i].path).toBeTruthy()
  })

  it('aucun mot interdit', () => {
    const tout = JSON.stringify(CHAMPS).toLowerCase()
    expect(tout).not.toMatch(/coll[eè]ge|lyc[eé]e/)
  })

  it("l'aide de textes prévient que les IA écrivent mal", () => {
    expect(CHAMPS.find((c) => c.path === 'textes').aide).toMatch(/écrivent mal/)
  })
})
