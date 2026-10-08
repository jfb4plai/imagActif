import { describe, it, expect } from 'vitest'
import { limitsFromEnv } from './limits.js'
import { messageErreur } from './messages.js'

describe('limitsFromEnv', () => {
  it('valeurs par défaut', () => {
    expect(limitsFromEnv({})).toEqual({ user: 10, global: 100 })
  })
  it('lit l\'environnement et ignore les valeurs invalides', () => {
    expect(limitsFromEnv({ IMG_TRIAL_DAILY_LIMIT: '5', IMG_GLOBAL_DAILY_LIMIT: '40' })).toEqual({ user: 5, global: 40 })
    expect(limitsFromEnv({ IMG_TRIAL_DAILY_LIMIT: 'abc', IMG_GLOBAL_DAILY_LIMIT: '-3' })).toEqual({ user: 10, global: 100 })
  })
})

describe('messageErreur', () => {
  it('traduit un code connu et retombe sur un message neutre sinon', () => {
    expect(messageErreur('busy')).toContain('en cours')
    expect(messageErreur('inconnu')).toBe('Une erreur est survenue. Réessayez.')
    expect(messageErreur('inconnu', 'Détail')).toBe('Détail')
  })
})
