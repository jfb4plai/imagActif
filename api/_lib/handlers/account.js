export function createAccountHandler({ requireUser, repo }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Méthode non autorisée.' })
    const user = await requireUser(req, res)
    if (!user) return
    if (req.body?.confirm !== 'SUPPRIMER') {
      return res.status(400).json({ error: 'Confirmation manquante : tapez SUPPRIMER.', code: 'confirm' })
    }
    await repo.deleteAllUserData(user.id)
    return res.status(200).json({ deleted: true })
  }
}
