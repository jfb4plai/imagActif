import { describe, it, expect } from 'vitest'
import { verifierCron } from './cronAuth.js'

describe('verifierCron', () => {
  it('accepte le bon secret', () => {
    expect(verifierCron('Bearer abc', 'abc')).toBe(true)
  })
  it('refuse un mauvais secret, un en-tête absent, un secret non configuré', () => {
    expect(verifierCron('Bearer abd', 'abc')).toBe(false)
    expect(verifierCron('Bearer ab', 'abc')).toBe(false)
    expect(verifierCron(undefined, 'abc')).toBe(false)
    expect(verifierCron('Bearer ', '')).toBe(false)
    expect(verifierCron('Bearer undefined', undefined)).toBe(false)
  })
})
