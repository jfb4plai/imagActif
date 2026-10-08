import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AvisPurgeJson from './AvisPurgeJson.jsx'

const now = new Date('2026-10-08T10:00:00Z')

describe('AvisPurgeJson', () => {
  it('ne montre rien pour une description récente', () => {
    expect(renderToStaticMarkup(<AvisPurgeJson creeLe="2026-09-01T10:00:00Z" now={now} />)).toBe('')
  })
  it('prévient à 30 jours de l\'échéance', () => {
    const html = renderToStaticMarkup(<AvisPurgeJson creeLe="2025-11-07T10:00:00Z" now={now} />)
    expect(html).toContain('sera supprimée dans 30 jours')
    expect(html).toContain('Mes données')
  })
  it('prévient plus fort le dernier jour, au singulier', () => {
    const html = renderToStaticMarkup(<AvisPurgeJson creeLe="2025-10-09T10:00:00Z" now={now} />)
    expect(html).toContain('dans 1 jour')
    expect(html).not.toContain('1 jours')
  })
  it('dit que c\'est pour aujourd\'hui à 0 jour', () => {
    const html = renderToStaticMarkup(<AvisPurgeJson creeLe="2025-10-01T10:00:00Z" now={now} />)
    expect(html).toContain('aujourd')
  })
})
