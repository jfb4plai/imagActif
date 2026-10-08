import { useCallback, useEffect, useState } from 'react'
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
      <p className="plai-help">Vos images sont supprimées 30 jours après leur création ; leur JSON reste ici jusqu'à ce que vous le supprimiez.</p>
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
