import { normaliserGabarit } from '../../../src/lib/gabarit.js'
import { determineRegime } from '../../../src/lib/regime.js'
import { jourBruxelles } from '../../../src/lib/dates.js'
import { TERMS_VERSION } from '../../../src/lib/terms.js'
import { limitsFromEnv } from '../../../src/lib/limits.js'
import { MESSAGES } from '../../../src/lib/messages.js'
import { ProviderError } from '../providers/bfl.js'
import { cleApi } from '../resolveKey.js'
import { UUID_RE } from '../uuid.js'

const STALE_MS = 5 * 60 * 1000
const STATUTS = { invalid_key: 400, no_credits: 402, rate_limited: 429, provider_error: 502 }
const LIEN_SECONDES = 300
const MIN_CONSIGNE = 3
const MAX_CONSIGNE = 500
const MAX_PERSONNALISE = 10

// Consigne de conservation envoyée à BFL (en anglais, langue où le modèle obéit le mieux) à la suite de la demande de changement.
export const SUFFIXE_RETOUCHE = 'Keep everything else exactly identical: the composition, the framing, the camera angle, the background, the lighting, the style and the colors.'

const echec = (res, status, code) => res.status(status).json({ error: MESSAGES[code], code })

export function createRetoucheHandler({
  requireUser, repo, bfl, dechiffrer, ring,
  env = process.env,
  now = () => new Date(),
}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
    const user = await requireUser(req, res)
    if (!user) return
    if (!user.email_confirmed_at) return echec(res, 403, 'email_unconfirmed')

    const account = await repo.getAccount(user.id)
    if (!account || account.terms_version !== TERMS_VERSION) return echec(res, 403, 'terms')

    const brute = req.body?.instruction
    const instruction = typeof brute === 'string' ? brute.trim() : ''
    if (instruction.length < MIN_CONSIGNE || instruction.length > MAX_CONSIGNE) {
      return res.status(400).json({ error: `Décrivez ce que vous voulez changer (${MIN_CONSIGNE} à ${MAX_CONSIGNE} caractères).`, code: 'invalid_json' })
    }

    const idSource = String(req.body?.sourceId ?? '')
    if (!UUID_RE.test(idSource)) return echec(res, 400, 'invalid_parent')
    const source = await repo.getGeneration(idSource, user.id)
    if (!source) return echec(res, 400, 'invalid_parent')
    if (source.status !== 'done' || !source.image_path) return echec(res, 400, 'source_indisponible')

    let gabarit
    try {
      gabarit = normaliserGabarit(source.json).gabarit
    } catch {
      return echec(res, 400, 'source_indisponible')
    }
    if (gabarit.personnalise.length < MAX_PERSONNALISE) gabarit.personnalise.push({ nom: 'Retouche', valeur: instruction })

    const maintenant = now()
    const regime = determineRegime({ trialStartedAt: account.trial_started_at, hasOwnKey: account.has_own_key, now: maintenant })
    if (regime === 'none') return echec(res, 403, 'trial_over')

    // Débloque et rembourse les générations restées « en cours » trop longtemps.
    const perimees = await repo.failStalePending(user.id, new Date(maintenant.getTime() - STALE_MS).toISOString())
    for (const p of perimees) if (p.quota_day) await repo.refundQuota(user.id, p.quota_day)

    let quotaDay = null
    if (regime === 'trial') {
      const limites = limitsFromEnv(env)
      quotaDay = jourBruxelles(maintenant)
      const reservation = await repo.reserveQuota(user.id, quotaDay, limites.user, limites.global)
      if (reservation === 'user_limit') return echec(res, 429, 'quota_user')
      if (reservation === 'global_limit') return echec(res, 503, 'quota_global')
    }
    const rembourser = async () => { if (quotaDay) await repo.refundQuota(user.id, quotaDay) }

    let apiKey
    try {
      apiKey = await cleApi({ keyMode: regime, userId: user.id, repo, dechiffrer, ring, env })
    } catch (err) {
      await rembourser()
      const code = err instanceof ProviderError && err.code !== 'invalid_key' ? err.code : 'key_unreadable'
      return echec(res, 500, code)
    }

    const promptText = `${instruction}. ${SUFFIXE_RETOUCHE}`

    let generation
    try {
      generation = await repo.insertGeneration({
        user_id: user.id, json: gabarit, prompt_text: promptText, seed: source.seed, model: bfl.model,
        key_mode: regime, quota_day: quotaDay, parent_id: source.id, edit_instruction: instruction,
      })
    } catch (err) {
      await rembourser()
      if (err.code === 'busy') return echec(res, 409, 'busy')
      throw err
    }

    try {
      const inputImageUrl = await repo.signedUrl(source.image_path, LIEN_SECONDES)
      const { pollingUrl } = await bfl.edit({ apiKey, prompt: promptText, inputImageUrl })
      await repo.insertJob(generation.id, pollingUrl)
      return res.status(202).json({ id: generation.id })
    } catch (err) {
      await repo.markFailed(generation.id, 'failed')
      await rembourser()
      if (err instanceof ProviderError) return echec(res, STATUTS[err.code] ?? 502, err.code)
      throw err
    }
  }
}
