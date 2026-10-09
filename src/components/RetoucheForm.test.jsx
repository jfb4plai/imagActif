import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import RetoucheForm from './RetoucheForm.jsx'

const rendre = (props = {}) => renderToStaticMarkup(<RetoucheForm onValider={async () => {}} {...props} />)

describe('RetoucheForm', () => {
  it('affiche le label lié au champ, le placeholder et l\'aide', () => {
    const html = rendre({ idPrefix: 'x' })
    expect(html).toMatch(/<label[^>]*for="x-instruction"[^>]*>Que voulez-vous changer \?<\/label>/)
    expect(html).toMatch(/<textarea[^>]*id="x-instruction"/)
    expect(html).toContain('placeholder="Le chapeau devient jaune et la souris porte des lunettes roses"')
    expect(html).toContain('le reste devrait rester identique, sans garantie')
    expect(html).toContain('L&#x27;image est renvoyée à BFL.')
    expect(html).toContain('aria-describedby="x-aide"')
  })

  it('a un bouton Retoucher désactivé tant que la consigne est trop courte', () => {
    const html = rendre()
    expect(html).toMatch(/<button type="submit"[^>]*disabled=""[^>]*>Retoucher<\/button>/)
  })

  it('limite la consigne à 500 caractères et affiche le compteur', () => {
    const html = rendre()
    expect(html).toContain('maxLength="500"')
    expect(html).toContain('0 / 500 caractères')
  })

  it('désactive le bouton quand le parent le demande', () => {
    expect(rendre({ desactive: true })).toMatch(/<button type="submit"[^>]*disabled=""/)
  })
})
