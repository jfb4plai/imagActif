import { describe, it, expect } from 'vitest'
import { getIn, setIn } from './path.js'

describe('path', () => {
  it('lit un chemin imbriqué', () => {
    expect(getIn({ a: { b: 3 } }, 'a.b')).toBe(3)
    expect(getIn({ a: null }, 'a.b')).toBeUndefined()
  })
  it('écrit sans muter l\'original', () => {
    const o = { a: { b: 1, c: 2 } }
    const n = setIn(o, 'a.b', 9)
    expect(n).toEqual({ a: { b: 9, c: 2 } })
    expect(o.a.b).toBe(1)
  })
  it('crée les niveaux manquants', () => {
    expect(setIn({}, 'x.y', 1)).toEqual({ x: { y: 1 } })
  })
})
