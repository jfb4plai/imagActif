import { describe, it, expect } from 'vitest'
import { CONSIGNE_IMAGE_VERS_JSON, SCHEMA_EXEMPLE } from './consigneImage.js'
import { normaliserGabarit } from './gabarit.js'
import { RATIO_IDS } from './ratios.js'

describe('consigne « image vers JSON »', () => {
  it('le schéma montré à l\'IA est accepté tel quel par l\'import, sans avertissement', () => {
    const { avertissements } = normaliserGabarit(SCHEMA_EXEMPLE)
    expect(avertissements).toEqual([])
  })

  it('contient le schéma exact, avec toutes ses clés', () => {
    expect(CONSIGNE_IMAGE_VERS_JSON).toContain(JSON.stringify(SCHEMA_EXEMPLE, null, 2))
    for (const cle of ['sujet', 'style', 'composition', 'lumiere', 'exclusions', 'format', 'generation', 'personnalise']) {
      expect(Object.keys(SCHEMA_EXEMPLE)).toContain(cle)
    }
  })

  it('liste tous les formats acceptés', () => {
    for (const ratio of RATIO_IDS) expect(CONSIGNE_IMAGE_VERS_JSON).toContain(`"${ratio}"`)
  })

  it('demande l\'atmosphère et les textes visibles dans les champs personnalisés', () => {
    expect(CONSIGNE_IMAGE_VERS_JSON).toContain('Atmosphère')
    expect(CONSIGNE_IMAGE_VERS_JSON).toContain('Textes visibles')
  })

  it('annonce les limites réelles de l\'import (500 caractères, 10 champs)', () => {
    expect(CONSIGNE_IMAGE_VERS_JSON).toContain('500 caractères')
    expect(CONSIGNE_IMAGE_VERS_JSON).toContain('10 champs')
  })

  it('interdit d\'identifier des personnes et d\'inventer', () => {
    expect(CONSIGNE_IMAGE_VERS_JSON).toMatch(/n'identifie aucune personne/i)
    expect(CONSIGNE_IMAGE_VERS_JSON).toMatch(/n'invente rien/i)
  })

  it('demande une réponse JSON seule', () => {
    expect(CONSIGNE_IMAGE_VERS_JSON).toMatch(/UNIQUEMENT par un objet JSON/)
  })
})
