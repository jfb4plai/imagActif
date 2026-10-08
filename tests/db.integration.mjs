import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anon || !service) throw new Error('Variables Supabase manquantes (.env.local).')

const admin = createClient(url, service, { auth: { persistSession: false } })
const suffixe = Math.random().toString(36).slice(2, 8)
const motDePasse = `Test-${suffixe}-Aa1!xyz`
const comptes = []

async function creerCompte(nom) {
  const email = `imagactif-test-${nom}-${suffixe}@example.invalid`
  const { data, error } = await admin.auth.admin.createUser({ email, password: motDePasse, email_confirm: true })
  if (error) throw error
  const client = createClient(url, anon, { auth: { persistSession: false } })
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: motDePasse })
  if (e2) throw e2
  comptes.push(data.user.id)
  return { id: data.user.id, client }
}

let ok = 0
async function cas(nom, fn) {
  try { await fn(); ok++; console.log(`  ok  ${nom}`) } catch (e) { console.error(`  ECHEC ${nom}\n    ${e.message}`); process.exitCode = 1 }
}

try {
  const u1 = await creerCompte('u1')
  const u2 = await creerCompte('u2')

  await admin.from('img_accounts').insert([
    { user_id: u1.id, terms_version: 't' }, { user_id: u2.id, terms_version: 't' },
  ])

  await cas('u1 ne lit que son img_accounts', async () => {
    const { data, error } = await u1.client.from('img_accounts').select('user_id')
    assert.equal(error, null)
    assert.deepEqual(data.map((r) => r.user_id), [u1.id])
  })
  await cas('u1 ne peut pas insérer dans img_accounts', async () => {
    const { error } = await u1.client.from('img_accounts').insert({ user_id: u1.id, terms_version: 'x' })
    assert.ok(error)
  })
  await cas('u1 ne peut pas modifier trial_started_at', async () => {
    const { data } = await u1.client.from('img_accounts').update({ trial_started_at: '2030-01-01' }).eq('user_id', u1.id).select()
    assert.ok(!data || data.length === 0)
  })
  await cas('img_user_keys illisible pour authenticated', async () => {
    await admin.from('img_user_keys').insert({ user_id: u1.id, ciphertext: 'c', iv: 'i', secret_version: '1' })
    const { data, error } = await u1.client.from('img_user_keys').select('*')
    assert.ok(error || (data ?? []).length === 0)
    assert.ok(error, 'une erreur de droits est attendue')
  })
  await cas('u1 lit sans erreur img_accounts et img_generations (droits de lecture)', async () => {
    const a = await u1.client.from('img_accounts').select('*')
    assert.equal(a.error, null)
    const g = await u1.client.from('img_generations').select('*')
    assert.equal(g.error, null)
  })
  await cas('un client anonyme ne lit aucune table ImagActif', async () => {
    const anonyme = createClient(url, anon, { auth: { persistSession: false } })
    for (const table of ['img_accounts', 'img_generations', 'img_templates', 'img_usage']) {
      const { data, error } = await anonyme.from(table).select('*')
      assert.ok(error || (data ?? []).length === 0, `${table} lisible sans session`)
    }
  })
  await cas('img_jobs illisible pour authenticated', async () => {
    const { error } = await u1.client.from('img_jobs').select('*')
    assert.ok(error)
  })
  await cas('modèles : propres lignes seulement', async () => {
    const { error } = await u1.client.from('img_templates').insert({ user_id: u1.id, name: 'm1', json: {} })
    assert.equal(error, null)
    const { error: e2 } = await u1.client.from('img_templates').insert({ user_id: u2.id, name: 'x', json: {} })
    assert.ok(e2)
    const { data } = await u2.client.from('img_templates').select('id')
    assert.equal(data.length, 0)
  })
  await cas('génération : pas de suppression ni d\'écriture côté client', async () => {
    const { error } = await u1.client.from('img_generations').insert({ user_id: u1.id, json: {}, prompt_text: 'p', seed: 1, model: 'm', key_mode: 'own' })
    assert.ok(error)
  })
  await cas('une seule génération en cours par compte', async () => {
    const ligne = { user_id: u1.id, json: {}, prompt_text: 'p', seed: 1, model: 'm', key_mode: 'own', status: 'pending' }
    const a = await admin.from('img_generations').insert(ligne)
    assert.equal(a.error, null)
    const b = await admin.from('img_generations').insert(ligne)
    assert.equal(b.error?.code, '23505')
  })
  await cas('quota : limites utilisateur, global et remboursement', async () => {
    const jour = '2099-01-01'
    const r = (u, ul, gl) => admin.rpc('img_reserve_quota', { p_user: u, p_day: jour, p_user_limit: ul, p_global_limit: gl })
    assert.equal((await r(u1.id, 2, 3)).data, 'ok')
    assert.equal((await r(u1.id, 2, 3)).data, 'ok')
    assert.equal((await r(u1.id, 2, 3)).data, 'user_limit')
    assert.equal((await r(u2.id, 2, 3)).data, 'ok')
    assert.equal((await r(u2.id, 2, 3)).data, 'global_limit')
    await admin.rpc('img_refund_quota', { p_user: u1.id, p_day: jour })
    assert.equal((await r(u1.id, 2, 4)).data, 'ok')
  })
  await cas('un client ne peut pas appeler les fonctions de quota', async () => {
    const { error } = await u1.client.rpc('img_reserve_quota', { p_user: u1.id, p_day: '2099-01-02', p_user_limit: 99, p_global_limit: 99 })
    assert.ok(error)
  })
  await cas('stockage : lecture de ses fichiers seulement', async () => {
    const octets = new Uint8Array([1, 2, 3])
    await admin.storage.from('img-generations').upload(`${u1.id}/a.png`, octets, { contentType: 'image/png', upsert: true })
    await admin.storage.from('img-generations').upload(`${u2.id}/b.png`, octets, { contentType: 'image/png', upsert: true })
    const propre = await u1.client.storage.from('img-generations').createSignedUrl(`${u1.id}/a.png`, 60)
    assert.equal(propre.error, null)
    const autre = await u1.client.storage.from('img-generations').createSignedUrl(`${u2.id}/b.png`, 60)
    assert.ok(autre.error)
  })
} finally {
  for (const id of comptes) {
    const { data: fichiers } = await admin.storage.from('img-generations').list(id)
    if (fichiers?.length) await admin.storage.from('img-generations').remove(fichiers.map((f) => `${id}/${f.name}`))
    await admin.from('img_usage').delete().eq('user_id', id)
    await admin.auth.admin.deleteUser(id)
  }
  console.log(`${ok} cas réussis. Comptes jetables supprimés.`)
}
