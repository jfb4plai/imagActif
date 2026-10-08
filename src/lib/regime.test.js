import { describe, it, expect } from 'vitest'
import { determineRegime, trialEnd } from './regime.js'

const debut = '2026-10-05T10:00:00Z'

describe('determineRegime', () => {
  it('essai pendant 3 jours', () => {
    expect(determineRegime({ trialStartedAt: debut, hasOwnKey: false, now: new Date('2026-10-08T09:59:59Z') })).toBe('trial')
  })
  it('plus d\'essai après 3 jours sans clé', () => {
    expect(determineRegime({ trialStartedAt: debut, hasOwnKey: false, now: new Date('2026-10-08T10:00:00Z') })).toBe('none')
  })
  it('la clé personnelle l\'emporte, même pendant l\'essai', () => {
    expect(determineRegime({ trialStartedAt: debut, hasOwnKey: true, now: new Date('2026-10-06T10:00:00Z') })).toBe('own')
  })
  it('sans date d\'essai ni clé : aucun régime', () => {
    expect(determineRegime({ trialStartedAt: null, hasOwnKey: false })).toBe('none')
  })
  it('trialEnd ajoute 72 h', () => {
    expect(trialEnd(debut).toISOString()).toBe('2026-10-08T10:00:00.000Z')
  })
})
