import { describe, it, expect, vi } from 'vitest'
import { createRepo } from './repo.js'

describe('repo.signedUrl', () => {
  it('demande un lien signé au bucket privé et renvoie l\'URL', async () => {
    const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: 'https://s.example/a?token=1' }, error: null }))
    const from = vi.fn(() => ({ createSignedUrl }))
    const repo = createRepo(() => ({ storage: { from } }))
    expect(await repo.signedUrl('u1/g1.png', 300)).toBe('https://s.example/a?token=1')
    expect(from).toHaveBeenCalledWith('img-generations')
    expect(createSignedUrl).toHaveBeenCalledWith('u1/g1.png', 300)
  })
  it('propage l\'erreur de stockage', async () => {
    const repo = createRepo(() => ({ storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: new Error('absent') }) }) } }))
    await expect(repo.signedUrl('x', 300)).rejects.toThrow('absent')
  })
})

describe('repo.insertGeneration', () => {
  it('transmet edit_instruction tel quel', async () => {
    const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id: 'g' }, error: null }) }) }))
    const repo = createRepo(() => ({ from: () => ({ insert }) }))
    await repo.insertGeneration({ user_id: 'u', edit_instruction: 'chapeau jaune', parent_id: 'p' })
    expect(insert).toHaveBeenCalledWith({ user_id: 'u', edit_instruction: 'chapeau jaune', parent_id: 'p' })
  })
})
