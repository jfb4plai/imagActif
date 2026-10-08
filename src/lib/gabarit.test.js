import { describe, it, expect } from 'vitest'
import { gabaritVide, normaliserGabarit, validerPourGeneration, EXCLUSION_DEFAUT, SCHEMA_VERSION, PROMPT_MAX_CARACTERES } from './gabarit.js'
import { dimensions, RATIO_IDS } from './ratios.js'

describe('ratios', () => {
  it('toutes les dimensions sont des multiples de 16', () => {
    for (const id of RATIO_IDS) {
      const { width, height } = dimensions(id)
      expect(width % 16).toBe(0)
      expect(height % 16).toBe(0)
    }
  })
  it('refuse un format inconnu', () => {
    expect(() => dimensions('2:1')).toThrow('Format inconnu')
  })
})

describe('gabaritVide', () => {
  it('contient l\'exclusion par défaut et le format carré', () => {
    const g = gabaritVide()
    expect(g.exclusions).toEqual([EXCLUSION_DEFAUT])
    expect(g.format.ratio).toBe('1:1')
    expect(g.generation.seed).toBeNull()
  })
  it('est invalide sans sujet', () => {
    expect(validerPourGeneration(gabaritVide())).toEqual(["Décrivez le sujet de l'image."])
  })
})

describe('normaliserGabarit', () => {
  it('rejette ce qui n\'est pas un objet', () => {
    expect(() => normaliserGabarit(null)).toThrow('objet')
    expect(() => normaliserGabarit([])).toThrow('objet')
    expect(() => normaliserGabarit('x')).toThrow('objet')
  })
  it('remplit les valeurs par défaut', () => {
    const { gabarit } = normaliserGabarit({ sujet: { description: 'Un chat' } })
    expect(gabarit.sujet.description).toBe('Un chat')
    expect(gabarit.exclusions).toEqual([EXCLUSION_DEFAUT])
    expect(gabarit.format.ratio).toBe('1:1')
  })
  it('respecte une liste d\'exclusions vide fournie par l\'enseignant', () => {
    const { gabarit } = normaliserGabarit({ sujet: { description: 'a' }, exclusions: [] })
    expect(gabarit.exclusions).toEqual([])
  })
  it('range les clés inconnues dans personnalise avec un avertissement', () => {
    const { gabarit, avertissements } = normaliserGabarit({ sujet: { description: 'a' }, humeur: 'joyeuse', cadre: { x: 1 } })
    expect(gabarit.personnalise).toEqual([
      { nom: 'humeur', valeur: 'joyeuse' },
      { nom: 'cadre', valeur: '{"x":1}' },
    ])
    expect(avertissements).toHaveLength(2)
  })
  it('tronque les textes trop longs et nettoie les espaces', () => {
    const { gabarit } = normaliserGabarit({ sujet: { description: `  ${'a'.repeat(900)}  ` } })
    expect(gabarit.sujet.description).toHaveLength(500)
  })
  it('valide la graine et le format', () => {
    const a = normaliserGabarit({ sujet: { description: 'a' }, generation: { seed: 42 }, format: { ratio: '16:9' } })
    expect(a.gabarit.generation.seed).toBe(42)
    expect(a.gabarit.format.ratio).toBe('16:9')
    const b = normaliserGabarit({ sujet: { description: 'a' }, generation: { seed: -3 }, format: { ratio: '5:1' } })
    expect(b.gabarit.generation.seed).toBeNull()
    expect(b.gabarit.format.ratio).toBe('1:1')
    expect(b.avertissements).toHaveLength(2)
  })
  it('limite et nettoie personnalise', () => {
    const perso = Array.from({ length: 15 }, (_, i) => ({ nom: `n${i}`, valeur: `v${i}` }))
    perso.push({ nom: '', valeur: 'x' })
    const { gabarit } = normaliserGabarit({ sujet: { description: 'a' }, personnalise: perso })
    expect(gabarit.personnalise).toHaveLength(10)
  })
  it('ne contient jamais de clé dangereuse héritée', () => {
    const { gabarit } = normaliserGabarit(JSON.parse('{"sujet":{"description":"a"},"__proto__":{"x":1}}'))
    expect(Object.prototype.hasOwnProperty.call(gabarit, 'x')).toBe(false)
    expect({}.x).toBeUndefined()
  })
})

