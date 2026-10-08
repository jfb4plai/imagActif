import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { TERMS_POINTS } from '../lib/terms.js'

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [erreur, setErreur] = useState('')
  const [succes, setSucces] = useState('')
  const [enCours, setEnCours] = useState(false)
  const { signIn, signUp, sendPasswordReset, updatePassword, passwordRecovery } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    setErreur('')
    setSucces('')
    setEnCours(true)
    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setErreur('E-mail ou mot de passe incorrect.')
    } else if (mode === 'reset') {
      const { error } = await sendPasswordReset(email)
      if (error) setErreur(error.message)
      else setSucces('E-mail envoyé. Vérifiez votre boîte mail pour créer un nouveau mot de passe.')
    } else {
      const { error } = await signUp(email, password)
      if (error) setErreur(error.message)
      else setSucces('Compte créé. Confirmez votre e-mail, puis connectez-vous : les règles d\'utilisation vous seront présentées à la première connexion.')
    }
    setEnCours(false)
  }

  async function handleUpdatePassword(e) {
    e.preventDefault()
    setErreur('')
    if (newPassword.length < 8) { setErreur('8 caractères minimum.'); return }
    setEnCours(true)
    const { error } = await updatePassword(newPassword)
    if (error) setErreur(error.message)
    setEnCours(false)
  }

  if (passwordRecovery) {
    return (
      <div className="plai-section">
        <div className="plai-card" style={{ maxWidth: 440, margin: '2rem auto' }}>
          <h2>Nouveau mot de passe</h2>
          <form onSubmit={handleUpdatePassword}>
            <div className="plai-field">
              <label className="plai-label" htmlFor="new-password">Nouveau mot de passe</label>
              <input id="new-password" type="password" className="plai-input" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} placeholder="8 caractères minimum" required minLength={8} />
              <p className="plai-help">Choisissez un mot de passe que vous n'utilisez pas ailleurs.</p>
            </div>
            {erreur && <p className="plai-error">{erreur}</p>}
            <button type="submit" className="plai-btn" disabled={enCours}>{enCours ? 'Chargement…' : 'Enregistrer'}</button>
          </form>
        </div>
      </div>
    )
  }

  const titre = mode === 'login' ? 'Se connecter' : mode === 'reset' ? 'Mot de passe oublié' : 'Créer mon compte'

  return (
    <div className="plai-section">
      <div className="plai-card" style={{ maxWidth: 440, margin: '2rem auto' }}>
        <h2>{titre}</h2>
        <p className="plai-help">
          {mode === 'login' && 'Si vous avez déjà un compte sur un autre outil PLAI, utilisez le même e-mail et le même mot de passe.'}
          {mode === 'register' && 'Utilisez votre e-mail professionnel. Un compte déjà créé sur un autre outil PLAI fonctionne ici aussi : connectez-vous.'}
          {mode === 'reset' && 'Saisissez l\'e-mail de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.'}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="plai-field">
            <label className="plai-label" htmlFor="email">Adresse e-mail</label>
            <input id="email" type="email" className="plai-input" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@ecole.be" autoComplete="email" required />
            <p className="plai-help">Sert uniquement à vous connecter et à vous envoyer les messages de confirmation.</p>
          </div>
          {mode !== 'reset' && (
            <div className="plai-field">
              <label className="plai-label" htmlFor="password">Mot de passe</label>
              <input id="password" type="password" className="plai-input" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="8 caractères minimum" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} />
              <p className="plai-help">{mode === 'register' ? 'Choisissez un mot de passe que vous n\'utilisez pas ailleurs.' : 'Celui de votre compte PLAI.'}</p>
            </div>
          )}
          {erreur && <p className="plai-error">{erreur}</p>}
          {succes && <p className="plai-success">{succes}</p>}
          <button type="submit" className="plai-btn" disabled={enCours}>{enCours ? 'Chargement…' : titre}</button>
        </form>
        <p style={{ marginTop: '1rem' }}>
          {mode !== 'login' && <button type="button" className="plai-nav-link" onClick={() => setMode('login')}>J'ai déjà un compte</button>}
          {mode === 'login' && <button type="button" className="plai-nav-link" onClick={() => setMode('register')}>Créer un compte</button>}
          {' · '}
          {mode !== 'reset' && <button type="button" className="plai-nav-link" onClick={() => setMode('reset')}>Mot de passe oublié</button>}
        </p>
        {mode === 'register' && (
          <div style={{ marginTop: '1.25rem' }}>
            <h3>Règles d'utilisation (résumé)</h3>
            <ul style={{ paddingLeft: '1.25rem' }}>
              {TERMS_POINTS.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
