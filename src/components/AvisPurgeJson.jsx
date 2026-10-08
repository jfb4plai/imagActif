import { JSON_AVERTISSEMENT_JOURS, joursAvantPurgeJson } from '../lib/dates.js'

// Prévient 30 jours avant la suppression automatique d'une description (JSON) ou d'un modèle, un an après sa création.
export default function AvisPurgeJson({ creeLe, now }) {
  const jours = joursAvantPurgeJson(creeLe, now)
  if (jours > JSON_AVERTISSEMENT_JOURS) return null
  const delai = jours === 0 ? "aujourd'hui" : `dans ${jours} jour${jours > 1 ? 's' : ''}`
  return (
    <p className="img-urgent" role="alert">
      Cette description (JSON) sera supprimée {delai}. Pour la garder, exportez vos données depuis « Mes données ».
    </p>
  )
}
