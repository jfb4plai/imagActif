import { useState } from 'react'
import { messageErreur } from '../lib/messages.js'

export const RETOUCHE_MIN = 3
export const RETOUCHE_MAX = 500

// Formulaire de retouche : l'image existante est renvoyée à BFL avec une consigne de changement.
// onValider(instruction) renvoie une promesse ; une erreur est affichée ici, le formulaire reste ouvert.
export default function RetoucheForm({ idPrefix = 'retouche', onValider, desactive = false }) {
  const [instruction, setInstruction] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')

  const longueur = instruction.trim().length
  const valide = longueur >= RETOUCHE_MIN && instruction.length <= RETOUCHE_MAX
  const champ = `${idPrefix}-instruction`
  const aide = `${idPrefix}-aide`

  async function envoyer(e) {
    e.preventDefault()
    if (!valide || envoi || desactive) return
    setErreur('')
    setEnvoi(true)
    try {
      await onValider(instruction.trim())
    } catch (err) {
      setErreur(messageErreur(err.code, err.message))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <form onSubmit={envoyer} style={{ marginTop: '0.75rem' }}>
      <label className="plai-label" htmlFor={champ}>Que voulez-vous changer ?</label>
      <textarea
        id={champ}
        className="plai-input"
        rows={3}
        maxLength={RETOUCHE_MAX}
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="Le chapeau devient jaune et la souris porte des lunettes roses"
        aria-describedby={aide}
      />
      <p className="plai-help" id={aide}>
        L'IA retouche l'image existante : le reste devrait rester identique, sans garantie. Décrivez un ou deux changements à la fois, relisez le résultat. L'image est renvoyée à BFL.
      </p>
      <p className="plai-help">{longueur} / {RETOUCHE_MAX} caractères (minimum {RETOUCHE_MIN})</p>
      <button type="submit" className="plai-btn" disabled={!valide || envoi || desactive}>
        {envoi ? 'Envoi…' : 'Retoucher'}
      </button>
      <div role="status" aria-live="polite">
        {envoi && <p className="plai-help">Envoi de la retouche à BFL…</p>}
      </div>
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
    </form>
  )
}
