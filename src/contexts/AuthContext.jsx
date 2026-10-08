import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => setUser(session?.user ?? null))
      .finally(() => setLoading(false))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  // emailRedirectTo obligatoire : sans lui, le lien de confirmation renvoie vers une autre app PLAI.
  async function signUp(email, password) {
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function sendPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    return { error }
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) setPasswordRecovery(false)
    return { error }
  }

  return (
    <AuthContext.Provider value={{ user, loading, passwordRecovery, signIn, signUp, signOut, sendPasswordReset, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}
