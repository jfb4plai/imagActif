import { joursRestants } from '../lib/dates.js'
import { trialEnd } from '../lib/regime.js'

const LIMITE = Number(import.meta.env.VITE_TRIAL_DAILY_LIMIT) || 10

export default function BandeauRegime({ regime, compte, usage }) {
  if (regime === 'own') {
    return <div className="plai-banner">Vous utilisez votre clé BFL personnelle : les images sont facturées par BFL sur votre compte.</div>
  }
  if (regime === 'trial') {
    const jours = joursRestants(trialEnd(compte.trial_started_at))
    const reste = Math.max(LIMITE - usage, 0)
    return (
      <div className="plai-banner">
        Essai gratuit : encore {jours} jour{jours > 1 ? 's' : ''}, {reste} image{reste > 1 ? 's' : ''} disponible{reste > 1 ? 's' : ''} aujourd'hui.
        Ensuite, ajoutez votre clé BFL dans « Mes données ».
      </div>
    )
  }
  return (
    <div className="plai-banner" style={{ borderColor: '#f97316' }}>
      L'essai de 3 jours est terminé. Ajoutez votre clé BFL dans « Mes données » pour générer de nouvelles images.
      Vos JSON et vos images encore disponibles restent consultables.
    </div>
  )
}
