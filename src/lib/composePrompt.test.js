import { describe, it, expect } from 'vitest'
import { composePrompt } from './composePrompt.js'
import { gabaritVide } from './gabarit.js'

function base() {
  const g = gabaritVide()
  g.sujet.description = 'Un chat roux qui dort sur un rebord de fenêtre'
  return g
}

describe('composePrompt', () => {
  it('compose uniquement les champs renseignés', () => {
    const g = base()
    g.style.type = 'aquarelle'
    g.style.palette = 'tons chauds'
    g.lumiere = 'lumière douce du matin'
    expect(composePrompt(g)).toBe(
      "Un chat roux qui dort sur un rebord de fenêtre. Style : aquarelle. Palette : tons chauds. Lumière : lumière douce du matin. À éviter : pas de texte dans l'image."
    )
  })

  it('ne double pas la ponctuation finale', () => {
    const g = base()
    g.sujet.description = 'Un chat !'
    g.sujet.details = 'Pelage tigré.'
    expect(composePrompt(g)).toBe("Un chat ! Pelage tigré. À éviter : pas de texte dans l'image.")
  })

  it('ajoute les champs personnalisés dans l\'ordre, avant les exclusions', () => {
    const g = base()
    g.personnalise = [{ nom: 'Ambiance', valeur: 'calme' }, { nom: 'Saison', valeur: 'automne' }]
    g.exclusions = ['visages réalistes', 'ombres dures']
    expect(composePrompt(g)).toBe(
      'Un chat roux qui dort sur un rebord de fenêtre. Ambiance : calme. Saison : automne. À éviter : visages réalistes, ombres dures.'
    )
  })

  it('omet la ligne d\'exclusions quand la liste est vide', () => {
    const g = base()
    g.exclusions = []
    expect(composePrompt(g)).toBe('Un chat roux qui dort sur un rebord de fenêtre.')
  })

  it('est déterministe', () => {
    const g = base()
    expect(composePrompt(g)).toBe(composePrompt(structuredClone(g)))
  })
})
