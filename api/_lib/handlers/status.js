import { imageExpiry } from '../../../src/lib/dates.js'
import { ProviderError, extensionFor } from '../providers/bfl.js'
import { cleApi } from '../resolveKey.js'

export function createStatusHandler({ requireUser, repo, bfl, dechiffrer, ring, env = process.env, now = () => new Date() }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée.' })
    const user = await requireUser(req, res)
    if (!user) return
    const id = String(req.query?.id ?? '')
    if (!id) return res.status(400).json({ error: 'Identifiant manquant.' })

    const gen = await repo.getGeneration(id, user.id)
    if (!gen) return res.status(404).json({ error: 'Image introuvable.' })
    if (gen.status !== 'pending') return res.status(200).json({ status: gen.status })

    const echouer = async (statut) => {
      await repo.markFailed(gen.id, statut)
      await repo.deleteJob(gen.id)
      if (gen.quota_day) await repo.refundQuota(user.id, gen.quota_day)
      return res.status(200).json({ status: statut })
    }

    const job = await repo.getJob(gen.id)
    if (!job) return echouer('failed')

    let etat
    try {
      const apiKey = await cleApi({ keyMode: gen.key_mode, userId: user.id, repo, dechiffrer, ring, env })
      etat = await bfl.poll({ apiKey, pollingUrl: job.polling_url })
    } catch (err) {
      if (err instanceof ProviderError && err.code === 'invalid_key') return echouer('failed')
      return res.status(200).json({ status: 'pending' }) // panne passagère : le client réessaie
    }

    if (etat.state === 'pending') return res.status(200).json({ status: 'pending' })
    if (etat.state === 'refused') return echouer('refused')
    if (etat.state === 'failed') return echouer('failed')

    try {
      const { buffer, contentType } = await bfl.download(etat.sampleUrl)
      const chemin = `${user.id}/${gen.id}.${extensionFor(contentType)}`
      await repo.uploadImage(chemin, buffer, contentType)
      await repo.markDone(gen.id, chemin, imageExpiry(now()).toISOString())
      await repo.deleteJob(gen.id)
      return res.status(200).json({ status: 'done' })
    } catch {
      return res.status(200).json({ status: 'pending' }) // le lien BFL reste valable 10 minutes : nouvel essai au prochain tour
    }
  }
}
