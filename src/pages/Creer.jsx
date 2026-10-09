import { useEffect, useRef, useState } from 'react'
import GabaritForm from '../components/GabaritForm.jsx'
import JsonPanel from '../components/JsonPanel.jsx'
import EnregistrerModele from '../components/EnregistrerModele.jsx'
import RetoucheForm from '../components/RetoucheForm.jsx'
import BandeauRegime from '../components/BandeauRegime.jsx'
import { api } from '../lib/api.js'
import { getGeneration, urlsSignees } from '../lib/data.js'
import { validerPourGeneration } from '../lib/gabarit.js'
import { messageErreur } from '../lib/messages.js'
import { joursRestants, IMAGE_RETENTION_DAYS } from '../lib/dates.js'
import { getIn, setIn } from '../lib/path.js'

const ATTENTE_MAX_MS = 120000
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const echec = (code) => Object.assign(new Error(), { code })

export default function Creer({ brouillon, setBrouillon, compte, usage, regime, recharger, ouvrirDansCreer }) {
  const [etat, setEtat] = useState('repos') // repos | cours | fini
  const [erreur, setErreur] = useState('')
  const [resultat, setResultat] = useState(null)
  const [modele, setModele] = useState(false)
  const [retouche, setRetouche] = useState(false)
  const actif = useRef(true)
  useEffect(() => { actif.current = true; return () => { actif.current = false } }, [])

  const majGabarit = (gabarit) => setBrouillon({ ...brouillon, gabarit })
  // Un JSON importé ne doit pas écraser les champs verrouillés du modèle.
  const importerGabarit = (importe) => majGabarit(
    brouillon.verrous.reduce((g, chemin) => setIn(g, chemin, getIn(brouillon.gabarit, chemin)), importe),
  )

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

  // « Faire une variante » depuis le résultat : on est déjà sur le formulaire, qui contient déjà cette description.
  // Il faut donc rendre l'effet visible : relier la variante à l'image d'origine (en gardant les verrous d'un modèle),
  // remonter au formulaire et placer le curseur sur le sujet.
  function faireVariante() {
    setBrouillon({ ...brouillon, gabarit: resultat.gen.json, parentId: resultat.gen.id })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => document.getElementById('champ-sujet-description')?.focus({ preventScroll: true }), 300)
  }

  async function lancer() {
    setErreur('')
    setModele(false)
    setRetouche(false)
    const problemes = validerPourGeneration(brouillon.gabarit)
    if (problemes.length) { setErreur(problemes.join(' ')); return }
    setEtat('cours')
    setResultat(null)
    try {
      const { id } = await api.generer(brouillon.gabarit, brouillon.parentId)
      await suivre(id)
      if (actif.current) {
        setEtat('fini')
        setBrouillon((b) => ({ ...b, parentId: null })) // la variante est créée : l'avis « variante » n'a plus lieu d'être
      }
    } catch (e) {
      if (actif.current) {
        setErreur(messageErreur(e.code, e.message))
        setEtat('repos')
      }
    }
    recharger()
  }

  // Retouche de l'image affichée : même suivi qu'une création. Une erreur d'envoi remonte au formulaire (qui reste ouvert) ;
  // une erreur de suivi s'affiche ici. L'ancienne image reste visible tant que la nouvelle n'est pas prête.
  async function retoucher(instruction) {
    setErreur('')
    setEtat('cours')
    let id
    try {
      ({ id } = await api.retoucher(resultat.gen.id, instruction))
    } catch (e) {
      if (actif.current) setEtat('fini')
      throw e
    }
    if (actif.current) setRetouche(false)
    try {
      await suivre(id)
      if (actif.current) setEtat('fini')
    } catch (e) {
      if (actif.current) {
        setErreur(messageErreur(e.code, e.message))
        setEtat('fini')
      }
    }
    recharger()
  }

  const bloque = regime === 'none' || etat === 'cours'

  return (
    <div className="plai-section">
      <h2>Créer une image</h2>
      <BandeauRegime regime={regime} compte={compte} usage={usage} />
      {brouillon.parentId && etat !== 'cours' && (
        <p className="plai-success" role="status">
          Variante : le formulaire contient la description de l'image choisie, graine comprise. Modifiez ce que vous voulez, puis cliquez sur « Créer l'image ».
        </p>
      )}
      {brouillon.verrous.length > 0 && (
        <p className="plai-banner">Ce brouillon vient d'un modèle : les champs verrouillés ne peuvent pas être modifiés.</p>
      )}
      <div className="img-split" style={{ marginTop: '1rem' }}>
        <div>
          <GabaritForm gabarit={brouillon.gabarit} onChange={majGabarit} verrous={brouillon.verrous} />
          <JsonPanel gabarit={brouillon.gabarit} onImporter={importerGabarit} />
        </div>
        <div>
          <div className="plai-card img-warn">
            <p>
              Le texte de la description part chez BFL (société allemande, point d'accès européen). N'y mettez aucun nom ni aucune donnée d'élève.
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
                Image générée par IA, à relire avant usage en classe. Elle sera supprimée dans {joursRestants(resultat.gen.image_expires_at, new Date(), IMAGE_RETENTION_DAYS)} jours :
                téléchargez-la depuis l'Historique si vous voulez la garder. Le JSON, lui, reste.
              </p>
              <div className="img-actions">
                <button type="button" className="plai-btn plai-btn-ghost" onClick={faireVariante}>
                  Faire une variante
                </button>
                <button type="button" className="plai-btn plai-btn-ghost" disabled={bloque} aria-expanded={retouche} onClick={() => setRetouche(!retouche)}>
                  Retoucher cette image
                </button>
                <button type="button" className="plai-btn plai-btn-ghost" onClick={() => setModele(!modele)}>Enregistrer comme modèle</button>
              </div>
              {retouche && <RetoucheForm idPrefix="retouche-creer" onValider={retoucher} desactive={bloque} />}
              {modele && <EnregistrerModele json={resultat.gen.json} />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
