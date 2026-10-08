import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import GabaritForm from './GabaritForm.jsx'
import { gabaritVide } from '../lib/gabarit.js'

const rendre = (gabarit, verrous = []) => renderToStaticMarkup(<GabaritForm gabarit={gabarit} onChange={() => {}} verrous={verrous} />)
const detailsOuvert = (html) => /<details[^>]*\bopen=""/.test(html)

describe('GabaritForm', () => {
  it('details avancé fermé pour un gabarit vide', () => {
    const html = rendre(gabaritVide())
    expect(html).toContain('Détails avancés (facultatif)')
    expect(html).toContain('Tout est facultatif ici.')
    expect(detailsOuvert(html)).toBe(false)
  })

  it('details avancé ouvert quand atmosphere est renseignée', () => {
    expect(detailsOuvert(rendre({ ...gabaritVide(), atmosphere: 'calme' }))).toBe(true)
  })

  it('details avancé ouvert quand un champ avancé est verrouillé', () => {
    expect(detailsOuvert(rendre(gabaritVide(), ['eclairage.source']))).toBe(true)
  })

  it('un champ verrouillé est disabled et son label le signale', () => {
    const html = rendre(gabaritVide(), ['eclairage.source'])
    expect(html).toContain('Éclairage : source (verrouillé par le modèle)')
    expect(html).toMatch(/<input id="champ-eclairage-source"[^>]*disabled=""/)
  })

  it('une liste verrouillée désactive ses champs et ses boutons', () => {
    const g = { ...gabaritVide(), elements: [{ nom: 'tableau', position: '', details: '' }] }
    const html = rendre(g, ['elements'])
    expect(html).toMatch(/<input[^>]*aria-label="Nom, élément 1"[^>]*disabled=""/)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Retirer/)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Ajouter/)
  })

  it('les listes affichent leurs lignes avec Retirer', () => {
    const g = {
      ...gabaritVide(),
      elements: [{ nom: 'tableau', position: '', details: '' }, { nom: 'cartable', position: '', details: '' }],
      textes: [{ contenu: 'Bienvenue', position: '', style: '' }],
    }
    const html = rendre(g)
    expect(html).toContain('aria-label="Nom, élément 2"')
    expect(html).toContain('value="cartable"')
    expect(html).toContain('aria-label="Contenu, élément 1"')
    expect((html.match(/>Retirer</g) || []).length).toBe(3)
  })

  it('le maximum bloque le bouton Ajouter', () => {
    const textes = Array.from({ length: 10 }, (_, i) => ({ contenu: `t${i}`, position: '', style: '' }))
    const html = rendre({ ...gabaritVide(), textes })
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Ajouter \(maximum 10 atteint\)/)
    expect(rendre({ ...gabaritVide(), textes: textes.slice(0, 2) })).not.toContain('maximum 10 atteint')
  })
})
