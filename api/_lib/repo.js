import { admin } from './admin.js'

const BUCKET = 'img-generations'

function ok({ data, error }) {
  if (error) throw error
  return data
}

export function createRepo(getDb = admin) {
  const db = () => getDb()
  const storage = () => db().storage.from(BUCKET)

  return {
    async getAccount(userId) {
      return ok(await db().from('img_accounts').select('*').eq('user_id', userId).maybeSingle())
    },
    // N'écrit pas trial_started_at : il est posé une seule fois (défaut now()) à la première acceptation.
    async upsertAccount(userId, version, nowIso) {
      return ok(await db().from('img_accounts')
        .upsert({ user_id: userId, terms_version: version, terms_accepted_at: nowIso }, { onConflict: 'user_id' })
        .select().single())
    },
    async getKey(userId) {
      return ok(await db().from('img_user_keys').select('ciphertext, iv, secret_version').eq('user_id', userId).maybeSingle())
    },
    async saveKey(userId, rec) {
      ok(await db().from('img_user_keys').upsert({ user_id: userId, ...rec }, { onConflict: 'user_id' }))
      ok(await db().from('img_accounts').update({ has_own_key: true }).eq('user_id', userId))
    },
    async deleteKey(userId) {
      ok(await db().from('img_user_keys').delete().eq('user_id', userId))
      ok(await db().from('img_accounts').update({ has_own_key: false }).eq('user_id', userId))
    },
    async reserveQuota(userId, day, userLimit, globalLimit) {
      return ok(await db().rpc('img_reserve_quota', { p_user: userId, p_day: day, p_user_limit: userLimit, p_global_limit: globalLimit }))
    },
    async refundQuota(userId, day) {
      ok(await db().rpc('img_refund_quota', { p_user: userId, p_day: day }))
    },
    async failStalePending(userId, olderThanIso) {
      const lignes = ok(await db().from('img_generations').update({ status: 'failed' })
        .eq('user_id', userId).eq('status', 'pending').lt('created_at', olderThanIso)
        .select('id, user_id, quota_day'))
      if (lignes.length) ok(await db().from('img_jobs').delete().in('generation_id', lignes.map((l) => l.id)))
      return lignes
    },
    async failStaleAll(olderThanIso) {
      const lignes = ok(await db().from('img_generations').update({ status: 'failed' })
        .eq('status', 'pending').lt('created_at', olderThanIso)
        .select('id, user_id, quota_day'))
      if (lignes.length) ok(await db().from('img_jobs').delete().in('generation_id', lignes.map((l) => l.id)))
      return lignes
    },
    async insertGeneration(row) {
      const { data, error } = await db().from('img_generations').insert(row).select().single()
      if (error) {
        if (error.code === '23505') throw Object.assign(new Error('busy'), { code: 'busy' })
        throw error
      }
      return data
    },
    async insertJob(generationId, pollingUrl) {
      ok(await db().from('img_jobs').insert({ generation_id: generationId, polling_url: pollingUrl }))
    },
    async getGeneration(id, userId) {
      return ok(await db().from('img_generations').select('*').eq('id', id).eq('user_id', userId).maybeSingle())
    },
    async getJob(generationId) {
      return ok(await db().from('img_jobs').select('*').eq('generation_id', generationId).maybeSingle())
    },
    async deleteJob(generationId) {
      ok(await db().from('img_jobs').delete().eq('generation_id', generationId))
    },
    async markDone(id, imagePath, expiresAtIso) {
      ok(await db().from('img_generations').update({ status: 'done', image_path: imagePath, image_expires_at: expiresAtIso }).eq('id', id))
    },
    async markFailed(id, status) {
      ok(await db().from('img_generations').update({ status }).eq('id', id))
    },
    async uploadImage(path, buffer, contentType) {
      const { error } = await storage().upload(path, buffer, { contentType, upsert: true })
      if (error) throw error
    },
    async removeImages(paths) {
      if (!paths.length) return
      const { error } = await storage().remove(paths)
      if (error) throw error
    },
    async listExpired(nowIso, limit) {
      return ok(await db().from('img_generations').select('id, image_path')
        .not('image_path', 'is', null).is('image_deleted_at', null).lt('image_expires_at', nowIso).limit(limit))
    },
    async markImagesDeleted(ids, nowIso) {
      ok(await db().from('img_generations').update({ image_path: null, image_deleted_at: nowIso }).in('id', ids))
    },
    async deleteGeneration(id, userId) {
      ok(await db().from('img_generations').delete().eq('id', id).eq('user_id', userId))
    },
    // Supprime toutes les données ImagActif d'un utilisateur. L'identifiant de connexion (auth.users) est conservé : il est partagé entre apps PLAI.
    async deleteAllUserData(userId) {
      for (let i = 0; i < 20; i++) {
        const { data, error } = await storage().list(userId, { limit: 1000 })
        if (error) throw error
        if (!data?.length) break
        const { error: e2 } = await storage().remove(data.map((f) => `${userId}/${f.name}`))
        if (e2) throw e2
      }
      for (const table of ['img_templates', 'img_usage', 'img_user_keys', 'img_generations']) {
        ok(await db().from(table).delete().eq('user_id', userId))
      }
      // La ligne de compte est conservée sans les règles acceptées ni la clé : seule la date de début d'essai reste,
      // sinon supprimer ses données renouvellerait l'essai gratuit à l'infini. Réacceptation requise à la reconnexion.
      ok(await db().from('img_accounts').update({ terms_version: '', has_own_key: false }).eq('user_id', userId))
    },
  }
}
