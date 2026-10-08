export function getIn(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

export function setIn(obj, path, value) {
  const [k, ...rest] = path.split('.')
  if (!rest.length) return { ...obj, [k]: value }
  return { ...obj, [k]: setIn(obj?.[k] ?? {}, rest.join('.'), value) }
}
