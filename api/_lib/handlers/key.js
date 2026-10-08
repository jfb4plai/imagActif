import { MESSAGES } from '../../../src/lib/messages.js'

const FORME_CLE = /^[A-Za-z0-9_.-]{16,200}$/

export function createKeyHandler({ requireUser, repo, chiffrer, ring }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'PUT' && req.method !== 'DELETE') return res.status(405).json({ error: 'Méthode non autorisée.' })
    const user = await requireUser(req, res)
    if (!user) return

    if (req.method === 'DELETE') {
      await repo.deleteKey(user.id)
      return res.status(200).json({ hasOwnKey: false })
    }

    const brute = req.body?.key
    const cle = typeof brute === 'string' ? brute.trim() : ''
    if (!FORME_CLE.test(cle)) {
      return res.status(400).json({ error: 'Cette clé n\'a pas la forme attendue : collez-la sans espace.', code: 'invalid_key_format' })
    }
    const account = await repo.getAccount(user.id)
    if (!account) return res.status(403).json({ error: MESSAGES.terms, code: 'terms' })

    await repo.saveKey(user.id, chiffrer(cle, user.id, ring()))
    return res.status(200).json({ hasOwnKey: true })
  }
}
