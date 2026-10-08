import { useState } from 'react'
import JSZip from 'jszip'
import { api } from '../lib/api.js'
import { listerGenerations, listerModeles, urlsSignees } from '../lib/data.js'
import { TERMS_POINTS } from '../lib/terms.js'
import { messageErreur } from '../lib/messages.js'

function telecharger(blob, nom) {
  const lien = document.createElement('a')
  lien.href = URL.createObjectURL(blob)
  lien.download = nom
  lien.click()
  URL.revokeObjectURL(lien.href)
}

export default function MesDonnees({ compte, regime, recharger, signOut }) {
  const [cle, setCle] = useState('')
  const [messageCle, setMessageCle] = useState('')
  const [erreurCle, setErreurCle] = useState('')
  const [exportEnCours, setExportEnCours] = useState(false)
  const [erreurExport, setErreurExport] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreurSuppr, setErreurSuppr] = useState('')

  async function enregistrerCle(e) {
    e.preventDefault()
    setMessageCle('')
    setErreurCle('')
    try {
      await api.enregistrerCle(cle)
      setCle('')
      setMessageCle('Clé enregistrée (chiffrée). Elle sera utilisée pour vos prochaines images.')
      await recharger()
    } catch (err) {
      setErreurCle(messageErreur(err.code, err.message))
    }
  }

  async function retirerCle() {
    setMessageCle('')
    setErreurCle('')
    try {
      await api.supprimerCle()
      setMessageCle('Clé supprimée de nos serveurs.')
      await recharger()
    } catch (err) {
      setErreurCle(err.message)
    }
  }

  async function exporter() {
    setErreurExport('')
    setExportEnCours(true)
    try {
      const zip = new JSZip()
      const generations = await listerGenerations(1000)
      zip.file('generations.json', JSON.stringify(generations.map((g) => ({
        id: g.id, json: g.json, prompt_text: g.prompt_text, seed: g.seed, status: g.status,
        created_at: g.created_at, image_expires_at: g.image_expires_at, image_deleted_at: g.image_deleted_at,
      })), null, 2))
      zip.file('modeles.json', JSON.stringify(await listerModeles(), null, 2))
      const avecImage = generations.filter((g) => g.image_path)
      const urls = await urlsSignees(avecImage.map((g) => g.image_path), 300)
      for (const g of avecImage) {
        const resp = await fetch(urls[g.image_path])
        if (resp.ok) zip.file(`images/${g.id}.${g.image_path.split('.').pop()}`, await resp.blob())
      }
      telecharger(await zip.generateAsync({ type: 'blob' }), 'imagactif-export.zip')
    } catch (err) {
      setErreurExport(err.message)
    }
    setExportEnCours(false)
  }

  async function supprimerTout(e) {
    e.preventDefault()
    setErreurSuppr('')
    try {
      await api.supprimerMesDonnees()
      await signOut()
    } catch (err) {
      setErreurSuppr(err.message)
    }
  }

  return (
    <div className="plai-section">
      <h2>Mes données</h2>

      <section className="plai-card" aria-labelledby="t-regles">
        <h3 id="t-regles">Règles d'utilisation</h3>
        <ul style={{ paddingLeft: '1.25rem' }}>
          {TERMS_POINTS.map((p) => <li key={p}>{p}</li>)}
        </ul>
        <p className="plai-help">Règles acceptées le {new Date(compte.terms_accepted_at).toLocaleDateString('fr-BE')}.</p>
      </section>

      <section className="plai-card" aria-labelledby="t-cle" style={{ marginTop: '1rem' }}>
        <h3 id="t-cle">Ma clé BFL</h3>
        <p>
          {compte.has_own_key ? 'Une clé personnelle est enregistrée (chiffrée sur nos serveurs).' : regime === 'trial' ? "Vous êtes en essai : aucune clé n'est nécessaire pour l'instant." : "Aucune clé enregistrée : ajoutez-la pour continuer à générer."}
        </p>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Comment obtenir une clé BFL ?</summary>
          <ol style={{ paddingLeft: '1.25rem', marginTop: '0.5rem' }}>
            <li>Créez un compte sur le site de Black Forest Labs et ajoutez des crédits (l'image coûte quelques centimes).</li>
            <li>Dans votre espace BFL, créez une clé d'API et copiez-la.</li>
            <li>Collez-la ci-dessous. Elle est chiffrée et ne revient jamais dans votre navigateur.</li>
          </ol>
          <p className="plai-help">Aide officielle : <a href="https://help.bfl.ai/articles/8446125349-quickstart-guide" target="_blank" rel="noopener noreferrer">help.bfl.ai, démarrage</a>.</p>
        </details>
        <form onSubmit={enregistrerCle} style={{ marginTop: '1rem' }}>
          <label className="plai-label" htmlFor="cle-bfl">Clé d'API BFL</label>
          <input id="cle-bfl" type="password" className="plai-input" value={cle} onChange={(e) => setCle(e.target.value)}
            placeholder="Collez ici la clé copiée depuis votre espace BFL" autoComplete="off" />
          <p className="plai-help">Utilisée uniquement pour vos images, et seulement par notre serveur. Vous pouvez la supprimer à tout moment.</p>
          <div className="img-actions">
            <button type="submit" className="plai-btn" disabled={!cle.trim()}>Enregistrer la clé</button>
            {compte.has_own_key && <button type="button" className="plai-btn plai-btn-ghost" onClick={retirerCle}>Supprimer ma clé</button>}
          </div>
        </form>
        {messageCle && <p className="plai-success" role="status">{messageCle}</p>}
        {erreurCle && <p className="plai-error" role="alert">{erreurCle}</p>}
      </section>

      <section className="plai-card" aria-labelledby="t-export" style={{ marginTop: '1rem' }}>
        <h3 id="t-export">Exporter mes données</h3>
        <p className="plai-help">Un fichier ZIP avec tous vos JSON, vos modèles et les images encore disponibles.</p>
        <button type="button" className="plai-btn" disabled={exportEnCours} onClick={exporter}>{exportEnCours ? 'Préparation…' : 'Télécharger mon export'}</button>
        {erreurExport && <p className="plai-error" role="alert">{erreurExport}</p>}
      </section>

      <section className="plai-card" aria-labelledby="t-suppr" style={{ marginTop: '1rem' }}>
        <h3 id="t-suppr">Supprimer mes données ImagActif</h3>
        <p>Supprime définitivement vos images, JSON, modèles et votre clé BFL. Cette action est irréversible.</p>
        <p className="plai-help">Seule la date de début de votre essai gratuit est conservée, pour qu'il ne puisse pas être renouvelé. Votre identifiant de connexion (e-mail) est commun à plusieurs outils PLAI : il n'est pas supprimé ici. Pour le faire supprimer, écrivez à jf.beguin@outlook.com.</p>
        <form onSubmit={supprimerTout}>
          <label className="plai-label" htmlFor="confirm-suppr">Tapez SUPPRIMER pour confirmer</label>
          <input id="confirm-suppr" className="plai-input" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="SUPPRIMER" autoComplete="off" />
          <button type="submit" className="plai-btn" style={{ marginTop: '0.5rem' }} disabled={confirmation !== 'SUPPRIMER'}>Supprimer définitivement mes données</button>
        </form>
        {erreurSuppr && <p className="plai-error" role="alert">{erreurSuppr}</p>}
      </section>
    </div>
  )
}
