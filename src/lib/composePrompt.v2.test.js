import { describe, it, expect } from 'vitest'
import { composePrompt } from './composePrompt.js'
import { gabaritVide } from './gabarit.js'

function base() {
  const g = gabaritVide()
  g.sujet.description = 'Un chat roux qui dort sur un rebord de fenêtre'
  g.exclusions = []
  return g
}
const DEBUT = 'Un chat roux qui dort sur un rebord de fenêtre.'

describe('composePrompt : gabarit v2', () => {
  it('éléments avec et sans position et détails', () => {
    const g = base()
    g.elements = [
      { nom: 'table', position: 'au centre', details: 'en bois clair' },
      { nom: 'cartable', position: 'sous la table', details: '' },
      { nom: 'plante', position: '', details: 'très verte' },
      { nom: 'horloge', position: '', details: '' },
    ]
    expect(composePrompt(g)).toBe(
      `${DEBUT} Éléments : table (au centre) : en bois clair ; cartable (sous la table) ; plante : très verte ; horloge.`
    )
  })

  it('couleurs', () => {
    const g = base()
    g.couleurs = { dominantes: 'orange et beige', saturation: 'douce', contraste: 'faible', harmonie: 'analogue' }
    expect(composePrompt(g)).toBe(
      `${DEBUT} Couleurs dominantes : orange et beige. Saturation : douce. Contraste : faible. Harmonie des couleurs : analogue.`
    )
  })

  it("composition avancée après le point de vue et l'arrière-plan", () => {
    const g = base()
    g.composition = { cadrage: 'serré', point_de_vue: 'face', arriere_plan: 'uni', profondeur: 'faible', plans: 'deux plans', symetrie: 'asymétrique' }
    expect(composePrompt(g)).toBe(
      `${DEBUT} Cadrage : serré. Point de vue : face. Arrière-plan : uni. Profondeur de champ : faible. Plans présents : deux plans. Symétrie : asymétrique.`
    )
  })

  it('éclairage après la lumière', () => {
    const g = base()
    g.lumiere = 'douce'
    g.eclairage = { source: 'fenêtre', direction: 'de gauche', qualite: 'diffuse', temperature: 'chaude', ombres: 'légères' }
    expect(composePrompt(g)).toBe(
      `${DEBUT} Lumière : douce. Source de lumière : fenêtre. Direction de la lumière : de gauche. Qualité de la lumière : diffuse. Température de la lumière : chaude. Ombres : légères.`
    )
  })

  it('décor', () => {
    const g = base()
    g.decor = { lieu: 'classe de P3', moment: 'matin', meteo_saison: 'pluie en automne', elements: 'cartes au mur' }
    expect(composePrompt(g)).toBe(
      `${DEBUT} Lieu : classe de P3. Moment : matin. Météo et saison : pluie en automne. Éléments du décor : cartes au mur.`
    )
  })

  it('atmosphère', () => {
    const g = base()
    g.atmosphere = 'calme et rassurante'
    expect(composePrompt(g)).toBe(`${DEBUT} Atmosphère : calme et rassurante.`)
  })

  it('textes avec et sans parenthèse', () => {
    const g = base()
    g.textes = [
      { contenu: 'Bonjour', position: 'en haut à gauche', style: 'gras' },
      { contenu: 'Liège', position: '', style: 'rouge' },
      { contenu: 'Fin', position: 'en bas', style: '' },
      { contenu: 'Seul', position: '', style: '' },
    ]
    expect(composePrompt(g)).toBe(
      `${DEBUT} Texte visible : « Bonjour » (en haut à gauche, gras). Texte visible : « Liège » (rouge). Texte visible : « Fin » (en bas). Texte visible : « Seul ».`
    )
  })

  it('rendu', () => {
    const g = base()
    g.rendu = { nettete: 'nette', textures: 'papier', grain: 'fin' }
    expect(composePrompt(g)).toBe(`${DEBUT} Netteté : nette. Textures : papier. Grain : fin.`)
  })

  it('mouvement', () => {
    const g = base()
    g.mouvement = 'rideau agité par le vent'
    expect(composePrompt(g)).toBe(`${DEBUT} Mouvement : rideau agité par le vent.`)
  })

  it("respecte l'ordre global des phrases", () => {
    const g = base()
    g.sujet.details = 'Pelage tigré'
    g.elements = [{ nom: 'plante', position: '', details: '' }]
    g.style = { type: 'aquarelle', palette: 'chaud' }
    g.couleurs.dominantes = 'orange'
    g.composition = { cadrage: 'serré', point_de_vue: 'face', arriere_plan: 'uni', profondeur: 'faible', plans: '2', symetrie: 'non' }
    g.lumiere = 'douce'
    g.eclairage.source = 'fenêtre'
    g.decor.lieu = 'classe'
    g.atmosphere = 'calme'
    g.textes = [{ contenu: 'A', position: '', style: '' }]
    g.rendu.nettete = 'nette'
    g.mouvement = 'vent'
    g.personnalise = [{ nom: 'Saison', valeur: 'automne' }]
    g.exclusions = ['ombres dures']
    const p = composePrompt(g)
    const ordre = ['Un chat roux', 'Pelage tigré', 'Éléments', 'Style', 'Palette', 'Couleurs dominantes', 'Cadrage', 'Point de vue', 'Arrière-plan',
      'Profondeur de champ', 'Plans présents', 'Symétrie', 'Lumière :', 'Source de lumière', 'Lieu', 'Atmosphère', 'Texte visible', 'Netteté',
      'Mouvement', 'Saison', 'À éviter']
    const positions = ordre.map((m) => p.indexOf(m))
    expect(positions.every((x) => x >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('ne double jamais la ponctuation finale', () => {
    const g = base()
    g.atmosphere = 'calme !'
    g.elements = [{ nom: 'plante', position: '', details: 'verte.' }]
    g.textes = [{ contenu: 'Fin.', position: '', style: '' }]
    g.mouvement = 'vent…'
    const p = composePrompt(g)
    expect(p).not.toMatch(/[.!?…]{2}/)
    expect(p).toContain('Atmosphère : calme !')
    expect(p).toContain('Éléments : plante : verte.')
    expect(p).toContain('Mouvement : vent…')
  })

  it('tolère un gabarit sans les nouveaux groupes', () => {
    const g = base()
    delete g.elements; delete g.couleurs; delete g.eclairage; delete g.decor; delete g.textes; delete g.rendu
    expect(composePrompt(g)).toBe(DEBUT)
  })
})
