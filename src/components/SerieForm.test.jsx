import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import SerieForm from './SerieForm.jsx'
import { gabaritVide } from '../lib/gabarit.js'

const base = {
  serie: { colonnes: [], lignes: [['un cartable'], ['une trousse']] },
  setSerie: () => {},
  gabarit: gabaritVide(),
  verrous: [],
  regime: 'trial',
  usage: 3,
  bloque: false,
  generer: async () => ({ id: 'x' }),
  attendre: async () => undefined,
  recharger: () => {},
  onEnCours: () => {},
}
const rendre = (props = {}) => renderToStaticMarkup(<SerieForm {...base} {...props} />)

describe('SerieForm', () => {
  it('affiche le titre de la section, la colonne Sujet et le guidage', () => {
    const html = rendre()
    expect(html).toContain('Série d&#x27;images')
    expect(html).toContain('>Sujet<')
    expect(html).toContain('placeholder="un cartable ouvert sur un bureau"')
    expect(html).toContain('Une ligne = une image')
    expect(html).toContain('aucun nom ni donnée d&#x27;élève')
    expect(html).toContain('la composition peut varier')
  })

  it('affiche les lignes saisies avec un libellé accessible', () => {
    const html = rendre()
    expect(html).toContain('value="un cartable"')
    expect(html).toContain('aria-label="Ligne 2 : Sujet"')
  })

  it('compte les images dans le quota de l\'essai', () => {
    const html = rendre()
    expect(html).toContain('2 images = 2 sur votre quota')
    expect(html).toContain('Il vous en reste 7 aujourd')
    expect(html).toMatch(/<button[^>]*>Créer la série \(2 images\)<\/button>/)
  })

  it('prévient quand le lot dépasse le quota restant', () => {
    const html = rendre({ usage: 9 })
    expect(html).toContain('le lot s&#x27;arrêtera après 1 image')
  })

  it('n\'affiche pas de quota avec une clé personnelle', () => {
    const html = rendre({ regime: 'own' })
    expect(html).not.toContain('sur votre quota')
    expect(html).toContain('2 images')
  })

  it('désactive le lancement quand le tableau est vide', () => {
    const html = rendre({ serie: { colonnes: [], lignes: [['']] } })
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Créer la série \(0 image\)<\/button>/)
  })

  it('désactive le lancement quand une création est en cours ou que l\'essai est terminé', () => {
    expect(rendre({ bloque: true })).toMatch(/<button[^>]*disabled=""[^>]*>Créer la série/)
  })

  it('propose les colonnes supplémentaires sauf celles verrouillées', () => {
    const html = rendre({ verrous: ['lumiere'] })
    expect(html).toContain('Colonne supplémentaire 1')
    expect(html).toContain('Couleurs : dominantes')
    expect(html).not.toContain('>Lumière<')
  })

  it('affiche les colonnes choisies dans l\'en-tête et les lignes', () => {
    const html = rendre({ serie: { colonnes: ['decor.lieu'], lignes: [['un cartable', 'une classe']] } })
    expect(html).toContain('<th scope="col">Décor : lieu</th>')
    expect(html).toContain('value="une classe"')
  })

  it('désactive la section avec un message quand le sujet est verrouillé par un modèle', () => {
    const html = rendre({ verrous: ['sujet.description'] })
    expect(html).toContain('Le sujet est verrouillé par le modèle')
    expect(html).not.toContain('Créer la série')
  })

  it('refuse d\'ajouter une ligne au-delà de 12', () => {
    const lignes = Array.from({ length: 12 }, (_, i) => [`s${i}`])
    const html = rendre({ serie: { colonnes: [], lignes } })
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Ajouter une ligne<\/button>/)
    expect(html).toContain('12 images au maximum')
  })
})
