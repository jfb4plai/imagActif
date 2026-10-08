export const IMAGE_RETENTION_DAYS = 30
const JOUR_MS = 86400000

export function imageExpiry(depuis = new Date()) {
  return new Date(depuis.getTime() + IMAGE_RETENTION_DAYS * JOUR_MS)
}

export function joursRestants(expiration, now = new Date()) {
  const ms = new Date(expiration).getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / JOUR_MS))
}

export function niveauUrgence(jours) {
  if (jours <= 0) return 'expire'
  if (jours <= 5) return 'bientot'
  return 'ok'
}

// Jour calendaire de Bruxelles, au format YYYY-MM-DD (clé du quota quotidien).
export function jourBruxelles(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(date)
}
