import { vi } from 'vitest'
import { TERMS_VERSION } from '../src/lib/terms.js'

export const ID = '11111111-1111-4111-8111-111111111111'
export const NOW = new Date('2026-10-08T10:00:00Z')
export const USER = { id: 'u1', email: 'prof@exemple.be', email_confirmed_at: '2026-10-01T00:00:00Z' }

export function makeRes() {
  const res = { code: 200, body: undefined, headers: {} }
  res.status = (c) => { res.code = c; return res }
  res.json = (b) => { res.body = b; return res }
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

export const okAuth = async () => USER
export const noAuth = async (req, res) => { res.status(401).json({ error: 'Connexion requise.' }); return null }

export const ACCOUNT = {
  user_id: 'u1',
  trial_started_at: '2026-10-07T10:00:00Z',
  terms_version: TERMS_VERSION,
  has_own_key: false,
}

export function fakeRepo(over = {}) {
  return {
    getAccount: vi.fn(async () => ACCOUNT),
    failStalePending: vi.fn(async () => []),
    getKey: vi.fn(async () => null),
    reserveQuota: vi.fn(async () => 'ok'),
    refundQuota: vi.fn(async () => {}),
    getGeneration: vi.fn(async () => null),
    insertGeneration: vi.fn(async (row) => ({ id: ID, ...row })),
    insertJob: vi.fn(async () => {}),
    getJob: vi.fn(async () => null),
    deleteJob: vi.fn(async () => {}),
    markDone: vi.fn(async () => true),
    markFailed: vi.fn(async () => true),
    uploadImage: vi.fn(async () => {}),
    removeImages: vi.fn(async () => {}),
    deleteGeneration: vi.fn(async () => {}),
    deleteAllUserData: vi.fn(async () => {}),
    listOlderThan: vi.fn(async () => []),
    deleteGenerationsByIds: vi.fn(async () => {}),
    deleteTemplatesOlderThan: vi.fn(async () => 0),
    upsertAccount: vi.fn(async (userId, version) => ({ ...ACCOUNT, terms_version: version })),
    saveKey: vi.fn(async () => {}),
    deleteKey: vi.fn(async () => {}),
    ...over,
  }
}

export function fakeBfl(over = {}) {
  return {
    model: 'flux-2-pro',
    submit: vi.fn(async () => ({ id: 'b1', pollingUrl: 'https://api.eu.bfl.ai/v1/get_result?id=b1' })),
    poll: vi.fn(async () => ({ state: 'pending' })),
    download: vi.fn(async () => ({ buffer: Buffer.from([1, 2, 3]), contentType: 'image/png' })),
    ...over,
  }
}
