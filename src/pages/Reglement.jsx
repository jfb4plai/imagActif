import { useState } from 'react'
import { api } from '../lib/api.js'
import { TERMS_POINTS } from '../lib/terms.js'

export default function Reglement({ onAccepte }) {
  const [coche, setCoche] = useState(false)
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  async function accepter() {
    setErreur('')
    setEnCours(true)
    try {
      await api.accepterReglement()
      await onAccepte()
    } catch (e) {
      setErreur(e.message)
    }
    setEnCours(false)
  }

  return (
    <div className="plai-section">
      <div className="plai-card" style={{ maxWidth: 640, margin: '2rem auto' }}>
        <h2>Avant de commencer</h2>
        <p className="plai-help">Voici ce que fait ImagActif de vos données. Lisez ces points, puis acceptez pour continuer.</p>
        <ul style={{ paddingLeft: '1.25rem', margin: '1rem 0' }}>
          {TERMS_POINTS.map((p) => <li key={p} style={{ marginBottom: '0.5rem' }}>{p}</li>)}
        </ul>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <input type="checkbox" checked={coche} onChange={(e) => setCoche(e.target.checked)} style={{ width: 22, height: 22, marginTop: 4 }} />
          <span>J'ai lu ces règles et je les accepte.</span>
        </label>
        {erreur && <p className="plai-error">{erreur}</p>}
        <button type="button" className="plai-btn" style={{ marginTop: '1rem' }} disabled={!coche || enCours} onClick={accepter}>
          {enCours ? 'Enregistrement…' : 'Accepter et continuer'}
        </button>
      </div>
    </div>
  )
}
