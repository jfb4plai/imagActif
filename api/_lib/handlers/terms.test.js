import { describe, it, expect } from 'vitest'
import { createTermsHandler } from './terms.js'
import { makeRes, okAuth, noAuth, fakeRepo, NOW } from '../../../tests/helpers.js'
import { TERMS_VERSION } from '../../../src/lib/terms.js'

const req = (over = {}) => ({ method: 'POST', headers: {}, body: { version: TERMS_VERSION }, ...over })

describe('POST /api/terms', () => {
  it('405 hors POST', async () => {
    const res = makeRes()
    await createTermsHandler({ requireUser: okAuth, repo: fakeRepo() })(req({ method: 'GET' }), res)
    expect(res.code).toBe(405)
  })
  it('401 sans session', async () => {
    const repo = fakeRepo()
    const res = makeRes()
    await createTermsHandler({ requireUser: noAuth, repo })(req(), res)
    expect(res.code).toBe(401)
    expect(repo.upsertAccount).not.toHaveBeenCalled()
  })
  it('400 si la version ne correspond pas', async () => {
    const res = makeRes()
    await createTermsHandler({ requireUser: okAuth, repo: fakeRepo() })(req({ body: { version: 'ancienne' } }), res)
    expect(res.code).toBe(400)
  })
  it('enregistre l\'acceptation', async () => {
    const repo = fakeRepo()
    const res = makeRes()
    await createTermsHandler({ requireUser: okAuth, repo, now: () => NOW })(req(), res)
    expect(res.code).toBe(200)
    expect(repo.upsertAccount).toHaveBeenCalledWith('u1', TERMS_VERSION, NOW.toISOString())
  })
})
