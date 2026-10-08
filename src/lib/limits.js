export function limitsFromEnv(env = process.env) {
  const n = (v, defaut) => {
    const x = Number.parseInt(v, 10)
    return Number.isFinite(x) && x > 0 ? x : defaut
  }
  return { user: n(env.IMG_TRIAL_DAILY_LIMIT, 10), global: n(env.IMG_GLOBAL_DAILY_LIMIT, 100) }
}
