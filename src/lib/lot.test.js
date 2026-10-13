import { describe, it, expect, vi } from 'vitest'
import { executerLot, CODES_ARRET } from './lot.js'

const lignes = [['a'], ['b'], ['c']]
const construire = (l) => ({ sujet: l[0] })
const attendreOk = async (id) => ({ gen: { id }, url: `u-${id}` })

function suivi() {
  const etats = {}
  return { etats, onEtat: (i, e) => { etats[i] = { ...(etats[i] ?? {}), ...e } } }
}
const erreur = (code, message = '') => Object.assign(new Error(message), { code })

describe('executerLot', () => {
  it('crée les images dans l\'ordre, une à la fois', async () => {
    const { etats, onEtat } = suivi()
    const ordre = []
    const generer = vi.fn(async (g) => { ordre.push(g.sujet); return { id: `g-${g.sujet}` } })
    const r = await executerLot({ lignes, indices: [0, 1, 2], construire, generer, attendre: attendreOk, arret: () => false, onEtat })
    expect(ordre).toEqual(['a', 'b', 'c'])
    expect(etats[0]).toMatchObject({ statut: 'fini', url: 'u-g-a', genId: 'g-a' })
    expect(etats[2].statut).toBe('fini')
    expect(r.codeArret).toBeNull()
  })

  it('arrête le lot quand le quota est épuisé : la ligne bloquée et les suivantes ne sont pas lancées', async () => {
    const { etats, onEtat } = suivi()
    let n = 0
    const generer = async () => { n++; if (n === 2) throw erreur('quota_user'); return { id: `g${n}` } }
    const r = await executerLot({ lignes, indices: [0, 1, 2], construire, generer, attendre: attendreOk, arret: () => false, onEtat })
    expect(etats[0].statut).toBe('fini')
    expect(etats[1].statut).toBe('non_lancee')
    expect(etats[1].message).toMatch(/Limite de l'essai/)
    expect(etats[2].statut).toBe('non_lancee')
    expect(r.codeArret).toBe('quota_user')
    expect(n).toBe(2)
  })

  it('continue après un échec isolé', async () => {
    const { etats, onEtat } = suivi()
    let n = 0
    const generer = async () => { n++; if (n === 2) throw erreur('moderated'); return { id: `g${n}` } }
    const r = await executerLot({ lignes, indices: [0, 1, 2], construire, generer, attendre: attendreOk, arret: () => false, onEtat })
    expect(etats[1].statut).toBe('echec')
    expect(etats[1].message).toMatch(/refusé ce contenu/)
    expect(etats[2].statut).toBe('fini')
    expect(r.codeArret).toBeNull()
  })

  it('continue après un échec de suivi (failed) en marquant la ligne en échec', async () => {
    const { etats, onEtat } = suivi()
    const attendre = async (id) => { if (id === 'g1') throw erreur('failed'); return { gen: { id }, url: id } }
    let n = 0
    await executerLot({ lignes, indices: [0, 1, 2], construire, generer: async () => ({ id: `g${n++}` }), attendre, arret: () => false, onEtat })
    expect(etats[1].statut).toBe('echec')
    expect(etats[2].statut).toBe('fini')
  })

  it('marque un délai dépassé « à vérifier » et continue', async () => {
    const { etats, onEtat } = suivi()
    let n = 0
    const attendre = async (id) => { if (id === 'g0') throw erreur('timeout'); return { gen: { id }, url: id } }
    await executerLot({ lignes, indices: [0, 1], construire, generer: async () => ({ id: `g${n++}` }), attendre, arret: () => false, onEtat })
    expect(etats[0].statut).toBe('a_verifier')
    expect(etats[0].message).toMatch(/Historique/)
    expect(etats[1].statut).toBe('fini')
  })

  it('s\'arrête entre deux images quand l\'arrêt est demandé', async () => {
    const { etats, onEtat } = suivi()
    let n = 0
    const generer = async () => ({ id: `g${n++}` })
    let termine = 0
    const attendre = async (id) => { termine++; return { gen: { id }, url: id } }
    await executerLot({ lignes, indices: [0, 1, 2], construire, generer, attendre, arret: () => termine >= 1, onEtat })
    expect(etats[0].statut).toBe('fini')
    expect(etats[1].statut).toBe('non_lancee')
    expect(etats[2].statut).toBe('non_lancee')
    expect(n).toBe(1)
  })

  it('ne relance que les lignes demandées', async () => {
    const { etats, onEtat } = suivi()
    const generer = vi.fn(async () => ({ id: 'x' }))
    await executerLot({ lignes, indices: [1], construire, generer, attendre: attendreOk, arret: () => false, onEtat })
    expect(generer).toHaveBeenCalledTimes(1)
    expect(generer).toHaveBeenCalledWith({ sujet: 'b' })
    expect(etats[0]).toBeUndefined()
    expect(etats[2]).toBeUndefined()
  })

  it('traite une page quittée (suivi qui ne renvoie rien) comme un arrêt', async () => {
    const { etats, onEtat } = suivi()
    let n = 0
    await executerLot({ lignes, indices: [0, 1, 2], construire, generer: async () => { n++; return { id: 'x' } }, attendre: async () => undefined, arret: () => false, onEtat })
    expect(etats[0].statut).toBe('non_lancee')
    expect(etats[1].statut).toBe('non_lancee')
    expect(n).toBe(1)
  })

  it('arrête le lot sur toute erreur de compte ou de clé', async () => {
    for (const code of CODES_ARRET) {
      const { etats, onEtat } = suivi()
      const r = await executerLot({ lignes, indices: [0, 1], construire, generer: async () => { throw erreur(code) }, attendre: attendreOk, arret: () => false, onEtat })
      expect(r.codeArret).toBe(code)
      expect(etats[1].statut).toBe('non_lancee')
    }
  })
})
