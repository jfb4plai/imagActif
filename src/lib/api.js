import { supabase } from './supabaseClient.js'
import { TERMS_VERSION } from './terms.js'

async function appeler(chemin, { method = 'GET', body } = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const resp = await fetch(chemin, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const erreur = new Error(data.error || 'Erreur')
    erreur.code = data.code
    erreur.status = resp.status
    throw erreur
  }
  return data
}

export const api = {
  accepterReglement: () => appeler('/api/terms', { method: 'POST', body: { version: TERMS_VERSION } }),
  generer: (gabarit, parentId) => appeler('/api/generate', { method: 'POST', body: { gabarit, parentId } }),
  retoucher: (sourceId, instruction) => appeler('/api/retoucher', { method: 'POST', body: { sourceId, instruction } }),
  statut: (id) => appeler(`/api/status?id=${encodeURIComponent(id)}`),
  enregistrerCle: (key) => appeler('/api/key', { method: 'PUT', body: { key } }),
  supprimerCle: () => appeler('/api/key', { method: 'DELETE' }),
  supprimerGeneration: (id) => appeler(`/api/generation?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  supprimerMesDonnees: () => appeler('/api/account', { method: 'DELETE', body: { confirm: 'SUPPRIMER' } }),
}
