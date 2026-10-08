import { useCallback, useEffect, useRef, useState } from 'react'
import CarteImage from '../components/CarteImage.jsx'
import { api } from '../lib/api.js'
import { listerGenerations, urlsSignees, urlTelechargement } from '../lib/data.js'

export default function Historique({ ouvrirDansCreer }) {
  const [generations, setGenerations] = useState(null)
  const [urls, setUrls] = useState({})
  const [erreur, setErreur] = useState('')

  const charger = useCallback(async () => {
    try {
      const liste = await listerGenerations()
      setGenerations(liste)
      setUrls(await urlsSignees(liste.filter((g) => g.image_path).map((g) => g.image_path)))
    } catch (e) {
      setErreur(e.message)
    }
  }, [])
  useEffect(() => { charger() }, [charger])

  // Suivi des générations en cours : une seule minuterie, active seulement s'il reste une carte « pending ».
  const idsEnCours = (generations ?? []).filter((g) => g.status === 'pending').map((g) => g.id).join(',')
  const enCoursRef = useRef('')
  enCoursRef.current = idsEnCours
  useEffect(() => {
    if (!idsEnCours) return undefined
    let actif = true
    let occupe = false
    const minuterie = setInterval(async () => {
      if (occupe) return
      occupe = true
      try {
        const ids = enCoursRef.current.split(',').filter(Boolean)
        const etats = await Promise.all(ids.map((id) => api.statut(id).then((s) => s.status).catch(() => 'pending')))
        if (actif && etats.some((s) => s !== 'pending')) await charger()
      } finally {
        occupe = false
      }
    }, 3000)
    return () => { actif = false; clearInterval(minuterie) }
  }, [idsEnCours, charger])

  async function telecharger(gen) {
    try {
      const ext = gen.image_path.split('.').pop()
      const lien = await urlTelechargement(gen.image_path, `imagactif-${gen.id.slice(0, 8)}.${ext}`)
      window.location.assign(lien)
    } catch (e) {
      setErreur(e.message)
    }
  }

  async function supprimer(gen) {
    if (!window.confirm('Supprimer cette image et son JSON ? Cette action est définitive.')) return
    try {
      await api.supprimerGeneration(gen.id)
      await charger()
    } catch (e) {
      setErreur(e.message)
    }
  }

  return (
    <div className="plai-section">
      <h2>Historique</h2>
      <p className="plai-help">Vos images sont supprimées 30 jours après leur création ; leur JSON reste ici un an au maximum après leur création (ou jusqu'à ce que vous le supprimiez).</p>
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
      {generations === null && !erreur && <p className="plai-help">Chargement…</p>}
      {generations?.length === 0 && <p className="plai-empty">Aucune image pour l'instant. Créez-en une dans l'onglet « Créer ».</p>}
      <div className="img-grid">
        {generations?.map((g) => (
          <CarteImage key={g.id} gen={g} url={urls[g.image_path]}
            onVariante={() => ouvrirDansCreer({ gabarit: g.json, parentId: g.id })}
            onTelecharger={() => telecharger(g)}
            onSupprimer={() => supprimer(g)} />
        ))}
      </div>
    </div>
  )
}
