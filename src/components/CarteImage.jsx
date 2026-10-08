import { useState } from 'react'
import EnregistrerModele from './EnregistrerModele.jsx'
import { joursRestants, niveauUrgence } from '../lib/dates.js'

const dateFr = (iso) => new Date(iso).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })

export default function CarteImage({ gen, url, onVariante, onTelecharger, onSupprimer }) {
  const [modele, setModele] = useState(false)
  const [message, setMessage] = useState('')
  const sujet = gen.json?.sujet?.description ?? ''

  async function copierJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(gen.json, null, 2))
      setMessage('JSON copié.')
    } catch {
      setMessage('Copie impossible depuis ce navigateur.')
    }
  }

  const aImage = gen.status === 'done' && gen.image_path
  const jours = aImage ? joursRestants(gen.image_expires_at) : 0
  const urgence = aImage ? niveauUrgence(jours) : null

  return (
    <article className="plai-card img-card">
      {aImage && url && <img src={url} alt={`Image générée : ${sujet}`} />}
      {gen.status === 'done' && !gen.image_path && (
        <p className="plai-banner">Image supprimée le {dateFr(gen.image_deleted_at ?? gen.image_expires_at)}. Le JSON est conservé : vous pouvez la régénérer.</p>
      )}
      {gen.status === 'pending' && <p className="plai-banner">Création en cours…</p>}
      {(gen.status === 'failed' || gen.status === 'refused') && (
        <p className="plai-banner">{gen.status === 'refused' ? 'Refusée par BFL.' : 'Échec de la génération.'}</p>
      )}
      <h3 style={{ marginTop: '0.75rem' }}>{sujet || 'Sans titre'}</h3>
      <p className="plai-help">Créée le {dateFr(gen.created_at)} · graine {gen.seed}</p>
      {aImage && (
        <p className={urgence === 'bientot' ? 'img-urgent' : 'plai-help'} role={urgence === 'bientot' ? 'alert' : undefined}>
          {urgence === 'expire'
            ? "Cette image sera supprimée aujourd'hui."
            : `Image supprimée dans ${jours} jour${jours > 1 ? 's' : ''}.`}
          {urgence !== 'ok' && ' Téléchargez-la si vous voulez la garder.'}
        </p>
      )}
      <div className="img-actions">
        {aImage && <button type="button" className="plai-btn" onClick={onTelecharger}>Télécharger</button>}
        {gen.status === 'done' && (
          <button type="button" className="plai-btn plai-btn-ghost" onClick={onVariante}>
            {aImage ? 'Faire une variante' : 'Régénérer'}
          </button>
        )}
        <button type="button" className="plai-btn plai-btn-ghost" onClick={copierJson}>Copier le JSON</button>
        <button type="button" className="plai-btn plai-btn-ghost" onClick={() => setModele(!modele)}>Enregistrer comme modèle</button>
        <button type="button" className="plai-btn plai-btn-ghost" onClick={onSupprimer}>Supprimer</button>
      </div>
      {message && <p className="plai-help" role="status">{message}</p>}
      {modele && <EnregistrerModele json={gen.json} />}
    </article>
  )
}