describe('gabarit v2', () => {
  it('gabaritVide est en version 2 avec les nouveaux groupes vides', () => {
    const g = gabaritVide()
    expect(SCHEMA_VERSION).toBe(2)
    expect(g.schema_version).toBe(2)
    expect(g.elements).toEqual([])
    expect(g.textes).toEqual([])
    expect(g.couleurs).toEqual({ dominantes: '', saturation: '', contraste: '', harmonie: '' })
    expect(g.composition).toEqual({ cadrage: '', point_de_vue: '', arriere_plan: '', profondeur: '', plans: '', symetrie: '' })
    expect(g.eclairage).toEqual({ source: '', direction: '', qualite: '', temperature: '', ombres: '' })
    expect(g.decor).toEqual({ lieu: '', moment: '', meteo_saison: '', elements: '' })
    expect(g.rendu).toEqual({ nettete: '', textures: '', grain: '' })
    expect(g.atmosphere).toBe('')
    expect(g.mouvement).toBe('')
  })

  it('convertit un JSON v1 en v2 sans perte', () => {
    const v1 = {
      schema_version: 1,
      sujet: { description: 'Un chat', details: 'roux' },
      style: { type: 'aquarelle', palette: 'chaud' },
      composition: { cadrage: 'serré', point_de_vue: 'face', arriere_plan: 'uni' },
      lumiere: 'douce',
      exclusions: ['ombres dures'],
      format: { ratio: '16:9' },
      generation: { seed: 7 },
      personnalise: [{ nom: 'Saison', valeur: 'automne' }],
    }
    const { gabarit, avertissements } = normaliserGabarit(v1)
    expect(avertissements).toEqual([])
    expect(gabarit.schema_version).toBe(2)
    expect(gabarit).toMatchObject({
      sujet: { description: 'Un chat', details: 'roux' },
      style: { type: 'aquarelle', palette: 'chaud' },
      lumiere: 'douce',
      exclusions: ['ombres dures'],
      format: { ratio: '16:9' },
      generation: { seed: 7 },
      personnalise: [{ nom: 'Saison', valeur: 'automne' }],
    })
    expect(gabarit.composition).toMatchObject({ cadrage: 'serré', point_de_vue: 'face', arriere_plan: 'uni', profondeur: '' })
    expect(gabarit.elements).toEqual([])
    expect(gabarit.textes).toEqual([])
  })

  it('nettoie et tronque les nouveaux groupes, ignore les sous-clés inconnues', () => {
    const { gabarit } = normaliserGabarit({
      sujet: { description: 'a' },
      couleurs: { dominantes: `  ${'x'.repeat(700)} `, saturation: 'vive', inconnue: 'zzz' },
      eclairage: { source: 'fenêtre', ombres: 12 },
      decor: { lieu: 'classe' },
      rendu: { grain: 'fin' },
      atmosphere: '  calme ',
      mouvement: 'vent léger',
    })
    expect(gabarit.couleurs.dominantes).toHaveLength(500)
    expect(gabarit.couleurs.saturation).toBe('vive')
    expect(gabarit.couleurs).not.toHaveProperty('inconnue')
    expect(gabarit.eclairage.source).toBe('fenêtre')
    expect(gabarit.eclairage.ombres).toBe('')
    expect(gabarit.decor.lieu).toBe('classe')
    expect(gabarit.rendu.grain).toBe('fin')
    expect(gabarit.atmosphere).toBe('calme')
    expect(gabarit.mouvement).toBe('vent léger')
  })

  it('elements : ignore les entrées invalides, tronque, plafonne à 15', () => {
    const elements = [
      { nom: 'table', position: 'au centre', details: 'en bois' },
      { nom: '', position: 'x' },
      'texte',
      null,
      [],
      { nom: 'long', details: 'd'.repeat(900) },
      ...Array.from({ length: 20 }, (_, i) => ({ nom: `e${i}` })),
    ]
    const { gabarit } = normaliserGabarit({ sujet: { description: 'a' }, elements })
    expect(gabarit.elements).toHaveLength(15)
    expect(gabarit.elements[0]).toEqual({ nom: 'table', position: 'au centre', details: 'en bois' })
    expect(gabarit.elements[1].nom).toBe('long')
    expect(gabarit.elements[1].details).toHaveLength(500)
    expect(gabarit.elements[1].position).toBe('')
  })

  it('elements non tableau : ignoré', () => {
    const { gabarit } = normaliserGabarit({ sujet: { description: 'a' }, elements: 'x', textes: { a: 1 } })
    expect(gabarit.elements).toEqual([])
    expect(gabarit.textes).toEqual([])
  })

  it('textes : ignore sans contenu, tronque, plafonne à 10', () => {
    const textes = [
      { contenu: 'Titre', position: 'en haut', style: 'gras' },
      { contenu: '  ', position: 'x' },
      42,
      { contenu: 'c'.repeat(900) },
      ...Array.from({ length: 15 }, (_, i) => ({ contenu: `t${i}` })),
    ]
    const { gabarit } = normaliserGabarit({ sujet: { description: 'a' }, textes })
    expect(gabarit.textes).toHaveLength(10)
    expect(gabarit.textes[0]).toEqual({ contenu: 'Titre', position: 'en haut', style: 'gras' })
    expect(gabarit.textes[1].contenu).toHaveLength(500)
  })

  it('range toujours les clés inconnues dans personnalise', () => {
    const { gabarit, avertissements } = normaliserGabarit({ sujet: { description: 'a' }, humeur: 'joyeuse', atmosphere: 'calme' })
    expect(gabarit.personnalise).toEqual([{ nom: 'humeur', valeur: 'joyeuse' }])
    expect(gabarit.atmosphere).toBe('calme')
    expect(avertissements).toHaveLength(1)
  })

  it('refuse un prompt trop long avec le message exact', () => {
    expect(PROMPT_MAX_CARACTERES).toBe(4000)
    const { gabarit } = normaliserGabarit({
      sujet: { description: 'a'.repeat(500), details: 'b'.repeat(500) },
      personnalise: Array.from({ length: 10 }, (_, i) => ({ nom: `n${i}`, valeur: 'v'.repeat(500) })),
    })
    const erreurs = validerPourGeneration(gabarit)
    expect(erreurs).toHaveLength(1)
    expect(erreurs[0]).toMatch(/^La description est trop longue \((\d+) caractères sur 4000\) : raccourcissez-la\.$/)
    const n = Number(erreurs[0].match(/\((\d+) /)[1])
    expect(n).toBeGreaterThan(4000)
  })

  it('accepte un prompt de taille normale', () => {
    const { gabarit } = normaliserGabarit({ sujet: { description: 'Un chat' } })
    expect(validerPourGeneration(gabarit)).toEqual([])
  })
})
