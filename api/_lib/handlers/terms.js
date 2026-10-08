import { TERMS_VERSION } from '../../../src/lib/terms.js'

export function createTermsHandler({ requireUser, repo, now = () => new Date() }) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
    const user = await requireUser(req, res)
    if (!user) return
    if (req.body?.version !== TERMS_VERSION) {
      return res.status(400).json({ error: 'Version du règlement inconnue.', code: 'terms_version' })
    }
    const account = await repo.upsertAccount(user.id, TERMS_VERSION, now().toISOString())
    return res.status(200).json({ account })
  }
}
