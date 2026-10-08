import { describe, it, expect, vi } from 'vitest'
import { createKeyHandler } from './key.js'
import { makeRes, okAuth, fakeRepo } from '../../../tests/helpers.js'

const chiffrer = vi.fn((clair, userId) => ({ ciphertext: `enc(${clair})`, iv: 'iv', secret_version: '1' }))
const ring = () => 'RING'
const deps = (repo) => ({ requireUser: okAuth, repo, chiffrer, ring })
const CLE = 'abcd1234-abcd-1234-abcd-1234567890ab'

describe('/api/key', () => {
  it('PUT enregistre la clé chiffrée, jamais en clair', async () => {
    const repo = fakeRepo()
    const res = makeRes()
    await createKeyHandler(deps(repo))({ method: 'PUT', headers: {}, body: { key: `  ${CLE}  ` } }, res)
    expect(res.code).toBe(200)
    expect(res.body).toEqual({ hasOwnKey: true })
    expect(chiffrer).toHaveBeenCalledWith(CLE, 'u1', 'RING')
    expect(repo.saveKey).toHaveBeenCalledWith('u1', { ciphertext: `enc(${CLE})`, iv: 'iv', secret_version: '1' })
    expect(JSON.stringify(res.body)).not.toContain(CLE)
  })
  it('PUT refuse une clé de forme invalide', async () => {
    for (const key of ['court', 'a b c d e f g h i j k l m n o p', '', 123, undefined]) {
      const repo = fakeRepo()
      const res = makeRes()
      await createKeyHandler(deps(repo))({ method: 'PUT', headers: {}, body: { key } }, res)
      expect(res.code).toBe(400)
      expect(repo.saveKey).not.toHaveBeenCalled()
    }
  })
  it('PUT exige d\'avoir accepté le règlement', async () => {
    const repo = fakeRepo({ getAccount: vi.fn(async () => null) })
    const res = makeRes()
    await createKeyHandler(deps(repo))({ method: 'PUT', headers: {}, body: { key: CLE } }, res)
    expect(res.code).toBe(403)
    expect(res.body.code).toBe('terms')
  })
  it('DELETE supprime la clé', async () => {
    const repo = fakeRepo()
    const res = makeRes()
    await createKeyHandler(deps(repo))({ method: 'DELETE', headers: {} }, res)
    expect(res.code).toBe(200)
    expect(res.body).toEqual({ hasOwnKey: false })
    expect(repo.deleteKey).toHaveBeenCalledWith('u1')
  })
  it('405 pour les autres méthodes', async () => {
    const res = makeRes()
    await createKeyHandler(deps(fakeRepo()))({ method: 'GET', headers: {} }, res)
    expect(res.code).toBe(405)
  })
})
