import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// IMG_KEY_SECRETS = JSON {"1":"<32 octets en base64>", ...} ; IMG_KEY_CURRENT = version utilisée pour chiffrer.
export function ringFromEnv(env = process.env) {
  const raw = env.IMG_KEY_SECRETS
  const current = env.IMG_KEY_CURRENT
  if (!raw || !current) throw new Error('IMG_KEY_SECRETS / IMG_KEY_CURRENT manquants.')
  const keys = {}
  for (const [version, b64] of Object.entries(JSON.parse(raw))) {
    const buf = Buffer.from(b64, 'base64')
    if (buf.length !== 32) throw new Error(`Secret ${version} : 32 octets attendus.`)
    keys[version] = buf
  }
  if (!keys[current]) throw new Error(`Secret courant ${current} introuvable.`)
  return { current, keys }
}

// L'identifiant de l'utilisateur est lié au chiffrement (AAD) : un texte chiffré copié vers un autre compte est inutilisable.
export function chiffrer(clair, userId, ring) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', ring.keys[ring.current], iv)
  cipher.setAAD(Buffer.from(userId))
  const ct = Buffer.concat([cipher.update(clair, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    ciphertext: Buffer.concat([ct, tag]).toString('base64'),
    iv: iv.toString('base64'),
    secret_version: ring.current,
  }
}

export function dechiffrer(rec, userId, ring) {
  const key = ring.keys[rec.secret_version]
  if (!key) throw new Error(`Secret ${rec.secret_version} indisponible.`)
  const brut = Buffer.from(rec.ciphertext, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(rec.iv, 'base64'))
  decipher.setAAD(Buffer.from(userId))
  decipher.setAuthTag(brut.subarray(brut.length - 16))
  return Buffer.concat([decipher.update(brut.subarray(0, brut.length - 16)), decipher.final()]).toString('utf8')
}
