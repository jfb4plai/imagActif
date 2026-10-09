import { supabase } from './supabaseClient.js'

const BUCKET = 'img-generations'
const COLONNES = 'id, json, prompt_text, seed, status, image_path, image_expires_at, image_deleted_at, parent_id, edit_instruction, created_at'

function ok({ data, error }) {
  if (error) throw error
  return data
}

export async function getAccount() {
  return ok(await supabase.from('img_accounts').select('*').maybeSingle())
}

export async function usageDuJour(jour) {
  const ligne = ok(await supabase.from('img_usage').select('count').eq('day', jour).maybeSingle())
  return ligne?.count ?? 0
}

export async function listerGenerations(limite = 60) {
  return ok(await supabase.from('img_generations').select(COLONNES).order('created_at', { ascending: false }).limit(limite))
}

export async function getGeneration(id) {
  return ok(await supabase.from('img_generations').select(COLONNES).eq('id', id).single())
}

// Liens signés (lecture de ses propres fichiers seulement, grâce à la politique de stockage).
export async function urlsSignees(chemins, secondes = 600) {
  if (!chemins.length) return {}
  const lignes = ok(await supabase.storage.from(BUCKET).createSignedUrls(chemins, secondes))
  return Object.fromEntries(lignes.filter((l) => l.signedUrl).map((l) => [l.path, l.signedUrl]))
}

export async function urlTelechargement(chemin, nomFichier) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, 60, { download: nomFichier })
  if (error) throw error
  return data.signedUrl
}

export async function listerModeles() {
  return ok(await supabase.from('img_templates').select('*').order('created_at', { ascending: false }))
}

export async function enregistrerModele({ nom, json, verrous = [] }) {
  const { data: { user } } = await supabase.auth.getUser()
  return ok(await supabase.from('img_templates').insert({ user_id: user.id, name: nom, json, locked_fields: verrous }).select().single())
}

export async function majVerrousModele(id, verrous) {
  ok(await supabase.from('img_templates').update({ locked_fields: verrous }).eq('id', id))
}

export async function supprimerModele(id) {
  ok(await supabase.from('img_templates').delete().eq('id', id))
}
