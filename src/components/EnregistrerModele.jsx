import { useState } from 'react'
import { enregistrerModele } from '../lib/data.js'

export default function EnregistrerModele({ json, verrous = [], onFini }) {
  const [nom, setNom] = useState('')
  const [erreur, setErreur] = useState('')
  const [fait, setFait] = useState(false)

  async function valider(e) {
    e.preventDefault()
    setErreur('')
    try {
      await enregistrerModele({ nom: nom.trim(), json, verrous })
      setFait(true)
      onFini?.()
    } catch (err) {
      setErreur(err.message)
    }
  }

  if (fait) return <p className="plai-success">Modèle « {nom.trim()} » enregistré.</p>
  return (
    <form onSubmit={valider} style={{ marginTop: '0.75rem' }}>
      <label className="plai-label" htmlFor="nom-modele">Nom du modèle</label>
      <input id="nom-modele" className="plai-input" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={80}
        placeholder="Album de la forêt, style aquarelle" required />
      <p className="plai-help">Un modèle garde tous les champs actuels. Vous pourrez ensuite verrouiller ceux qui ne doivent pas changer (dans « Modèles »).</p>
      {erreur && <p className="plai-error">{erreur}</p>}
      <button type="submit" className="plai-btn" disabled={!nom.trim()}>Enregistrer le modèle</button>
    </form>
  )
}
