import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CarteImage from './CarteImage.jsx'

const base = {
  id: 'g1', status: 'done', image_path: 'u/g1.png', image_expires_at: '2099-01-01T00:00:00Z',
  created_at: '2026-10-08T10:00:00Z', seed: 42, json: { sujet: { description: 'Un chat roux' } },
}
const rendre = (gen) => renderToStaticMarkup(<CarteImage gen={gen} url="https://x/y.png" onRetoucher={async () => {}} />)

describe('CarteImage : retouche', () => {
  it('montre « Retoucher cette image » quand l\'image existe', () => {
    expect(rendre(base)).toContain('Retoucher cette image')
  })
  it('ne le montre pas quand l\'image est supprimée', () => {
    const html = rendre({ ...base, image_path: null, image_deleted_at: '2026-10-09T00:00:00Z' })
    expect(html).not.toContain('Retoucher cette image')
  })
  it('ne le montre pas quand la génération est en cours ou échouée', () => {
    expect(rendre({ ...base, status: 'pending', image_path: null })).not.toContain('Retoucher cette image')
    expect(rendre({ ...base, status: 'failed', image_path: null })).not.toContain('Retoucher cette image')
  })
  it('affiche « Retouche : ... » seulement avec edit_instruction', () => {
    expect(rendre({ ...base, edit_instruction: 'le chapeau devient jaune' })).toContain('Retouche : le chapeau devient jaune')
    expect(rendre(base)).not.toContain('Retouche :')
  })
})
