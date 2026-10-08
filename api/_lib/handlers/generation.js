export function createGenerationHandler({ requireUser, repo }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Méthode non autorisée.' })
    const user = await requireUser(req, res)
    if (!user) return
    const id = String(req.query?.id ?? '')
    if (!id) return res.status(400).json({ error: 'Identifiant manquant.' })
    const gen = await repo.getGeneration(id, user.id)
    if (!gen) return res.status(404).json({ error: 'Image introuvable.' })
    if (gen.image_path) await repo.removeImages([gen.image_path]) // le fichier d'abord : sans la ligne, on ne saurait plus où il est
    await repo.deleteGeneration(gen.id, user.id)
    return res.status(200).json({ deleted: true })
  }
}
