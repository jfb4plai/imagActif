import { describe, it, expect, vi } from 'vitest'
import { createStatusHandler } from './status.js'
import { makeRes, okAuth, noAuth, fakeRepo, fakeBfl, NOW } from '../../../tests/helpers.js'
import { ProviderError } from '../providers/bfl.js'

const GEN = { id: 'g1', user_id: 'u1', status: 'pending', key_mode: 'trial', quota_day: '2026-10-08' }
const JOB = { generation_id: 'g1', polling_url: 'https://api.eu.bfl.ai/v1/get_result?id=b1' }
const req = (id = 'g1', method = 'GET') => ({ method, headers: {}, query: { id } })

function deps(over = {}, repoOver = {}) {
  return {
    requireUser: okAuth,
    repo: fakeRepo({ getGeneration: vi.fn(async () => GEN), getJob: vi.fn(async () => JOB), ...repoOver }),
    bfl: fakeBfl(),
    dechiffrer: vi.fn(() => 'cle-perso'),
    ring: () => 'RING',
    env: { BFL_API_KEY: 'cle-jf' },
    now: () => NOW,
    ...over,
  }
}

describe('GET /api/status', () => {
  it('401 sans session, 405 hors GET, 400 sans id', async () => {
    let res = makeRes()
    await createStatusHandler(deps({ requireUser: noAuth }))(req(), res)
    expect(res.code).toBe(401)
    res = makeRes()
    await createStatusHandler(deps())(req('g1', 'POST'), res)
    expect(res.code).toBe(405)
    res = makeRes()
    await createStatusHandler(deps())({ method: 'GET', headers: {}, query: {} }, res)
    expect(res.code).toBe(400)
  })
  it('404 pour une image qui n\'est pas à l\'utilisateur', async () => {
    const res = makeRes()
    await createStatusHandler(deps({}, { getGeneration: vi.fn(async () => null) }))(req(), res)
    expect(res.code).toBe(404)
  })
  it('renvoie directement le statut final déjà connu', async () => {
    const d = deps({}, { getGeneration: vi.fn(async () => ({ ...GEN, status: 'done' })) })
    const res = makeRes()
    await createStatusHandler(d)(req(), res)
    expect(res.body).toEqual({ status: 'done' })
    expect(d.bfl.poll).not.toHaveBeenCalled()
  })
  it('reste en cours tant que BFL n\'a pas fini', async () => {
    const res = makeRes()
    await createStatusHandler(deps())(req(), res)
    expect(res.body).toEqual({ status: 'pending' })
  })
  it('prête : télécharge, dépose le fichier, fixe l\'échéance à 30 jours', async () => {
    const bfl = fakeBfl({ poll: vi.fn(async () => ({ state: 'ready', sampleUrl: 'https://delivery.bfl.ai/x.png' })) })
    const d = deps({ bfl })
    const res = makeRes()
    await createStatusHandler(d)(req(), res)
    expect(res.body).toEqual({ status: 'done' })
    expect(bfl.poll).toHaveBeenCalledWith({ apiKey: 'cle-jf', pollingUrl: JOB.polling_url })
    expect(d.repo.uploadImage).toHaveBeenCalledWith('u1/g1.png', expect.any(Buffer), 'image/png')
    expect(d.repo.markDone).toHaveBeenCalledWith('g1', 'u1/g1.png', '2026-11-07T10:00:00.000Z')
    expect(d.repo.deleteJob).toHaveBeenCalledWith('g1')
  })
  it('refus de modération : échec, quota remboursé', async () => {
    const bfl = fakeBfl({ poll: vi.fn(async () => ({ state: 'refused' })) })
    const d = deps({ bfl })
    const res = makeRes()
    await createStatusHandler(d)(req(), res)
    expect(res.body).toEqual({ status: 'refused' })
    expect(d.repo.markFailed).toHaveBeenCalledWith('g1', 'refused')
    expect(d.repo.refundQuota).toHaveBeenCalledWith('u1', '2026-10-08')
  })
  it('échec BFL en clé personnelle : pas de remboursement', async () => {
    const bfl = fakeBfl({ poll: vi.fn(async () => ({ state: 'failed' })) })
    const d = deps({ bfl }, { getGeneration: vi.fn(async () => ({ ...GEN, key_mode: 'own', quota_day: null })), getKey: vi.fn(async () => ({ ciphertext: 'c', iv: 'i', secret_version: '1' })) })
    const res = makeRes()
    await createStatusHandler(d)(req(), res)
    expect(res.body).toEqual({ status: 'failed' })
    expect(d.repo.refundQuota).not.toHaveBeenCalled()
    expect(bfl.poll.mock.calls[0][0].apiKey).toBe('cle-perso')
  })
  it('tâche introuvable : marquée échouée', async () => {
    const d = deps({}, { getJob: vi.fn(async () => null) })
    const res = makeRes()
    await createStatusHandler(d)(req(), res)
    expect(res.body).toEqual({ status: 'failed' })
    expect(d.repo.markFailed).toHaveBeenCalledWith('g1', 'failed')
  })
  it('erreur réseau passagère : reste en cours', async () => {
    const bfl = fakeBfl({ poll: vi.fn(async () => { throw new ProviderError('provider_error', 'x', 500) }) })
    const res = makeRes()
    await createStatusHandler(deps({ bfl }))(req(), res)
    expect(res.body).toEqual({ status: 'pending' })
  })
  it('clé refusée pendant le suivi : échec définitif', async () => {
    const bfl = fakeBfl({ poll: vi.fn(async () => { throw new ProviderError('invalid_key', 'x', 401) }) })
    const res = makeRes()
    await createStatusHandler(deps({ bfl }))(req(), res)
    expect(res.body).toEqual({ status: 'failed' })
  })
  it('téléchargement impossible : réessai au tour suivant', async () => {
    const bfl = fakeBfl({
      poll: vi.fn(async () => ({ state: 'ready', sampleUrl: 'https://delivery.bfl.ai/x.png' })),
      download: vi.fn(async () => { throw new ProviderError('provider_error', 'x') }),
    })
    const d = deps({ bfl })
    const res = makeRes()
    await createStatusHandler(d)(req(), res)
    expect(res.body).toEqual({ status: 'pending' })
    expect(d.repo.markDone).not.toHaveBeenCalled()
  })
})
