import { describe, it, expect, vi } from 'vitest'
import { runCleanup, createCleanupHandler } from './cleanup.js'
import { makeRes, fakeRepo, NOW } from '../../../tests/helpers.js'

function repoCleanup(lots, perimees = []) {
  const file = [...lots]
  return fakeRepo({
    listExpired: vi.fn(async () => file.shift() ?? []),
    markImagesDeleted: vi.fn(async () => {}),
    failStaleAll: vi.fn(async () => perimees),
  })
}

describe('runCleanup', () => {
  it('supprime les fichiers puis marque les lignes, lot par lot', async () => {
    const repo = repoCleanup([[{ id: 'a', image_path: 'u/a.png' }, { id: 'b', image_path: 'u/b.jpg' }], [{ id: 'c', image_path: 'u/c.png' }]])
    const r = await runCleanup({ repo, now: NOW })
    expect(r.imagesSupprimees).toBe(3)
    expect(repo.removeImages).toHaveBeenNthCalledWith(1, ['u/a.png', 'u/b.jpg'])
    expect(repo.markImagesDeleted).toHaveBeenNthCalledWith(1, ['a', 'b'], NOW.toISOString())
    expect(repo.markImagesDeleted).toHaveBeenNthCalledWith(2, ['c'], NOW.toISOString())
  })
  it('ne marque rien si la suppression des fichiers échoue', async () => {
    const repo = repoCleanup([[{ id: 'a', image_path: 'u/a.png' }]])
    repo.removeImages = vi.fn(async () => { throw new Error('storage down') })
    await expect(runCleanup({ repo, now: NOW })).rejects.toThrow('storage down')
    expect(repo.markImagesDeleted).not.toHaveBeenCalled()
  })
  it('échoue et rembourse les générations bloquées depuis plus de 15 minutes', async () => {
    const repo = repoCleanup([], [{ id: 'x', user_id: 'u1', quota_day: '2026-10-08' }, { id: 'y', user_id: 'u2', quota_day: null }])
    const r = await runCleanup({ repo, now: NOW })
    expect(repo.failStaleAll).toHaveBeenCalledWith(new Date(NOW.getTime() - 15 * 60 * 1000).toISOString())
    expect(repo.refundQuota).toHaveBeenCalledTimes(1)
    expect(repo.refundQuota).toHaveBeenCalledWith('u1', '2026-10-08')
    expect(r.echecsNettoyes).toBe(2)
  })
})

describe('createCleanupHandler', () => {
  it('401 sans le bon secret', async () => {
    const repo = repoCleanup([])
    const res = makeRes()
    await createCleanupHandler({ repo, secret: 's3cret', now: () => NOW })({ method: 'GET', headers: { authorization: 'Bearer faux' } }, res)
    expect(res.code).toBe(401)
    expect(repo.listExpired).not.toHaveBeenCalled()
  })
  it('exécute avec le bon secret', async () => {
    const repo = repoCleanup([])
    const res = makeRes()
    await createCleanupHandler({ repo, secret: 's3cret', now: () => NOW })({ method: 'GET', headers: { authorization: 'Bearer s3cret' } }, res)
    expect(res.code).toBe(200)
    expect(res.body).toEqual({ imagesSupprimees: 0, echecsNettoyes: 0, jsonSupprimes: 0, modelesSupprimes: 0 })
  })
})
