import { messageErreur } from './messages.js'

// Erreurs qui rendraient échouer toutes les images suivantes : le lot s'arrête.
export const CODES_ARRET = [
  'quota_user', 'quota_global', 'trial_over', 'no_credits', 'invalid_key', 'key_unreadable',
  'terms', 'email_unconfirmed', 'busy', 'rate_limited',
]

// Exécute les lignes demandées l'une après l'autre (une seule génération « en cours » est permise par utilisateur).
// L'API est injectée pour pouvoir tester sans réseau. Les échecs isolés n'arrêtent pas le lot.
export async function executerLot({ lignes, indices, construire, generer, attendre, arret, onEtat }) {
  let stop = false
  let codeArret = null
  for (const i of indices) {
    if (stop || arret()) { onEtat(i, { statut: 'non_lancee' }); continue }
    onEtat(i, { statut: 'cours' })
    try {
      const { id } = await generer(construire(lignes[i]))
      const resultat = await attendre(id)
      if (!resultat) { onEtat(i, { statut: 'non_lancee' }); stop = true; continue } // page quittée
      onEtat(i, { statut: 'fini', url: resultat.url, genId: resultat.gen.id })
    } catch (e) {
      if (CODES_ARRET.includes(e.code)) {
        stop = true
        codeArret = e.code
        onEtat(i, { statut: 'non_lancee', message: messageErreur(e.code, e.message) })
      } else if (e.code === 'timeout') {
        // L'image peut encore aboutir : ne pas la relancer pour ne pas débiter le quota deux fois.
        onEtat(i, { statut: 'a_verifier', message: messageErreur(e.code, e.message) })
      } else {
        onEtat(i, { statut: 'echec', message: messageErreur(e.code, e.message) })
      }
    }
  }
  return { codeArret }
}
