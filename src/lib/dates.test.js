import { describe, it, expect } from 'vitest'
import { imageExpiry, joursRestants, niveauUrgence, jourBruxelles } from './dates.js'

describe('dates', () => {
  it('l\'image expire 30 jours plus tard', () => {
    expect(imageExpiry(new Date('2026-10-08T10:00:00Z')).toISOString()).toBe('2026-11-07T10:00:00.000Z')
  })
  it('compte les jours restants en arrondissant au-dessus', () => {
    const now = new Date('2026-10-08T10:00:00Z')
    expect(joursRestants(new Date('2026-10-20T10:00:00Z'), now)).toBe(12)
    expect(joursRestants(new Date('2026-10-09T22:00:00Z'), now)).toBe(2)
    expect(joursRestants(new Date('2026-10-01T10:00:00Z'), now)).toBe(0)
  })
  it('plafonne le décompte à la durée prévue (horloges client et base légèrement décalées)', () => {
    const now = new Date('2026-10-08T10:00:00Z')
    const finTrente = new Date('2026-11-07T10:00:01Z') // 30 jours + 1 s : la base est en avance sur le navigateur
    expect(joursRestants(finTrente, now)).toBe(31)
    expect(joursRestants(finTrente, now, 30)).toBe(30)
    expect(joursRestants(new Date('2026-10-20T10:00:00Z'), now, 30)).toBe(12)
  })
  it('niveaux d\'urgence', () => {
    expect(niveauUrgence(12)).toBe('ok')
    expect(niveauUrgence(5)).toBe('bientot')
    expect(niveauUrgence(1)).toBe('bientot')
    expect(niveauUrgence(0)).toBe('expire')
  })
  it('le jour de quota suit l\'heure de Bruxelles', () => {
    expect(jourBruxelles(new Date('2026-10-08T22:30:00Z'))).toBe('2026-10-09')
    expect(jourBruxelles(new Date('2026-10-08T10:00:00Z'))).toBe('2026-10-08')
  })
})
