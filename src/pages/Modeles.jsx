import { useCallback, useEffect, useState } from 'react'
import { CHAMPS } from '../lib/champs.js'
import AvisPurgeJson from '../components/AvisPurgeJson.jsx'
import { listerModeles, majVerrousModele, supprimerModele } from '../lib/data.js'

function Verrous({ modele, onSauve }) {
  const [verrous, setVerrous] = useState(modele.locked_fields)
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')
  const bascule = (path) => setVerrous((v) => (v.includes(path) ? v.filter((p) => p !== path) : [...v, path]))

  async function sauver() {
    setMessage('')
    setErreur('')
    try {
      await majVerrousModele(modele.id, verrous)
      setMessage('Verrous enregistrés.')
      onSauve()
    } catch (e) {
      setErreur(e.message || "Les verrous n'ont pas pu être enregistrés. Réessayez.")
    }
  }

  return (
    <fieldset style={{ border: 'none', padding: 0, marginTop: '0.75rem' }}>
      <legend className="plai-label">Champs à verrouiller</legend>
      <p className="plai-help">Un champ verrouillé ne peut plus être modifié quand vous utilisez ce modèle : il reste identique d'une image à l'autre.</p>
      {CHAMPS.map((c) => (
        <label key={c.path} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
          <input type="checkbox" style={{ width: 20, height: 20 }} checked={verrous.includes(c.path)} onChange={() => bascule(c.path)} />
          <span>{c.label}</span>
        </label>
      ))}
      <button type="button" className="plai-btn plai-btn-ghost" style={{ marginTop: '0.5rem' }} onClick={sauver}>Enregistrer les verrous</button>
      {message && <p className="plai-success" role="status">{message}</p>}
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
    </fieldset>
  )
}

export default function Modeles({ ouvrirDansCreer }) {
  const [modeles, setModeles] = useState(null)
  const [ouvert, setOuvert] = useState(null)
  const [erreur, setErreur] = useState('')

  const charger = useCallback(async () => {
    try { setModeles(await listerModeles()) } catch (e) { setErreur(e.message) }
  }, [])
  useEffect(() => { charger() }, [charger])

  async function supprimer(m) {
    if (!window.confirm(`Supprimer le modèle « ${m.name} » ?`)) return
    try { await supprimerModele(m.id); await charger() } catch (e) { setErreur(e.message) }
  }

  return (
    <div className="plai-section">
      <h2>Modèles</h2>
      <p className="plai-help">Un modèle est un JSON que vous réutilisez en ne changeant que certains champs. Créez-le depuis « Créer » ou « Historique » (bouton « Enregistrer comme modèle »).</p>
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
      {modeles?.length === 0 && <p className="plai-empty">Aucun modèle pour l'instant.</p>}
      <div className="img-grid">
        {modeles?.map((m) => (
          <article key={m.id} className="plai-card">
            <h3>{m.name}</h3>
            <p className="plai-help">{m.json?.sujet?.description || 'Sans sujet'}</p>
            <p className="plai-help">{m.locked_fields.length} champ{m.locked_fields.length > 1 ? 's' : ''} verrouillé{m.locked_fields.length > 1 ? 's' : ''}</p>
            <AvisPurgeJson creeLe={m.created_at} />
            <div className="img-actions">
              <button type="button" className="plai-btn" onClick={() => ouvrirDansCreer({ gabarit: m.json, verrous: m.locked_fields })}>Utiliser</button>
              <button type="button" className="plai-btn plai-btn-ghost" onClick={() => setOuvert(ouvert === m.id ? null : m.id)}>Verrous</button>
              <button type="button" className="plai-btn plai-btn-ghost" onClick={() => supprimer(m)}>Supprimer</button>
            </div>
            {ouvert === m.id && <Verrous modele={m} onSauve={charger} />}
          </article>
        ))}
      </div>
    </div>
  )
}
