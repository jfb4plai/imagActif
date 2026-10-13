import { describe, it, expect } from 'vitest'
import { detecterTypeJson, messageTypeNonPris } from './typeJson.js'
import { gabaritVide } from './gabarit.js'

describe('detecterTypeJson', () => {
  it('reconnaît un gabarit ImagActif, complet ou partiel', () => {
    expect(detecterTypeJson(gabaritVide())).toBe('gabarit')
    expect(detecterTypeJson({ sujet: { description: 'un chat' } })).toBe('gabarit')
    expect(detecterTypeJson({})).toBe('gabarit')
  })
  it('reconnaît les quatre schémas externes', () => {
    expect(detecterTypeJson({ series: { id: 'a' }, invariants: {}, variables: [], output: {} })).toBe('serie')
    expect(detecterTypeJson({ source: {}, text_elements: [], edits: [], preserve: {} })).toBe('retouche')
    expect(detecterTypeJson({ scope: { mode: 'full' }, items: [] })).toBe('extraction')
    expect(detecterTypeJson({ id: '1', title: 't', summary: 's', tags: { subjects: ['x'] } })).toBe('archivage')
  })
  it('ne confond pas un gabarit avec un champ « title » ou « items » isolé', () => {
    expect(detecterTypeJson({ sujet: { description: 'x' }, title: 'a' })).toBe('gabarit')
    expect(detecterTypeJson({ items: [1] })).toBe('gabarit')
  })
  it('ne plante pas sur une entrée qui n\'est pas un objet', () => {
    expect(detecterTypeJson(null)).toBe('gabarit')
    expect(detecterTypeJson([1])).toBe('gabarit')
  })
  it('fournit un message pour chaque type non pris en charge', () => {
    for (const t of ['serie', 'retouche', 'extraction', 'archivage']) expect(messageTypeNonPris(t)).not.toBe('')
    expect(messageTypeNonPris('gabarit')).toBe('')
  })
})
