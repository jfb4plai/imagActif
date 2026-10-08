import { useEffect, useRef, useState } from 'react'
import GabaritForm from '../components/GabaritForm.jsx'
import JsonPanel from '../components/JsonPanel.jsx'
import EnregistrerModele from '../components/EnregistrerModele.jsx'
import BandeauRegime from '../components/BandeauRegime.jsx'
import { api } from '../lib/api.js'
import { getGeneration, urlsSignees } from '../lib/data.js'
import { validerPourGeneration } from '../lib/gabarit.js'
import { messageErreur } from '../lib/messages.js'
import { joursRestants } from '../lib/dates.js'

const ATTENTE_MAX_MS = 120000
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const echec = (code) => Object.assign(new Error(), { code })

export default function Creer({ brouillon, setBrouillon, compte, usage, regime, recharger, ouvrirDansCreer }) {
  const [etat, setEtat] = useState('repos') // repos | cours | fini
  const [erreur, setErreur] = useState('')
  const [resultat, setResultat] = useState(null)
  const [modele, setModele] = useState(false)
  const actif = useRef(true)
  useEffect(() => { actif.current = true; return () => { actif.current = false } }, [])

  const majGabarit = (gabarit) => setBrouillon({ ...brouillon, gabarit })

  async function suivre(id) {
    const debut = Date.now()
    while (actif.current && Date.now() - debut < ATTENTE_MAX_MS) {
      await pause(2000)
      const s = await api.statut(id)
      if (s.status === 'done') {
        const gen = await getGeneration(id)
        const urls = await urlsSignees([gen.image_path])
        if (actif.current) setResultat({ gen, url: urls[gen.image_path] })
        return
      }
      if (s.status === 'refused') throw echec('moderated')
      if (s.status === 'failed') throw echec('failed')
    }
    if (actif.current) throw echec('timeout')
  }

  async function lancer() {
    setErreur('')
    setModele(false)
    const problemes = validerPourGeneration(brouillon.gabarit)
    if (problemes.length) { setErreur(problemes.join(' ')); return }
    setEtat('cours')
    setResultat(null)
    try {
      const { id } = await api.generer(brouillon.gabarit, brouillon.parentId)
      await suivre(id)
      if (actif.current) setEtat('fini')
    } catch (e) {
      if (actif.current) {
        setErreur(messageErreur(e.code, e.message))
        setEtat('repos')
      }
    }
    recharger()
  }

  const bloque = regime === 'none' || etat === 'cours'

  return (
    <div className="plai-section">
      <h2>Créer une image</h2>
      <BandeauRegime regime={regime} compte={compte} usage={usage} />
      {brouillon.verrous.length > 0 && (
        <p className="plai-banner">Ce brouillon vient d'un modèle : les champs verrouillés ne peuvent pas être modifiés.</p>
      )}
      <div className="img-split" style={{ marginTop: '1rem' }}>
        <div>
          <GabaritForm gabarit={brouillon.gabarit} onChange={majGabarit} verrous={brouillon.verrous} />
          <JsonPanel gabarit={brouillon.gabarit} onImporter={majGabarit} />
        </div>
        <div>
          <div className="plai-card img-warn">
            <p>
              Le texte de la description part chez BFL (serveur européen). N'y mettez aucun nom ni aucune donnée d'élève.
            </p>
          </div>
          <button type="button" className="plai-btn" style={{ marginTop: '1rem' }} disabled={bloque} onClick={lancer}>
            {etat === 'cours' ? 'Création en cours…' : 'Créer l\'image'}
          </button>
          <div role="status" aria-live="polite">
            {etat === 'cours' && <p className="plai-help">Comptez 10 à 40 secondes. Vous pouvez rester sur cette page.</p>}
          </div>
          {erreur && <p className="plai-error" role="alert">{erreur}</p>}
          {resultat && (
            <div className="plai-card img-card" style={{ marginTop: '1rem' }}>
              <img src={resultat.url} alt={`Image générée : ${resultat.gen.json.sujet.description}`} />
              <p className="plai-help">
                Image générée par IA, à relire avant usage en classe. Elle sera supprimée dans {joursRestants(resultat.gen.image_expires_at)} jours :
                téléchargez-la depuis l'Historique si vous voulez la garder. Le JSON, lui, reste.
              </p>
              <div className="img-actions">
                <button type="button" className="plai-btn plai-btn-ghost"
                  onClick={() => ouvrirDansCreer({ gabarit: resultat.gen.json, parentId: resultat.gen.id })}>
                  Faire une variante
                </button>
                <button type="button" className="plai-btn plai-btn-ghost" onClick={() => setModele(!modele)}>Enregistrer comme modèle</button>
              </div>
              {modele && <EnregistrerModele json={resultat.gen.json} />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
