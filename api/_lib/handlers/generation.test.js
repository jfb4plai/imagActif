import { describe, it, expect, vi } from 'vitest'
import { createGenerationHandler } from './generation.js'
import { makeRes, okAuth, noAuth, fakeRepo, ID } from '../../../tests/helpers.js'

const req = (id = ID, method = 'DELETE') => ({ method, headers: {}, query: { id } })

describe('DELETE /api/generation', () => {
  it('401, 405, 400', async () => {
    let res = makeRes()
    await createGenerationHandler({ requireUser: noAuth, repo: fakeRepo() })(req(), res)
    expect(res.code).toBe(401)
    res = makeRes()
    await createGenerationHandler({ requireUser: okAuth, repo: fakeRepo() })(req(ID, 'GET'), res)
    expect(res.code).toBe(405)
    res = makeRes()
    await createGenerationHandler({ requireUser: okAuth, repo: fakeRepo() })({ method: 'DELETE', headers: {}, query: {} }, res)
    expect(res.code).toBe(400)
  })
  it('400 pour un identifiant qui n\'est pas un UUID, sans accès base', async () => {
    const repo = fakeRepo()
    const res = makeRes()
    await createGenerationHandler({ requireUser: okAuth, repo })(req('pas-un-uuid'), res)
    expect(res.code).toBe(400)
    expect(res.body).toEqual({ error: 'Identifiant invalide.' })
    expect(repo.getGeneration).not.toHaveBeenCalled()
  })
  it('404 si la génération n\'est pas à l\'utilisateur', async () => {
    const res = makeRes()
    await createGenerationHandler({ requireUser: okAuth, repo: fakeRepo() })(req(), res)
    expect(res.code).toBe(404)
  })
  it('supprime le fichier avant la ligne', async () => {
    const ordre = []
    const repo = fakeRepo({
      getGeneration: vi.fn(async () => ({ id: ID, image_path: `u1/${ID}.png` })),
      removeImages: vi.fn(async () => { ordre.push('fichier') }),
      deleteGeneration: vi.fn(async () => { ordre.push('ligne') }),
    })
    const res = makeRes()
    await createGenerationHandler({ requireUser: okAuth, repo })(req(), res)
    expect(res.code).toBe(200)
    expect(ordre).toEqual(['fichier', 'ligne'])
    expect(repo.removeImages).toHaveBeenCalledWith([`u1/${ID}.png`])
  })
  it('supprime la ligne seule quand l\'image a déjà expiré', async () => {
    const repo = fakeRepo({ getGeneration: vi.fn(async () => ({ id: ID, image_path: null })) })
    const res = makeRes()
    await createGenerationHandler({ requireUser: okAuth, repo })(req(), res)
    expect(res.code).toBe(200)
    expect(repo.removeImages).not.toHaveBeenCalled()
    expect(repo.deleteGeneration).toHaveBeenCalledWith(ID, 'u1')
  })
})
