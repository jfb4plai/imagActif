import { describe, it, expect, vi } from 'vitest'
import { createGenerateHandler } from './generate.js'
import { makeRes, okAuth, noAuth, fakeRepo, fakeBfl, ACCOUNT, NOW, USER, ID } from '../../../tests/helpers.js'
import { gabaritVide } from '../../../src/lib/gabarit.js'
import { ProviderError } from '../providers/bfl.js'
import { TERMS_VERSION } from '../../../src/lib/terms.js'

function gabarit(over = {}) {
  const g = gabaritVide()
  g.sujet.description = 'Un chat roux'
  return Object.assign(g, over)
}
const req = (body = { gabarit: gabarit() }, method = 'POST') => ({ method, headers: {}, body })

function deps(over = {}) {
  return {
    requireUser: okAuth,
    repo: fakeRepo(),
    bfl: fakeBfl(),
    dechiffrer: vi.fn(() => 'cle-perso'),
    ring: () => 'RING',
    env: { BFL_API_KEY: 'cle-jf' },
    now: () => NOW,
    seedAleatoire: () => 4242,
    ...over,
  }
}

describe('POST /api/generate : garde-fous', () => {
  it('405 hors POST', async () => {
    const res = makeRes()
    await createGenerateHandler(deps())(req({}, 'GET'), res)
    expect(res.code).toBe(405)
  })
  it('401 sans session', async () => {
    const d = deps({ requireUser: noAuth })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(401)
    expect(d.repo.getAccount).not.toHaveBeenCalled()
  })
  it('403 si l\'e-mail n\'est pas confirmé', async () => {
    const res = makeRes()
    await createGenerateHandler(deps({ requireUser: async () => ({ ...USER, email_confirmed_at: null }) }))(req(), res)
    expect(res.code).toBe(403)
    expect(res.body.code).toBe('email_unconfirmed')
  })
  it('403 sans compte ou avec un règlement ancien', async () => {
    for (const compte of [null, { ...ACCOUNT, terms_version: 'ancienne' }]) {
      const res = makeRes()
      await createGenerateHandler(deps({ repo: fakeRepo({ getAccount: vi.fn(async () => compte) }) }))(req(), res)
      expect(res.code).toBe(403)
      expect(res.body.code).toBe('terms')
    }
  })
  it('400 sans sujet ou avec un JSON invalide', async () => {
    for (const body of [{ gabarit: gabaritVide() }, { gabarit: 'texte' }, {}]) {
      const res = makeRes()
      await createGenerateHandler(deps())(req(body), res)
      expect(res.code).toBe(400)
    }
  })
  it('400 invalid_json si le prompt dépasse 4000 caractères, sans quota ni appel BFL', async () => {
    const g = gabarit()
    g.elements = Array.from({ length: 15 }, (_, i) => ({ nom: `e${i}`, position: '', details: 'd'.repeat(500) }))
    g.textes = Array.from({ length: 10 }, () => ({ contenu: 'c'.repeat(500), position: '', style: '' }))
    const d = deps()
    const res = makeRes()
    await createGenerateHandler(d)(req({ gabarit: g }), res)
    expect(res.code).toBe(400)
    expect(res.body.code).toBe('invalid_json')
    expect(res.body.error).toMatch(/^La description est trop longue \(\d+ caractères sur 4000\) : raccourcissez-la\.$/)
    expect(d.repo.reserveQuota).not.toHaveBeenCalled()
    expect(d.bfl.submit).not.toHaveBeenCalled()
  })
  it('400 si l\'image d\'origine n\'appartient pas à l\'utilisateur', async () => {
    const res = makeRes()
    await createGenerateHandler(deps())(req({ gabarit: gabarit(), parentId: ID }), res)
    expect(res.code).toBe(400)
    expect(res.body.code).toBe('invalid_parent')
  })
  it('400 invalid_parent si parentId n\'est pas un UUID, sans accès base', async () => {
    const d = deps()
    const res = makeRes()
    await createGenerateHandler(d)(req({ gabarit: gabarit(), parentId: 'autre' }), res)
    expect(res.code).toBe(400)
    expect(res.body.code).toBe('invalid_parent')
    expect(d.repo.getGeneration).not.toHaveBeenCalled()
  })
  it('403 trial_over : essai terminé et pas de clé', async () => {
    const vieux = { ...ACCOUNT, trial_started_at: '2026-10-01T00:00:00Z' }
    const d = deps({ repo: fakeRepo({ getAccount: vi.fn(async () => vieux) }) })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(403)
    expect(res.body.code).toBe('trial_over')
    expect(d.bfl.submit).not.toHaveBeenCalled()
  })
})

