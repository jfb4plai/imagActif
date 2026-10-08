import { describe, it, expect } from 'vitest'
import { JSON_RETENTION_DAYS, JSON_AVERTISSEMENT_JOURS, joursAvantPurgeJson } from './dates.js'

describe('purge des JSON à 1 an', () => {
  const now = new Date('2026-10-08T10:00:00Z')

  it('la durée est de 365 jours et l\'avertissement de 30 jours', () => {
    expect(JSON_RETENTION_DAYS).toBe(365)
    expect(JSON_AVERTISSEMENT_JOURS).toBe(30)
  })
  it('un JSON créé aujourd\'hui a 365 jours devant lui, jamais plus (décalage d\'horloge)', () => {
    expect(joursAvantPurgeJson('2026-10-08T10:00:00Z', now)).toBe(365)
    expect(joursAvantPurgeJson('2026-10-08T10:00:05Z', now)).toBe(365)
  })
  it('décompte les jours restants', () => {
    expect(joursAvantPurgeJson('2025-10-23T10:00:00Z', now)).toBe(15)
    expect(joursAvantPurgeJson('2025-10-09T10:00:00Z', now)).toBe(1)
  })
  it('vaut 0 une fois l\'échéance passée', () => {
    expect(joursAvantPurgeJson('2025-10-01T10:00:00Z', now)).toBe(0)
  })
})
