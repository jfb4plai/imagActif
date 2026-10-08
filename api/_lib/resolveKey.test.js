import { describe, it, expect, vi } from 'vitest'
import { cleApi } from './resolveKey.js'
import { ProviderError } from './providers/bfl.js'

describe('cleApi', () => {
  it('essai : clé de l\'environnement', async () => {
    const k = await cleApi({ keyMode: 'trial', userId: 'u', repo: {}, dechiffrer: vi.fn(), ring: vi.fn(), env: { BFL_API_KEY: 'JF' } })
    expect(k).toBe('JF')
  })
  it('essai sans clé configurée : erreur fournisseur', async () => {
    await expect(cleApi({ keyMode: 'trial', userId: 'u', repo: {}, dechiffrer: vi.fn(), ring: vi.fn(), env: {} })).rejects.toBeInstanceOf(ProviderError)
  })
  it('clé personnelle : déchiffrée pour cet utilisateur', async () => {
    const repo = { getKey: vi.fn(async () => ({ ciphertext: 'c', iv: 'i', secret_version: '1' })) }
    const dechiffrer = vi.fn(() => 'perso')
    const ring = vi.fn(() => 'RING')
    const k = await cleApi({ keyMode: 'own', userId: 'u1', repo, dechiffrer, ring, env: {} })
    expect(k).toBe('perso')
    expect(dechiffrer).toHaveBeenCalledWith({ ciphertext: 'c', iv: 'i', secret_version: '1' }, 'u1', 'RING')
  })
  it('clé personnelle absente : clé refusée', async () => {
    const repo = { getKey: vi.fn(async () => null) }
    await expect(cleApi({ keyMode: 'own', userId: 'u', repo, dechiffrer: vi.fn(), ring: vi.fn(), env: {} })).rejects.toMatchObject({ code: 'invalid_key' })
  })
})
