import { describe, it, expect } from 'vitest'
import { extraireJson } from './extraireJson.js'

describe('extraireJson', () => {
  it('lit un JSON propre', () => {
    expect(extraireJson('{"a":1}')).toEqual({ a: 1 })
  })
  it('retire un bloc de code Markdown', () => {
    expect(extraireJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 })
    expect(extraireJson('```\n{"a": 1}\n```')).toEqual({ a: 1 })
  })
  it('ignore le texte avant et après l\'objet', () => {
    expect(extraireJson('Voici le JSON :\n{"a": {"b": [1, 2]}}\nJ\'espère que cela vous aide.')).toEqual({ a: { b: [1, 2] } })
  })
  it('gère des accolades à l\'intérieur des textes', () => {
    expect(extraireJson('Réponse : {"a": "un { dans le texte", "b": 2}')).toEqual({ a: 'un { dans le texte', b: 2 })
  })
  it('lève une SyntaxError quand il n\'y a pas de JSON exploitable', () => {
    expect(() => extraireJson('pas de json ici')).toThrow(SyntaxError)
    expect(() => extraireJson('{"a": ')).toThrow(SyntaxError)
    expect(() => extraireJson('')).toThrow(SyntaxError)
  })
})
