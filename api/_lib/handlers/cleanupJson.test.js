import { describe, it, expect, vi } from 'vitest'
import { runCleanup } from './cleanup.js'
import { fakeRepo, NOW } from '../../../tests/helpers.js'

const IL_Y_A_UN_AN = new Date(NOW.getTime() - 365 * 86400000).toISOString()

function repoJson({ generations = [], modeles = 0 } = {}) {
  const file = [...generations]
  return fakeRepo({
    listExpired: vi.fn(async () => []),
    failStaleAll: vi.fn(async () => []),
    listOlderThan: vi.fn(async () => file.shift() ?? []),
    deleteGenerationsByIds: vi.fn(async () => {}),
    deleteTemplatesOlderThan: vi.fn(async () => modeles),
  })
}

describe('runCleanup : descriptions (JSON) de plus d\'un an', () => {
  it('cherche ce qui a plus de 365 jours', async () => {
    const repo = repoJson()
    await runCleanup({ repo, now: NOW })
    expect(repo.listOlderThan).toHaveBeenCalledWith(IL_Y_A_UN_AN, 100)
    expect(repo.deleteTemplatesOlderThan).toHaveBeenCalledWith(IL_Y_A_UN_AN)
  })
  it('supprime d\'abord les éventuels fichiers puis les lignes, lot par lot', async () => {
    const ordre = []
    const repo = repoJson({ generations: [[{ id: 'a', image_path: 'u/a.png' }, { id: 'b', image_path: null }], [{ id: 'c', image_path: null }]] })
    repo.removeImages = vi.fn(async () => { ordre.push('fichiers') })
    repo.deleteGenerationsByIds = vi.fn(async () => { ordre.push('lignes') })
    const r = await runCleanup({ repo, now: NOW })
    expect(repo.removeImages).toHaveBeenCalledWith(['u/a.png'])
    expect(repo.deleteGenerationsByIds).toHaveBeenNthCalledWith(1, ['a', 'b'])
    expect(repo.deleteGenerationsByIds).toHaveBeenNthCalledWith(2, ['c'])
    expect(ordre.slice(0, 2)).toEqual(['fichiers', 'lignes'])
    expect(r.jsonSupprimes).toBe(3)
  })
  it('ne supprime aucune ligne si la suppression des fichiers échoue', async () => {
    const repo = repoJson({ generations: [[{ id: 'a', image_path: 'u/a.png' }]] })
    repo.removeImages = vi.fn(async () => { throw new Error('storage down') })
    await expect(runCleanup({ repo, now: NOW })).rejects.toThrow('storage down')
    expect(repo.deleteGenerationsByIds).not.toHaveBeenCalled()
  })
  it('supprime aussi les modèles de plus d\'un an et les compte', async () => {
    const repo = repoJson({ modeles: 4 })
    const r = await runCleanup({ repo, now: NOW })
    expect(r.modelesSupprimes).toBe(4)
    expect(r.jsonSupprimes).toBe(0)
  })
})
