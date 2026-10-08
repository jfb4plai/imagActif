import { createClient } from '@supabase/supabase-js'

let anon
function client() {
  if (!anon) {
    anon = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    )
  }
  return anon
}

// Valide le jeton Supabase (Authorization: Bearer <access_token>) ; envoie la 401 et retourne null sinon.
export async function requireUser(req, res) {
  const entete = req.headers.authorization || ''
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7) : null
  if (!jeton) {
    res.status(401).json({ error: 'Connexion requise.' })
    return null
  }
  const { data, error } = await client().auth.getUser(jeton)
  if (error || !data?.user) {
    res.status(401).json({ error: 'Session invalide ou expirée : reconnectez-vous.' })
    return null
  }
  return data.user
}
