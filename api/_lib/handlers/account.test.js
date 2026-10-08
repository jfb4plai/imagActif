import { describe, it, expect } from 'vitest'
import { createAccountHandler } from './account.js'
import { makeRes, okAuth, noAuth, fakeRepo } from '../../../tests/helpers.js'

describe('DELETE /api/account', () => {
  it('401 sans session', async () => {
    const repo = fakeRepo()
    const res = makeRes()
    await createAccountHandler({ requireUser: noAuth, repo })({ method: 'DELETE', headers: {}, body: { confirm: 'SUPPRIMER' } }, res)
    expect(res.code).toBe(401)
    expect(repo.deleteAllUserData).not.toHaveBeenCalled()
  })
  it('exige la confirmation exacte', async () => {
    for (const confirm of [undefined, 'supprimer', 'oui']) {
      const repo = fakeRepo()
      const res = makeRes()
      await createAccountHandler({ requireUser: okAuth, repo })({ method: 'DELETE', headers: {}, body: { confirm } }, res)
      expect(res.code).toBe(400)
      expect(repo.deleteAllUserData).not.toHaveBeenCalled()
    }
  })
  it('supprime toutes les données de l\'utilisateur connecté, pas d\'un autre', async () => {
    const repo = fakeRepo()
    const res = makeRes()
    await createAccountHandler({ requireUser: okAuth, repo })({ method: 'DELETE', headers: {}, body: { confirm: 'SUPPRIMER', userId: 'autre' } }, res)
    expect(res.code).toBe(200)
    expect(repo.deleteAllUserData).toHaveBeenCalledWith('u1')
  })
  it('405 hors DELETE', async () => {
    const res = makeRes()
    await createAccountHandler({ requireUser: okAuth, repo: fakeRepo() })({ method: 'POST', headers: {}, body: {} }, res)
    expect(res.code).toBe(405)
  })
})
