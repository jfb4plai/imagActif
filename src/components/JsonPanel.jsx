import { useState } from 'react'
import { normaliserGabarit } from '../lib/gabarit.js'

export default function JsonPanel({ gabarit, onImporter }) {
  const [texte, setTexte] = useState('')
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')

  async function copier() {
    setErreur('')
    try {
      await navigator.clipboard.writeText(JSON.stringify(gabarit, null, 2))
      setMessage('JSON copié.')
    } catch {
      setErreur('Copie impossible : sélectionnez le texte ci-dessous.')
      setTexte(JSON.stringify(gabarit, null, 2))
    }
  }

  function importer() {
    setMessage('')
    setErreur('')
    try {
      const { gabarit: g, avertissements } = normaliserGabarit(JSON.parse(texte))
      onImporter(g)
      setMessage(avertissements.length ? avertissements.join(' ') : 'JSON chargé dans le formulaire.')
    } catch (e) {
      setErreur(e instanceof SyntaxError ? "Ce texte n'est pas du JSON valide." : e.message)
    }
  }

  return (
    <details className="plai-card" style={{ marginTop: '1rem' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>JSON : copier ou importer</summary>
      <p className="plai-help">Copiez le JSON pour le garder ou le réutiliser ailleurs. Pour reprendre un JSON, collez-le ci-dessous : il est vérifié puis rempli dans le formulaire, rien n'est exécuté.</p>
      <div className="img-actions">
        <button type="button" className="plai-btn plai-btn-ghost" onClick={copier}>Copier le JSON de ce formulaire</button>
      </div>
      <label className="plai-label" htmlFor="json-import" style={{ marginTop: '1rem' }}>JSON à importer</label>
      <textarea id="json-import" className="plai-input" style={{ minHeight: '8rem', fontFamily: 'monospace' }} value={texte}
        onChange={(e) => setTexte(e.target.value)} placeholder='{ "sujet": { "description": "Un chat roux…" } }' />
      <div className="img-actions">
        <button type="button" className="plai-btn" disabled={!texte.trim()} onClick={importer}>Charger ce JSON</button>
      </div>
      {message && <p className="plai-success">{message}</p>}
      {erreur && <p className="plai-error">{erreur}</p>}
    </details>
  )
}
