import { verifierCron } from '../cronAuth.js'
import { JSON_RETENTION_DAYS } from '../../../src/lib/dates.js'

const LOT = 100
const MAX_LOTS = 5
const PERIME_MS = 15 * 60 * 1000
const JOUR_MS = 86400000

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

  // Descriptions (JSON) et modèles : suppression 1 an après leur création.
  const limiteJson = new Date(now.getTime() - JSON_RETENTION_DAYS * JOUR_MS).toISOString()
  let jsonSupprimes = 0
  for (let i = 0; i < MAX_LOTS; i++) {
    const lot = await repo.listOlderThan(limiteJson, LOT)
    if (!lot.length) break
    await repo.removeImages(lot.map((g) => g.image_path).filter(Boolean)) // d'abord les fichiers éventuels
    await repo.deleteGenerationsByIds(lot.map((g) => g.id))
    jsonSupprimes += lot.length
  }
  const modelesSupprimes = await repo.deleteTemplatesOlderThan(limiteJson)

  return { imagesSupprimees, echecsNettoyes: perimees.length, jsonSupprimes, modelesSupprimes }
}

export function createCleanupHandler({ repo, secret, now = () => new Date() }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
    if (!verifierCron(req.headers?.authorization, secret)) return res.status(401).json({ error: 'Non autorisé.' })
    return res.status(200).json(await runCleanup({ repo, now: now() }))
  }
}