describe('POST /api/generate : essai', () => {
  it('réserve le quota, utilise la clé de JF et enregistre la graine', async () => {
    const d = deps()
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(202)
    expect(res.body).toEqual({ id: ID })
    expect(d.repo.reserveQuota).toHaveBeenCalledWith('u1', '2026-10-08', 10, 100)
    const ligne = d.repo.insertGeneration.mock.calls[0][0]
    expect(ligne).toMatchObject({ user_id: 'u1', seed: 4242, key_mode: 'trial', quota_day: '2026-10-08', model: 'flux-2-pro' })
    expect(ligne.json.generation.seed).toBe(4242)
    expect(ligne.prompt_text).toContain('Un chat roux.')
    expect(d.bfl.submit).toHaveBeenCalledWith({ apiKey: 'cle-jf', prompt: ligne.prompt_text, width: 1024, height: 1024, seed: 4242 })
    expect(d.repo.insertJob).toHaveBeenCalledWith(ID, 'https://api.eu.bfl.ai/v1/get_result?id=b1')
  })
  it('conserve la graine fournie et le format demandé', async () => {
    const g = gabarit()
    g.generation.seed = 7
    g.format.ratio = '16:9'
    const d = deps()
    await createGenerateHandler(d)(req({ gabarit: g }), makeRes())
    expect(d.bfl.submit.mock.calls[0][0]).toMatchObject({ seed: 7, width: 1344, height: 768 })
  })
  it('refuse quand la limite individuelle est atteinte (aucun appel BFL)', async () => {
    const d = deps({ repo: fakeRepo({ reserveQuota: vi.fn(async () => 'user_limit') }) })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(429)
    expect(res.body.code).toBe('quota_user')
    expect(d.bfl.submit).not.toHaveBeenCalled()
    expect(d.repo.insertGeneration).not.toHaveBeenCalled()
  })
  it('refuse quand le disjoncteur global est atteint', async () => {
    const d = deps({ repo: fakeRepo({ reserveQuota: vi.fn(async () => 'global_limit') }) })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(503)
    expect(res.body.code).toBe('quota_global')
  })
  it('rembourse les générations bloquées depuis plus de 5 minutes', async () => {
    const repo = fakeRepo({
      failStalePending: vi.fn(async () => [{ id: 'old1', quota_day: '2026-10-07' }, { id: 'old2', quota_day: null }]),
    })
    await createGenerateHandler(deps({ repo }))(req(), makeRes())
    expect(repo.failStalePending).toHaveBeenCalledWith('u1', new Date(NOW.getTime() - 5 * 60 * 1000).toISOString())
    expect(repo.refundQuota).toHaveBeenCalledWith('u1', '2026-10-07')
    expect(repo.refundQuota).not.toHaveBeenCalledWith('u1', null)
  })
  it('409 et remboursement quand une génération est déjà en cours', async () => {
    const repo = fakeRepo({ insertGeneration: vi.fn(async () => { throw Object.assign(new Error('busy'), { code: 'busy' }) }) })
    const d = deps({ repo })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(409)
    expect(res.body.code).toBe('busy')
    expect(repo.refundQuota).toHaveBeenCalledWith('u1', '2026-10-08')
    expect(d.bfl.submit).not.toHaveBeenCalled()
  })
  it('échec BFL : génération marquée échouée, quota remboursé, code traduit', async () => {
    const bfl = fakeBfl({ submit: vi.fn(async () => { throw new ProviderError('rate_limited', 'x', 429) }) })
    const d = deps({ bfl })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(429)
    expect(res.body.code).toBe('rate_limited')
    expect(d.repo.markFailed).toHaveBeenCalledWith(ID, 'failed')
    expect(d.repo.refundQuota).toHaveBeenCalledWith('u1', '2026-10-08')
  })
  it('clé de JF absente : erreur propre et remboursement', async () => {
    const d = deps({ env: {} })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(500)
    expect(d.repo.refundQuota).toHaveBeenCalled()
  })
})

describe('POST /api/generate : clé personnelle', () => {
  const avecCle = () => fakeRepo({
    getAccount: vi.fn(async () => ({ ...ACCOUNT, trial_started_at: '2026-09-01T00:00:00Z', has_own_key: true })),
    getKey: vi.fn(async () => ({ ciphertext: 'c', iv: 'i', secret_version: '1' })),
  })
  it('déchiffre la clé, ne touche pas au quota', async () => {
    const d = deps({ repo: avecCle() })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(202)
    expect(d.repo.reserveQuota).not.toHaveBeenCalled()
    expect(d.bfl.submit.mock.calls[0][0].apiKey).toBe('cle-perso')
    expect(d.repo.insertGeneration.mock.calls[0][0]).toMatchObject({ key_mode: 'own', quota_day: null })
  })
  it('clé illisible : message dédié, aucun appel BFL', async () => {
    const d = deps({ repo: avecCle(), dechiffrer: vi.fn(() => { throw new Error('boom') }) })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(500)
    expect(res.body.code).toBe('key_unreadable')
    expect(d.bfl.submit).not.toHaveBeenCalled()
  })
  it('clé refusée par BFL : 400 invalid_key', async () => {
    const bfl = fakeBfl({ submit: vi.fn(async () => { throw new ProviderError('invalid_key', 'x', 401) }) })
    const res = makeRes()
    await createGenerateHandler(deps({ repo: avecCle(), bfl }))(req(), res)
    expect(res.code).toBe(400)
    expect(res.body.code).toBe('invalid_key')
  })
})
