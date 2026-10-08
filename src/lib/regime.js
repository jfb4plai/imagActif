export const TRIAL_DAYS = 3

export function trialEnd(trialStartedAt) {
  return new Date(new Date(trialStartedAt).getTime() + TRIAL_DAYS * 86400000)
}

// 'own' : clé personnelle ; 'trial' : essai sur la clé de JF ; 'none' : génération impossible.
export function determineRegime({ trialStartedAt, hasOwnKey, now = new Date() }) {
  if (hasOwnKey) return 'own'
  if (trialStartedAt && now < trialEnd(trialStartedAt)) return 'trial'
  return 'none'
}
