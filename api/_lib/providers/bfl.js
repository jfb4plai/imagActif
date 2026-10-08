// Seul fichier qui connaît BFL. Un autre fournisseur = un autre fichier avec les mêmes trois méthodes.
export class ProviderError extends Error {
  constructor(code, message, status) {
    super(message)
    this.code = code
    this.status = status
  }
}

const MAX_OCTETS = 20 * 1024 * 1024

function erreurHttp(status) {
  if (status === 401 || status === 403) return new ProviderError('invalid_key', 'Clé refusée par BFL.', status)
  if (status === 402) return new ProviderError('no_credits', 'Crédits BFL épuisés.', status)
  if (status === 429) return new ProviderError('rate_limited', 'Trop de demandes chez BFL.', status)
  return new ProviderError('provider_error', `BFL a répondu ${status}.`, status)
}

// La clé est envoyée à cette URL : elle doit rester dans le domaine bfl.ai.
function verifierUrlBfl(valeur) {
  let url
  try { url = new URL(valeur) } catch { throw new ProviderError('provider_error', 'URL de suivi invalide.') }
  const hoteOk = url.hostname === 'bfl.ai' || url.hostname.endsWith('.bfl.ai')
  if (url.protocol !== 'https:' || !hoteOk) throw new ProviderError('provider_error', 'URL de suivi hors du domaine BFL.')
}

export function extensionFor(contentType) {
  if (contentType?.includes('png')) return 'png'
  if (contentType?.includes('webp')) return 'webp'
  return 'jpg'
}

export function createBfl({ fetchImpl = fetch, baseUrl = 'https://api.eu.bfl.ai', model = 'flux-2-pro' } = {}) {
  async function submit({ apiKey, prompt, width, height, seed }) {
    const resp = await fetchImpl(`${baseUrl}/v1/${model}`, {
      method: 'POST',
      headers: { accept: 'application/json', 'Content-Type': 'application/json', 'x-key': apiKey },
      body: JSON.stringify({ prompt, width, height, seed }),
    })
    if (!resp.ok) throw erreurHttp(resp.status)
    const data = await resp.json()
    if (!data?.id || !data?.polling_url) throw new ProviderError('provider_error', 'Réponse BFL inattendue.')
    verifierUrlBfl(data.polling_url)
    return { id: data.id, pollingUrl: data.polling_url }
  }

  async function poll({ apiKey, pollingUrl }) {
    verifierUrlBfl(pollingUrl)
    const resp = await fetchImpl(pollingUrl, { headers: { accept: 'application/json', 'x-key': apiKey } })
    if (!resp.ok) throw erreurHttp(resp.status)
    const data = await resp.json()
    switch (data.status) {
      case 'Ready': {
        const sampleUrl = data.result?.sample
        if (!sampleUrl) throw new ProviderError('provider_error', 'Image absente de la réponse.')
        return { state: 'ready', sampleUrl }
      }
      case 'Request Moderated':
      case 'Content Moderated':
        return { state: 'refused' }
      case 'Error':
      case 'Failed':
      case 'Task not found':
        return { state: 'failed' }
      default:
        return { state: 'pending' }
    }
  }

  // Le lien de livraison expire au bout de 10 minutes : télécharger tout de suite.
  async function download(valeur) {
    if (new URL(valeur).protocol !== 'https:') throw new ProviderError('provider_error', 'Lien de téléchargement non sécurisé.')
    const resp = await fetchImpl(valeur)
    if (!resp.ok) throw new ProviderError('provider_error', `Téléchargement impossible (${resp.status}).`)
    const type = resp.headers.get('content-type')
    if (type && !type.startsWith('image/')) throw new ProviderError('provider_error', 'Le lien ne renvoie pas une image.')
    const buffer = Buffer.from(await resp.arrayBuffer())
    if (buffer.length > MAX_OCTETS) throw new ProviderError('provider_error', 'Image trop volumineuse.')
    return { buffer, contentType: type || 'image/jpeg' }
  }

  return { model, submit, poll, download }
}

export const bfl = createBfl({
  baseUrl: process.env.BFL_BASE_URL || undefined,
  model: process.env.BFL_MODEL || undefined,
})
