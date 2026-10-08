import { ProviderError } from './providers/bfl.js'

// Clé BFL à utiliser pour une génération : celle de JF (essai) ou celle de l'enseignant (déchiffrée en mémoire).
export async function cleApi({ keyMode, userId, repo, dechiffrer, ring, env }) {
  if (keyMode === 'trial') {
    if (!env.BFL_API_KEY) throw new ProviderError('provider_error', 'BFL_API_KEY manquante.')
    return env.BFL_API_KEY
  }
  const rec = await repo.getKey(userId)
  if (!rec) throw new ProviderError('invalid_key', 'Aucune clé enregistrée.')
  return dechiffrer(rec, userId, ring())
}
