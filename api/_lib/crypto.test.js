import { describe, it, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import { chiffrer, dechiffrer, ringFromEnv } from './crypto.js'

const ring = () => ({ current: '1', keys: { '1': randomBytes(32), '2': randomBytes(32) } })

describe('crypto des clés', () => {
  it('aller-retour', () => {
    const r = ring()
    const rec = chiffrer('cle-bfl-secrete-123456', 'user-1', r)
    expect(rec.ciphertext).not.toContain('cle-bfl')
    expect(rec.secret_version).toBe('1')
    expect(dechiffrer(rec, 'user-1', r)).toBe('cle-bfl-secrete-123456')
  })
  it('IV unique à chaque chiffrement', () => {
    const r = ring()
    const a = chiffrer('x'.repeat(20), 'u', r)
    const b = chiffrer('x'.repeat(20), 'u', r)
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })
  it('refuse le déchiffrement pour un autre utilisateur', () => {
    const r = ring()
    const rec = chiffrer('x'.repeat(20), 'user-1', r)
    expect(() => dechiffrer(rec, 'user-2', r)).toThrow()
  })
  it('refuse un contenu altéré', () => {
    const r = ring()
    const rec = chiffrer('x'.repeat(20), 'user-1', r)
    const buf = Buffer.from(rec.ciphertext, 'base64')
    buf[0] ^= 1
    expect(() => dechiffrer({ ...rec, ciphertext: buf.toString('base64') }, 'user-1', r)).toThrow()
  })
  it('déchiffre avec une ancienne version de secret', () => {
    const r = ring()
    const rec = chiffrer('x'.repeat(20), 'u', r)
    const r2 = { ...r, current: '2' }
    expect(dechiffrer(rec, 'u', r2)).toBe('x'.repeat(20))
    expect(chiffrer('y'.repeat(20), 'u', r2).secret_version).toBe('2')
  })
  it('échoue clairement si la version du secret manque', () => {
    const r = ring()
    const rec = { ...chiffrer('x'.repeat(20), 'u', r), secret_version: '9' }
    expect(() => dechiffrer(rec, 'u', r)).toThrow('indisponible')
  })
})

describe('ringFromEnv', () => {
  const b64 = randomBytes(32).toString('base64')
  it('charge les secrets de l\'environnement', () => {
    const r = ringFromEnv({ IMG_KEY_SECRETS: JSON.stringify({ '1': b64 }), IMG_KEY_CURRENT: '1' })
    expect(r.current).toBe('1')
    expect(r.keys['1']).toHaveLength(32)
  })
  it('refuse l\'absence de configuration', () => {
    expect(() => ringFromEnv({})).toThrow('manquants')
  })
  it('refuse un secret de mauvaise taille ou une version courante absente', () => {
    expect(() => ringFromEnv({ IMG_KEY_SECRETS: JSON.stringify({ '1': 'abcd' }), IMG_KEY_CURRENT: '1' })).toThrow('32 octets')
    expect(() => ringFromEnv({ IMG_KEY_SECRETS: JSON.stringify({ '1': b64 }), IMG_KEY_CURRENT: '2' })).toThrow('introuvable')
  })
})
