import { describe, it, expect, vi } from 'vitest'
import { createRetoucheHandler, SUFFIXE_RETOUCHE } from './retoucher.js'
import { makeRes, okAuth, noAuth, fakeRepo, fakeBfl, ACCOUNT, NOW, USER, ID } from '../../../tests/helpers.js'
import { gabaritVide } from '../../../src/lib/gabarit.js'
import { ProviderError } from '../providers/bfl.js'
import { MESSAGES } from '../../../src/lib/messages.js'

const SRC = '22222222-2222-4222-8222-222222222222'

function jsonSource(personnalise = []) {
  const g = gabaritVide()
  g.sujet.description = 'Un chat roux'
  g.generation.seed = 99
  g.personnalise = personnalise
  return g
}
const source = (over = {}) => ({
  id: SRC, user_id: 'u1', status: 'done', image_path: `u1/${SRC}.png`, seed: 99, json: jsonSource(), ...over,
})
const req = (body = { sourceId: SRC, instruction: 'Le chapeau devient jaune' }, method = 'POST') => ({ method, headers: {}, body })

function deps(over = {}) {
  const repo = over.repo ?? fakeRepo({ getGeneration: vi.fn(async () => source()) })
  return {
    requireUser: okAuth,
    bfl: fakeBfl(),
    dechiffrer: vi.fn(() => 'cle-perso'),
    ring: () => 'RING',
    env: { BFL_API_KEY: 'cle-jf' },
    now: () => NOW,
    ...over,
    repo,
  }
}
const lancer = async (d, r = req()) => { const res = makeRes(); await createRetoucheHandler(d)(r, res); return res }

describe('SUFFIXE_RETOUCHE', () => {
  it('demande de garder tout le reste identique', () => {
    expect(SUFFIXE_RETOUCHE).toBe('Keep everything else exactly identical: the composition, the framing, the camera angle, the background, the lighting, the style and the colors.')
  })
})

describe('POST /api/retoucher : garde-fous', () => {
  it('405 hors POST', async () => {
    expect((await lancer(deps(), req({}, 'GET'))).code).toBe(405)
  })
  it('401 sans session', async () => {
    const d = deps({ requireUser: noAuth })
    const res = await lancer(d)
    expect(res.code).toBe(401)
    expect(d.repo.getAccount).not.toHaveBeenCalled()
  })
  it("403 si l'e-mail n'est pas confirmé", async () => {
    const res = await lancer(deps({ requireUser: async () => ({ ...USER, email_confirmed_at: null }) }))
    expect(res.code).toBe(403)
    expect(res.body.code).toBe('email_unconfirmed')
  })
  it('403 sans compte ou avec un règlement ancien', async () => {
    for (const compte of [null, { ...ACCOUNT, terms_version: 'ancienne' }]) {
      const repo = fakeRepo({ getAccount: vi.fn(async () => compte) })
      const res = await lancer(deps({ repo }))
      expect(res.code).toBe(403)
      expect(res.body.code).toBe('terms')
    }
  })
  it('400 invalid_json si la consigne est absente, vide, trop courte, trop longue ou non textuelle', async () => {
    for (const instruction of [undefined, '', '   ', 'ab', '  a  ', 'x'.repeat(501), 42, { a: 1 }]) {
      const d = deps()
      const res = await lancer(d, req({ sourceId: SRC, instruction }))
      expect(res.code).toBe(400)
      expect(res.body.code).toBe('invalid_json')
      expect(res.body.error).toBe('Décrivez ce que vous voulez changer (3 à 500 caractères).')
      expect(d.repo.reserveQuota).not.toHaveBeenCalled()
      expect(d.bfl.edit).not.toHaveBeenCalled()
    }
  })
  it('accepte 3 et 500 caractères (après trim)', async () => {
    for (const instruction of ['  abc  ', 'x'.repeat(500)]) {
      const res = await lancer(deps(), req({ sourceId: SRC, instruction }))
      expect(res.code).toBe(202)
    }
  })
  it("400 invalid_parent si sourceId n'est pas un UUID, sans accès base", async () => {
    for (const sourceId of [undefined, 'autre', 12]) {
      const d = deps()
      const res = await lancer(d, req({ sourceId, instruction: 'Le chapeau devient jaune' }))
      expect(res.code).toBe(400)
      expect(res.body.code).toBe('invalid_parent')
      expect(d.repo.getGeneration).not.toHaveBeenCalled()
    }
  })
  it("400 invalid_parent si la source est introuvable ou d'un autre utilisateur", async () => {
    const repo = fakeRepo({ getGeneration: vi.fn(async () => null) })
    const d = deps({ repo })
    const res = await lancer(d)
    expect(res.code).toBe(400)
    expect(res.body.code).toBe('invalid_parent')
    expect(repo.getGeneration).toHaveBeenCalledWith(SRC, 'u1')
    expect(d.bfl.edit).not.toHaveBeenCalled()
  })
  it("400 source_indisponible si la source n'a plus d'image ou n'est pas terminée", async () => {
    for (const over of [{ image_path: null }, { status: 'pending' }, { status: 'failed' }, { status: 'refused' }]) {
      const repo = fakeRepo({ getGeneration: vi.fn(async () => source(over)) })
      const d = deps({ repo })
      const res = await lancer(d)
      expect(res.code).toBe(400)
      expect(res.body.code).toBe('source_indisponible')
      expect(res.body.error).toBe("Cette image n'est plus disponible (elle est supprimée au bout de 30 jours) : faites plutôt une variante ou refaites une image.")
      expect(repo.reserveQuota).not.toHaveBeenCalled()
      expect(repo.signedUrl).not.toHaveBeenCalled()
      expect(d.bfl.edit).not.toHaveBeenCalled()
    }
  })
  it('le message source_indisponible est dans MESSAGES', () => {
    expect(MESSAGES.source_indisponible).toMatch(/plus disponible/)
  })
  it('403 trial_over : essai terminé et pas de clé', async () => {
    const vieux = { ...ACCOUNT, trial_started_at: '2026-10-01T00:00:00Z' }
    const repo = fakeRepo({ getAccount: vi.fn(async () => vieux), getGeneration: vi.fn(async () => source()) })
    const d = deps({ repo })
    const res = await lancer(d)
    expect(res.code).toBe(403)
    expect(res.body.code).toBe('trial_over')
    expect(d.bfl.edit).not.toHaveBeenCalled()
  })
})

