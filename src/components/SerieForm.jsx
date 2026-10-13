import { useEffect, useRef, useState } from 'react'
import { LIMITE_ESSAI } from './BandeauRegime.jsx'
import { messageErreur } from '../lib/messages.js'
import { executerLot } from '../lib/lot.js'
import {
  PLAFOND_SERIE, MAX_CELLULE, MAX_COLONNES_EXTRA, CHEMIN_SUJET, COLONNES_EXTRA, colonnesDisponibles, sujetVerrouille,
  changerColonne, majCellule, ajouterLigne, supprimerLigne, collerTableau, copierTableau, lignesALancer, gabaritPourLigne, verifierLot,
  majEtatSerie, marquerAttente, effacerSuivi,
} from '../lib/serie.js'

const LIBELLES = {
  attente: 'En attente', cours: 'En cours…', fini: 'Terminée', echec: 'Échec', non_lancee: 'Non lancée', a_verifier: 'À vérifier dans l\'Historique',
}
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`
const libelleColonne = (chemin) => COLONNES_EXTRA.find((c) => c.chemin === chemin)

export default function SerieForm({ serie, setSerie, gabarit, verrous, regime, usage, bloque, generer, attendre, recharger, onEnCours }) {
  const [ouvert, setOuvert] = useState(false)
  const [vignettes, setVignettes] = useState({}) // liens signés temporaires : non conservés avec le tableau
  const [enCours, setEnCours] = useState(false)
  const [erreurs, setErreurs] = useState([])
  const [message, setMessage] = useState('')
  const [collage, setCollage] = useState('')
  const [copie, setCopie] = useState('')
  const arretRef = useRef(false)
  const vivant = useRef(true)
  useEffect(() => { vivant.current = true; return () => { vivant.current = false } }, [])

  // Quitter ou recharger la page pendant un lot interromprait la série.
  useEffect(() => {
    if (!enCours) return undefined
    const garde = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', garde)
    return () => window.removeEventListener('beforeunload', garde)
  }, [enCours])

  if (sujetVerrouille(verrous)) {
    return (
      <details className="plai-card" style={{ marginTop: '1rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Série d'images</summary>
        <p className="plai-help">Le sujet est verrouillé par le modèle : toutes les images de la série seraient identiques. Utilisez un modèle dont le sujet n'est pas verrouillé.</p>
      </details>
    )
  }

  const chemins = [CHEMIN_SUJET, ...serie.colonnes]
  const etats = serie.etats ?? []
  const reprise = etats.some((e) => e?.statut)
  const n = lignesALancer(serie).length
  const reste = Math.max(LIMITE_ESSAI - usage, 0)
  const verrouille = enCours
  const colonnesLibres = colonnesDisponibles(verrous)

  // « Créer » ne recrée jamais une image déjà terminée ou à vérifier : seules les lignes restantes partent.
  async function lancer() {
    setMessage('')
    setErreurs([])
    const indices = lignesALancer(serie)
    const problemes = verifierLot(gabarit, chemins, serie.lignes.map((l, i) => (indices.includes(i) ? l : [''])))
    if (problemes.length) { setErreurs(problemes); return }
    arretRef.current = false
    setSerie((s) => marquerAttente(s, indices))
    setEnCours(true)
    onEnCours(true)
    const { codeArret } = await executerLot({
      lignes: serie.lignes,
      indices,
      construire: (ligne) => gabaritPourLigne(gabarit, chemins, ligne),
      generer,
      attendre,
      arret: () => arretRef.current || !vivant.current,
      onEtat: (i, e) => {
        const { url, ...persistant } = e
        if (url && vivant.current) setVignettes((v) => ({ ...v, [i]: url }))
        setSerie((s) => majEtatSerie(s, i, { message: undefined, genId: undefined, ...persistant }))
      },
    })
    if (vivant.current) {
      setEnCours(false)
      if (codeArret === 'timeout') setMessage(`${messageErreur('timeout')} Les images suivantes ne sont pas lancées : créez-les ensuite avec « Créer les images restantes ».`)
      else if (codeArret) setMessage(messageErreur(codeArret))
      else if (arretRef.current) setMessage('Série arrêtée. Les lignes non lancées partiront avec « Créer les images restantes ».')
    }
    onEnCours(false)
    recharger()
  }

  function coller() {
    const { serie: s, tronque } = collerTableau(serie, collage)
    setSerie(s)
    setCollage('')
    setVignettes({})
    setMessage(tronque ? `Seules les ${PLAFOND_SERIE} premières lignes ont été gardées.` : '')
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(copierTableau(serie.lignes))
      setCopie('Tableau copié.')
    } catch {
      setCopie('Copie impossible depuis ce navigateur.')
    }
  }

  return (
    <details className="plai-card" style={{ marginTop: '1rem' }} open={ouvert} onToggle={(e) => setOuvert(e.currentTarget.open)}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Série d'images</summary>
      <p className="plai-help">
        Une ligne = une image. Le style, la palette, le cadrage et les autres champs du formulaire ci-dessus restent communs à toute la série ;
        seuls le sujet et les colonnes choisies changent d'une image à l'autre. Une cellule laissée vide garde la valeur du formulaire.
      </p>
      <p className="plai-help img-warn">
        Chaque ligne part chez BFL : n'y mettez aucun nom ni donnée d'élève. Le style est commun, mais la composition peut varier d'une image à l'autre.
        Restez sur cette page pendant la création : quitter la page interrompt la série.
      </p>

      <div className="img-actions" style={{ marginTop: '0.75rem' }}>
        {Array.from({ length: Math.min(serie.colonnes.length + 1, MAX_COLONNES_EXTRA) }, (_, p) => {
          const choisie = serie.colonnes[p] ?? ''
          const autre = serie.colonnes[1 - p]
          return (
            <div key={p}>
              <label className="plai-label" htmlFor={`serie-colonne-${p}`}>{`Colonne supplémentaire ${p + 1}`}</label>
              <select id={`serie-colonne-${p}`} className="plai-input" value={choisie} disabled={verrouille}
                aria-describedby={`serie-colonne-${p}-aide`}
                onChange={(e) => setSerie(changerColonne(serie, p, e.target.value))}>
                <option value="">Aucune</option>
                {colonnesLibres.filter((c) => c.chemin === choisie || c.chemin !== autre).map((c) => (
                  <option key={c.chemin} value={c.chemin}>{c.label}</option>
                ))}
              </select>
              <p className="plai-help" id={`serie-colonne-${p}-aide`}>
                {libelleColonne(choisie)?.aide ?? 'Facultatif : un champ du formulaire qui change aussi d\'une image à l\'autre.'}
              </p>
            </div>
          )
        })}
      </div>

      <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
      <table style={{ width: '100%' }}>
        <thead>
          <tr>
            <th scope="col">Sujet</th>
            {serie.colonnes.map((c) => <th key={c} scope="col">{libelleColonne(c).label}</th>)}
            <th scope="col">État</th>
          </tr>
        </thead>
        <tbody>
          {serie.lignes.map((ligne, i) => (
            <tr key={i}>
              {ligne.map((cellule, j) => {
                const colonne = j === 0 ? null : libelleColonne(serie.colonnes[j - 1])
                const libelle = j === 0 ? 'Sujet' : colonne.label
                return (
                  <td key={j}>
                    <input className="plai-input" style={{ minWidth: '11rem' }} value={cellule} maxLength={MAX_CELLULE} disabled={verrouille}
                      aria-label={`Ligne ${i + 1} : ${libelle}`}
                      placeholder={j === 0 ? 'un cartable ouvert sur un bureau' : colonne.placeholder}
                      onChange={(e) => setSerie(majCellule(serie, i, j, e.target.value))} />
                  </td>
                )
              })}
              <td>
                {etats[i]?.statut && (
                  <div role="status">
                    <strong>{LIBELLES[etats[i].statut]}</strong>
                    {etats[i].message && <span className="plai-help"> {etats[i].message}</span>}
                    {etats[i].statut === 'fini' && vignettes[i] && <img src={vignettes[i]} alt={`Image générée : ${ligne[0]}`} style={{ display: 'block', maxWidth: '8rem', marginTop: '0.25rem' }} />}
                  </div>
                )}
                {!verrouille && serie.lignes.length > 1 && (
                  <button type="button" className="plai-btn plai-btn-ghost" aria-label={`Supprimer la ligne ${i + 1}`}
                    onClick={() => setSerie(supprimerLigne(serie, i))}>Supprimer</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <div className="img-actions" style={{ marginTop: '0.75rem' }}>
        <button type="button" className="plai-btn plai-btn-ghost" disabled={verrouille || serie.lignes.length >= PLAFOND_SERIE}
          onClick={() => setSerie(ajouterLigne(serie))}>Ajouter une ligne</button>
        <button type="button" className="plai-btn plai-btn-ghost" onClick={copier}>Copier le tableau</button>
      </div>
      <p className="plai-help">{`${PLAFOND_SERIE} images au maximum par série.`}</p>
      {copie && <p className="plai-success" role="status">{copie}</p>}

      <label className="plai-label" htmlFor="serie-collage" style={{ marginTop: '1rem' }}>Coller depuis un tableur</label>
      <textarea id="serie-collage" className="plai-input" rows={3} value={collage} disabled={verrouille}
        aria-describedby="serie-collage-aide" placeholder={'un cartable\nune trousse\nun compas'}
        onChange={(e) => setCollage(e.target.value)} />
      <p className="plai-help" id="serie-collage-aide">
        Copiez des cellules dans Excel ou LibreOffice et collez-les ici : une ligne par image, les colonnes dans l'ordre du tableau ci-dessus.
        Cela remplace les lignes actuelles.
      </p>
      <button type="button" className="plai-btn plai-btn-ghost" disabled={verrouille || !collage.trim()} onClick={coller}>Remplacer par le texte collé</button>

      <p className="plai-help" style={{ marginTop: '1rem' }}>
        {regime === 'trial'
          ? `${pluriel(n, 'image')} = ${n} sur votre quota. Il vous en reste ${reste} aujourd'hui.${n > reste ? ` Le quota ne suffit pas : le lot s'arrêtera après ${pluriel(reste, 'image')}.` : ''}`
          : pluriel(n, 'image')}
        {' '}Comptez 10 à 40 secondes par image.
      </p>

      <div className="img-actions">
        <button type="button" className="plai-btn" disabled={n === 0 || bloque || enCours || regime === 'none'} onClick={lancer}>
          {enCours ? 'Série en cours…' : `${reprise ? 'Créer les images restantes' : 'Créer la série'} (${pluriel(n, 'image')})`}
        </button>
        {enCours && (
          <button type="button" className="plai-btn plai-btn-ghost" onClick={() => { arretRef.current = true }}>Arrêter après l'image en cours</button>
        )}
        {!enCours && reprise && (
          <button type="button" className="plai-btn plai-btn-ghost" aria-describedby="serie-effacer-aide"
            onClick={() => { setSerie(effacerSuivi(serie)); setVignettes({}) }}>Effacer le suivi</button>
        )}
      </div>
      {!enCours && reprise && (
        <p className="plai-help" id="serie-effacer-aide">
          Les images déjà créées ne sont pas recréées. « Effacer le suivi » oublie ce qui a été fait : la série entière pourra alors être recréée, et chaque image comptera de nouveau dans votre quota. Les images déjà créées restent dans l'Historique.
        </p>
      )}

      <div aria-live="polite">{message && <p className="plai-error" role="alert">{message}</p>}</div>
      {erreurs.length > 0 && (
        <ul className="plai-error" role="alert">{erreurs.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
    </details>
  )
}
