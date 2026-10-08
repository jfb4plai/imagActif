import { describe, it, expect, vi } from 'vitest'
import { createBfl, ProviderError, extensionFor } from './bfl.js'

const reponse = (corps, { status = 200, headers = {} } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => corps,
  arrayBuffer: async () => (corps instanceof Uint8Array ? corps.buffer : new ArrayBuffer(0)),
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
})

describe('bfl.submit', () => {
  it('envoie la requête attendue sur l\'endpoint UE', async () => {
    const fetchImpl = vi.fn(async () => reponse({ id: 'abc', polling_url: 'https://api.eu.bfl.ai/v1/get_result?id=abc' }))
    const bfl = createBfl({ fetchImpl })
    const r = await bfl.submit({ apiKey: 'K', prompt: 'un chat', width: 1024, height: 1024, seed: 7 })
    expect(r).toEqual({ id: 'abc', pollingUrl: 'https://api.eu.bfl.ai/v1/get_result?id=abc' })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.eu.bfl.ai/v1/flux-2-pro')
    expect(init.headers['x-key']).toBe('K')
    expect(JSON.parse(init.body)).toEqual({ prompt: 'un chat', width: 1024, height: 1024, seed: 7 })
  })
  it('traduit les erreurs HTTP', async () => {
    const cas = [[401, 'invalid_key'], [403, 'invalid_key'], [402, 'no_credits'], [429, 'rate_limited'], [500, 'provider_error']]
    for (const [status, code] of cas) {
      const bfl = createBfl({ fetchImpl: async () => reponse({}, { status }) })
      await expect(bfl.submit({ apiKey: 'K', prompt: 'p', width: 1, height: 1, seed: 1 })).rejects.toMatchObject({ code })
    }
  })
  it('traite une clé mal formée (422 « Invalid API key format ») comme une clé refusée', async () => {
    const mal = createBfl({ fetchImpl: async () => ({ ...reponse({ detail: 'Invalid API key format' }, { status: 422 }), text: async () => '{"detail":"Invalid API key format"}' }) })
    await expect(mal.submit({ apiKey: 'K', prompt: 'p', width: 1, height: 1, seed: 1 })).rejects.toMatchObject({ code: 'invalid_key' })
    const autre = createBfl({ fetchImpl: async () => ({ ...reponse({}, { status: 422 }), text: async () => '{"detail":"width must be a multiple of 16"}' }) })
    await expect(autre.submit({ apiKey: 'K', prompt: 'p', width: 1, height: 1, seed: 1 })).rejects.toMatchObject({ code: 'provider_error' })
  })
  it('refuse une polling_url hors du domaine bfl.ai (la clé ne doit jamais fuiter)', async () => {
    const bfl = createBfl({ fetchImpl: async () => reponse({ id: '1', polling_url: 'https://evil.example.com/x' }) })
    await expect(bfl.submit({ apiKey: 'K', prompt: 'p', width: 1, height: 1, seed: 1 })).rejects.toBeInstanceOf(ProviderError)
  })
  it('refuse une réponse sans polling_url', async () => {
    const bfl = createBfl({ fetchImpl: async () => reponse({ id: '1' }) })
    await expect(bfl.submit({ apiKey: 'K', prompt: 'p', width: 1, height: 1, seed: 1 })).rejects.toMatchObject({ code: 'provider_error' })
  })
})

describe('bfl.poll', () => {
  const poll = (corps) => createBfl({ fetchImpl: async () => reponse(corps) }).poll({ apiKey: 'K', pollingUrl: 'https://api.eu.bfl.ai/v1/get_result?id=1' })
  it('traduit les statuts', async () => {
    expect(await poll({ status: 'Ready', result: { sample: 'https://delivery.bfl.ai/x.jpg' } })).toEqual({ state: 'ready', sampleUrl: 'https://delivery.bfl.ai/x.jpg' })
    expect(await poll({ status: 'Pending' })).toEqual({ state: 'pending' })
    expect(await poll({ status: 'Request Moderated' })).toEqual({ state: 'refused' })
    expect(await poll({ status: 'Content Moderated' })).toEqual({ state: 'refused' })
    expect(await poll({ status: 'Error' })).toEqual({ state: 'failed' })
    expect(await poll({ status: 'Failed' })).toEqual({ state: 'failed' })
    expect(await poll({ status: 'Task not found' })).toEqual({ state: 'failed' })
  })
  it('envoie la clé et refuse un domaine étranger', async () => {
    const fetchImpl = vi.fn(async () => reponse({ status: 'Pending' }))
    const bfl = createBfl({ fetchImpl })
    await bfl.poll({ apiKey: 'K', pollingUrl: 'https://api.eu.bfl.ai/v1/get_result?id=1' })
    expect(fetchImpl.mock.calls[0][1].headers['x-key']).toBe('K')
    await expect(bfl.poll({ apiKey: 'K', pollingUrl: 'https://evil.example.com/x' })).rejects.toBeInstanceOf(ProviderError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('bfl.download', () => {
  it('télécharge sans envoyer la clé', async () => {
    const fetchImpl = vi.fn(async () => reponse(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }))
    const r = await createBfl({ fetchImpl }).download('https://delivery.bfl.ai/x.png')
    expect(r.contentType).toBe('image/png')
    expect(r.buffer.length).toBe(3)
    expect(fetchImpl.mock.calls[0][1]).toBeUndefined()
  })
  it('refuse un contenu qui n\'est pas une image', async () => {
    const fetchImpl = vi.fn(async () => reponse(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'text/html' } }))
    await expect(createBfl({ fetchImpl }).download('https://delivery.bfl.ai/x.png')).rejects.toMatchObject({ code: 'provider_error' })
  })
  it('refuse http', async () => {
    await expect(createBfl({ fetchImpl: vi.fn() }).download('http://x.example/y.png')).rejects.toBeInstanceOf(ProviderError)
  })
})

describe('extensionFor', () => {
  it('déduit l\'extension du type de contenu', () => {
    expect(extensionFor('image/png')).toBe('png')
    expect(extensionFor('image/jpeg')).toBe('jpg')
    expect(extensionFor('image/webp')).toBe('webp')
    expect(extensionFor('application/octet-stream')).toBe('jpg')
  })
})