describe('POST /api/retoucher : essai', () => {
  it("réserve le quota, signe l'image 300 s, appelle bfl.edit et insère la ligne", async () => {
    const d = deps()
    const res = await lancer(d)
    expect(res.code).toBe(202)
    expect(res.body).toEqual({ id: ID })
    expect(d.repo.reserveQuota).toHaveBeenCalledWith('u1', '2026-10-08', 10, 100)
    expect(d.repo.signedUrl).toHaveBeenCalledWith(`u1/${SRC}.png`, 300)
    const prompt = `Le chapeau devient jaune. ${SUFFIXE_RETOUCHE}`
    expect(d.bfl.edit).toHaveBeenCalledWith({ apiKey: 'cle-jf', prompt, inputImageUrl: 'https://signed.example/x' })
    const ligne = d.repo.insertGeneration.mock.calls[0][0]
    expect(ligne).toMatchObject({
      user_id: 'u1', prompt_text: prompt, seed: 99, model: 'flux-2-pro', key_mode: 'trial',
      quota_day: '2026-10-08', parent_id: SRC, edit_instruction: 'Le chapeau devient jaune',
    })
    expect(ligne.json.sujet.description).toBe('Un chat roux')
    expect(ligne.json.personnalise).toEqual([{ nom: 'Retouche', valeur: 'Le chapeau devient jaune' }])
    expect(d.repo.insertJob).toHaveBeenCalledWith(ID, 'https://api.eu.bfl.ai/v1/get_result?id=b2')
    expect(d.bfl.submit).not.toHaveBeenCalled()
  })
  it('la consigne est nettoyée par trim dans le prompt et la ligne', async () => {
    const d = deps()
    await lancer(d, req({ sourceId: SRC, instruction: '  Le ciel devient rose  ' }))
    const ligne = d.repo.insertGeneration.mock.calls[0][0]
    expect(ligne.edit_instruction).toBe('Le ciel devient rose')
    expect(ligne.prompt_text).toBe(`Le ciel devient rose. ${SUFFIXE_RETOUCHE}`)
  })
  it("ajoute l'entrée Retouche à la suite des champs personnalisés existants", async () => {
    const existant = [{ nom: 'Ambiance', valeur: 'douce' }]
    const repo = fakeRepo({ getGeneration: vi.fn(async () => source({ json: jsonSource(existant) })) })
    const d = deps({ repo })
    await lancer(d)
    expect(repo.insertGeneration.mock.calls[0][0].json.personnalise).toEqual([...existant, { nom: 'Retouche', valeur: 'Le chapeau devient jaune' }])
  })
  it('laisse le JSON inchangé quand personnalise compte déjà 10 entrées', async () => {
    const dix = Array.from({ length: 10 }, (_, i) => ({ nom: `n${i}`, valeur: `v${i}` }))
    const repo = fakeRepo({ getGeneration: vi.fn(async () => source({ json: jsonSource(dix) })) })
    const d = deps({ repo })
    await lancer(d)
    expect(repo.insertGeneration.mock.calls[0][0].json.personnalise).toEqual(dix)
  })
  it("refuse quand la limite individuelle est atteinte (aucun appel BFL ni lien signé)", async () => {
    const repo = fakeRepo({ getGeneration: vi.fn(async () => source()), reserveQuota: vi.fn(async () => 'user_limit') })
    const d = deps({ repo })
    const res = await lancer(d)
    expect(res.code).toBe(429)
    expect(res.body.code).toBe('quota_user')
    expect(d.bfl.edit).not.toHaveBeenCalled()
    expect(repo.insertGeneration).not.toHaveBeenCalled()
  })
  it('refuse quand le disjoncteur global est atteint', async () => {
    const repo = fakeRepo({ getGeneration: vi.fn(async () => source()), reserveQuota: vi.fn(async () => 'global_limit') })
    const res = await lancer(deps({ repo }))
    expect(res.code).toBe(503)
    expect(res.body.code).toBe('quota_global')
  })
  it('rembourse les générations bloquées depuis plus de 5 minutes', async () => {
    const repo = fakeRepo({
      getGeneration: vi.fn(async () => source()),
      failStalePending: vi.fn(async () => [{ id: 'old1', quota_day: '2026-10-07' }, { id: 'old2', quota_day: null }]),
    })
    await lancer(deps({ repo }))
    expect(repo.failStalePending).toHaveBeenCalledWith('u1', new Date(NOW.getTime() - 5 * 60 * 1000).toISOString())
    expect(repo.refundQuota).toHaveBeenCalledWith('u1', '2026-10-07')
    expect(repo.refundQuota).not.toHaveBeenCalledWith('u1', null)
  })
  it('409 et remboursement quand une génération est déjà en cours', async () => {
    const repo = fakeRepo({
      getGeneration: vi.fn(async () => source()),
      insertGeneration: vi.fn(async () => { throw Object.assign(new Error('busy'), { code: 'busy' }) }),
    })
    const d = deps({ repo })
    const res = await lancer(d)
    expect(res.code).toBe(409)
    expect(res.body.code).toBe('busy')
    expect(repo.refundQuota).toHaveBeenCalledWith('u1', '2026-10-08')
    expect(d.bfl.edit).not.toHaveBeenCalled()
  })
  it('échec BFL : génération marquée échouée, quota remboursé, code traduit', async () => {
    const bfl = fakeBfl({ edit: vi.fn(async () => { throw new ProviderError('rate_limited', 'x', 429) }) })
    const d = deps({ bfl })
    const res = await lancer(d)
    expect(res.code).toBe(429)
    expect(res.body.code).toBe('rate_limited')
    expect(d.repo.markFailed).toHaveBeenCalledWith(ID, 'failed')
    expect(d.repo.refundQuota).toHaveBeenCalledWith('u1', '2026-10-08')
    expect(d.repo.insertJob).not.toHaveBeenCalled()
  })
  it('échec de signature du lien : génération marquée échouée et quota remboursé', async () => {
    const repo = fakeRepo({ getGeneration: vi.fn(async () => source()), signedUrl: vi.fn(async () => { throw new Error('storage') }) })
    const d = deps({ repo })
    await expect(createRetoucheHandler(d)(req(), makeRes())).rejects.toThrow('storage')
    expect(repo.markFailed).toHaveBeenCalledWith(ID, 'failed')
    expect(repo.refundQuota).toHaveBeenCalledWith('u1', '2026-10-08')
    expect(d.bfl.edit).not.toHaveBeenCalled()
  })
  it('clé de JF absente : erreur propre et remboursement', async () => {
    const d = deps({ env: {} })
    const res = await lancer(d)
    expect(res.code).toBe(500)
    expect(d.repo.refundQuota).toHaveBeenCalled()
    expect(d.bfl.edit).not.toHaveBeenCalled()
  })
})

