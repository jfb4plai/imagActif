import { verifierCron } from '../cronAuth.js'

const LOT = 100
const MAX_LOTS = 5
const PERIME_MS = 15 * 60 * 1000

export async function runCleanup({ repo, now = new Date() }) {
  const nowIso = now.toISOString()
  let imagesSupprimees = 0
  for (let i = 0; i < MAX_LOTS; i++) {
    const lot = await repo.listExpired(nowIso, LOT)
    if (!lot.length) break
    await repo.removeImages(lot.map((g) => g.image_path)) // d'abord les fichiers : si ça échoue, rien n'est marqué
    await repo.markImagesDeleted(lot.map((g) => g.id), nowIso)
    imagesSupprimees += lot.length
  }
  const perimees = await repo.failStaleAll(new Date(now.getTime() - PERIME_MS).toISOString())
  for (const p of perimees) if (p.quota_day) await repo.refundQuota(p.user_id, p.quota_day)
  return { imagesSupprimees, echecsNettoyes: perimees.length }
}

export function createCleanupHandler({ repo, secret, now = () => new Date() }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
    if (!verifierCron(req.headers?.authorization, secret)) return res.status(401).json({ error: 'Non autorisé.' })
    return res.status(200).json(await runCleanup({ repo, now: now() }))
  }
}
