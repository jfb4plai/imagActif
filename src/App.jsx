import { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { useCompte } from './lib/useCompte.js'
import { determineRegime } from './lib/regime.js'
import { TERMS_VERSION } from './lib/terms.js'
import { gabaritVide } from './lib/gabarit.js'
import Login from './pages/Login.jsx'
import Reglement from './pages/Reglement.jsx'
import Creer from './pages/Creer.jsx'
import Historique from './pages/Historique.jsx'
import Modeles from './pages/Modeles.jsx'
import MesDonnees from './pages/MesDonnees.jsx'

const VUES = [['creer', 'Créer'], ['historique', 'Historique'], ['modeles', 'Modèles'], ['donnees', 'Mes données']]
const brouillonVide = () => ({ gabarit: gabaritVide(), parentId: null, verrous: [] })

function Contenu() {
  const { user, loading, signOut, passwordRecovery } = useAuth()
  const { chargement, compte, usage, recharger } = useCompte(user)
  const [vue, setVue] = useState('creer')
  const [brouillon, setBrouillon] = useState(brouillonVide)

  const accepte = compte && compte.terms_version === TERMS_VERSION
  const regime = accepte ? determineRegime({ trialStartedAt: compte.trial_started_at, hasOwnKey: compte.has_own_key }) : 'none'

  function ouvrirDansCreer(b) {
    setBrouillon({ parentId: null, verrous: [], ...b })
    setVue('creer')
  }

  let page = null
  if (!loading) {
    if (!user || passwordRecovery) page = <Login />
    else if (chargement) page = null
    else if (!accepte) page = <Reglement onAccepte={recharger} />
    else if (vue === 'creer') page = <Creer brouillon={brouillon} setBrouillon={setBrouillon} compte={compte} usage={usage} regime={regime} recharger={recharger} ouvrirDansCreer={ouvrirDansCreer} />
    else if (vue === 'historique') page = <Historique ouvrirDansCreer={ouvrirDansCreer} />
    else if (vue === 'modeles') page = <Modeles ouvrirDansCreer={ouvrirDansCreer} />
    else page = <MesDonnees compte={compte} regime={regime} recharger={recharger} signOut={signOut} />
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <nav className="plai-nav">
        <a href="/" className="plai-nav-logo">
          <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 32, width: 'auto' }} />
          ImagActif
        </a>
        {user && accepte && (
          <div className="plai-nav-actions img-tabs">
            {VUES.map(([id, label]) => (
              <button key={id} type="button" className="plai-nav-link" aria-current={vue === id ? 'page' : undefined}
                style={vue === id ? { fontWeight: 700, textDecoration: 'underline' } : undefined} onClick={() => setVue(id)}>
                {label}
              </button>
            ))}
            <button type="button" className="plai-nav-link" onClick={signOut}>Se déconnecter</button>
          </div>
        )}
      </nav>

      <div className="plai-container">{page}</div>

      <footer className="plai-footer">
        <p>ImagActif : outil PLAI, Pôle Territorial de la Ville de Liège</p>
        <p>Les images sont générées par une IA : à relire avant tout usage en classe.</p>
        <p>
          Contact : jf.beguin@outlook.com · Code :{' '}
          <a href="https://polyformproject.org/licenses/noncommercial/1.0.0" target="_blank" rel="noopener noreferrer">PolyForm Noncommercial 1.0.0</a>
          {' · '}Jean-François Beguin, jfb4plai.com
        </p>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Contenu />
    </AuthProvider>
  )
}
