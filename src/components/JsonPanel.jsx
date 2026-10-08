import { useState } from 'react'
import { normaliserGabarit } from '../lib/gabarit.js'
import { extraireJson } from '../lib/extraireJson.js'
import { CONSIGNE_IMAGE_VERS_JSON } from '../lib/consigneImage.js'

export default function JsonPanel({ gabarit, onImporter }) {
  const [texte, setTexte] = useState('')
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')
  const [consigneVisible, setConsigneVisible] = useState(false)
  const [messageConsigne, setMessageConsigne] = useState('')

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

  async function copierConsigne() {
    try {
      await navigator.clipboard.writeText(CONSIGNE_IMAGE_VERS_JSON)
      setMessageConsigne('Consigne copiée. Collez-la dans votre IA avec l\'image jointe.')
    } catch {
      setConsigneVisible(true)
      setMessageConsigne('Copie impossible depuis ce navigateur : sélectionnez la consigne affichée ci-dessous.')
    }
  }

  function importer() {
    setMessage('')
    setErreur('')
    try {
      const { gabarit: g, avertissements } = normaliserGabarit(extraireJson(texte))
      onImporter(g)
      setMessage(avertissements.length ? avertissements.join(' ') : 'JSON chargé dans le formulaire. Relisez-le et corrigez-le avant de créer l\'image.')
    } catch (e) {
      setErreur(e instanceof SyntaxError ? "Ce texte ne contient pas de JSON valide. Collez uniquement la réponse de l'IA, en entier." : e.message)
    }
  }

  return (
    <details className="plai-card" style={{ marginTop: '1rem' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>JSON : copier, importer, ou partir d'une image</summary>

      <h3 style={{ marginTop: '1rem' }}>Partir d'une image existante</h3>
      <p className="plai-help">Pour retrouver le style, le cadrage, l'éclairage, l'atmosphère et les textes d'une image que vous avez déjà, une IA qui lit les images (Claude, ChatGPT…) peut la décrire dans le format d'ImagActif.</p>
      <ol style={{ paddingLeft: '1.25rem', margin: '0.5rem 0' }}>
        <li>Copiez la consigne ci-dessous.</li>
        <li>Dans votre IA, joignez l'image et collez la consigne.</li>
        <li>Collez la réponse dans « JSON à importer » plus bas, puis « Charger ce JSON ».</li>
        <li>Relisez et corrigez dans le formulaire : l'IA peut se tromper ou oublier un détail.</li>
      </ol>
      <p className="plai-help img-warn">
        L'image est envoyée à l'IA que vous choisissez, pas à ImagActif. N'y joignez aucune photo d'élève ni d'image dont vous n'avez pas les droits. Une nouvelle image créée à partir de ce JSON ressemblera à l'originale sans en être une copie.
      </p>
      <div className="img-actions">
        <button type="button" className="plai-btn plai-btn-ghost" onClick={copierConsigne}>Copier la consigne</button>
        <button type="button" className="plai-btn plai-btn-ghost" onClick={() => setConsigneVisible(!consigneVisible)}>
          {consigneVisible ? 'Masquer la consigne' : 'Voir la consigne'}
        </button>
      </div>
      {messageConsigne && <p className="plai-success" role="status">{messageConsigne}</p>}
      {consigneVisible && (
        <textarea className="plai-input" readOnly aria-label="Consigne à coller dans votre IA" style={{ minHeight: '14rem', fontFamily: 'monospace' }}
          value={CONSIGNE_IMAGE_VERS_JSON} onFocus={(e) => e.target.select()} />
      )}

      <h3 style={{ marginTop: '1.5rem' }}>Copier ou importer un JSON</h3>
      <p className="plai-help">Copiez le JSON pour le garder ou le réutiliser ailleurs. Pour reprendre un JSON, collez-le ci-dessous : il est vérifié puis rempli dans le formulaire, rien n'est exécuté.</p>
      <div className="img-actions">
        <button type="button" className="plai-btn plai-btn-ghost" onClick={copier}>Copier le JSON de ce formulaire</button>
      </div>
      <label className="plai-label" htmlFor="json-import" style={{ marginTop: '1rem' }}>JSON à importer</label>
      <textarea id="json-import" className="plai-input" style={{ minHeight: '8rem', fontFamily: 'monospace' }} value={texte}
        onChange={(e) => setTexte(e.target.value)} placeholder='{ "sujet": { "description": "Un chat roux…" } }' />
      <p className="plai-help">Vous pouvez coller la réponse de l'IA telle quelle, même entourée d'une phrase ou d'un bloc de code.</p>
      <div className="img-actions">
        <button type="button" className="plai-btn" disabled={!texte.trim()} onClick={importer}>Charger ce JSON</button>
      </div>
      {message && <p className="plai-success">{message}</p>}
      {erreur && <p className="plai-error">{erreur}</p>}
    </details>
  )
}
