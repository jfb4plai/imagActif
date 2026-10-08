import { createHash } from 'node:crypto'
import { createBfl, extensionFor } from '../api/_lib/providers/bfl.js'

const apiKey = process.env.BFL_API_KEY
if (!apiKey) throw new Error('BFL_API_KEY manquante (.env.local).')

const bfl = createBfl({ baseUrl: process.env.BFL_BASE_URL || undefined, model: process.env.BFL_MODEL || undefined })
const params = { apiKey, prompt: 'Un chat roux qui dort sur un rebord de fenêtre. Style : aquarelle. À éviter : pas de texte dans l\'image.', width: 1024, height: 1024, seed: 42 }

async function generer() {
  const { pollingUrl } = await bfl.submit(params)
  console.log('polling_url :', new URL(pollingUrl).hostname)
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const etat = await bfl.poll({ apiKey, pollingUrl })
    if (etat.state === 'ready') {
      const { buffer, contentType } = await bfl.download(etat.sampleUrl)
      console.log('type :', contentType, '| extension :', extensionFor(contentType), '| octets :', buffer.length)
      return createHash('sha256').update(buffer).digest('hex')
    }
    if (etat.state !== 'pending') throw new Error(`Etat final : ${etat.state}`)
  }
  throw new Error('Délai dépassé (3 minutes).')
}

const a = await generer()
const b = await generer()
console.log(a === b ? 'Graine reproductible : OUI (images identiques)' : 'Graine reproductible : NON (images différentes) -> adapter le texte d\'aide du champ graine')