describe('POST /api/retoucher : clé personnelle', () => {
  const avecCle = () => fakeRepo({
    getAccount: vi.fn(async () => ({ ...ACCOUNT, trial_started_at: '2026-09-01T00:00:00Z', has_own_key: true })),
    getKey: vi.fn(async () => ({ ciphertext: 'c', iv: 'i', secret_version: '1' })),
    getGeneration: vi.fn(async () => source()),
  })
  it('déchiffre la clé, ne touche pas au quota', async () => {
    const d = deps({ repo: avecCle() })
    const res = await lancer(d)
    expect(res.code).toBe(202)
    expect(d.repo.reserveQuota).not.toHaveBeenCalled()
    expect(d.bfl.edit.mock.calls[0][0].apiKey).toBe('cle-perso')
    expect(d.repo.insertGeneration.mock.calls[0][0]).toMatchObject({ key_mode: 'own', quota_day: null, parent_id: SRC })
  })
  it('clé illisible : message dédié, aucun appel BFL', async () => {
    const d = deps({ repo: avecCle(), dechiffrer: vi.fn(() => { throw new Error('boom') }) })
    const res = await lancer(d)
    expect(res.code).toBe(500)
    expect(res.body.code).toBe('key_unreadable')
    expect(d.bfl.edit).not.toHaveBeenCalled()
  })
  it('clé refusée par BFL : 400 invalid_key, pas de remboursement de quota', async () => {
    const bfl = fakeBfl({ edit: vi.fn(async () => { throw new ProviderError('invalid_key', 'x', 401) }) })
    const d = deps({ repo: avecCle(), bfl })
    const res = await lancer(d)
    expect(res.code).toBe(400)
    expect(res.body.code).toBe('invalid_key')
    expect(d.repo.refundQuota).not.toHaveBeenCalled()
  })
})
