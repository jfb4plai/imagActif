import { timingSafeEqual } from 'node:crypto'

// Vercel Cron envoie « Authorization: Bearer <CRON_SECRET> ». Comparaison en temps constant.
export function verifierCron(enTete, secret) {
  if (!secret) return false
  const attendu = Buffer.from(`Bearer ${secret}`)
  const recu = Buffer.from(String(enTete ?? ''))
  if (recu.length !== attendu.length) return false
  return timingSafeEqual(recu, attendu)
}
