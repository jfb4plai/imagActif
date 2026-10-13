import { describe, it, expect } from 'vitest'
import { CHAMPS } from './champs.js'
import { gabaritVide } from './gabarit.js'
import {
  PLAFOND_SERIE, MAX_CELLULE, CHEMIN_SUJET, COLONNES_EXTRA, colonnesDisponibles, sujetVerrouille, serieVide,
  changerColonne, majCellule, ajouterLigne, supprimerLigne, parserTableau, collerTableau, copierTableau,
  lignesUtiles, gabaritPourLigne, verifierLot,
} from './serie.js'

describe('COLONNES_EXTRA', () => {
  it('ne propose que des champs texte simples qui existent dans le formulaire', () => {
    expect(COLONNES_EXTRA.map((c) => c.chemin)).toEqual([
      'sujet.details', 'composition.arriere_plan', 'couleurs.dominantes', 'lumiere', 'decor.lieu', 'atmosphere',
    ])
    for (const c of COLONNES_EXTRA) {
      const champ = CHAMPS.find((x) => x.path === c.chemin)
      expect(['texte', 'textarea']).toContain(champ.type)
      expect(c.label && c.placeholder && c.aide).toBeTruthy()
    }
  })
  it('retire les champs verrouillés par un modèle', () => {
    expect(colonnesDisponibles(['lumiere', 'style.type']).map((c) => c.chemin)).not.toContain('lumiere')
    expect(colonnesDisponibles([])).toHaveLength(6)
  })
  it('signale un sujet verrouillé', () => {
    expect(sujetVerrouille([CHEMIN_SUJET])).toBe(true)
    expect(sujetVerrouille(['lumiere'])).toBe(false)
    expect(sujetVerrouille()).toBe(false)
  })
})

describe('édition du tableau', () => {
  it('démarre avec une ligne vide et aucune colonne supplémentaire', () => {
    expect(serieVide()).toEqual({ colonnes: [], lignes: [['']] })
  })
  it('ajoute une colonne et élargit les lignes', () => {
    const s = changerColonne({ colonnes: [], lignes: [['a'], ['b']] }, 0, 'lumiere')
    expect(s).toEqual({ colonnes: ['lumiere'], lignes: [['a', ''], ['b', '']] })
  })
  it('vide la colonne quand on change son sens', () => {
    const s = changerColonne({ colonnes: ['lumiere'], lignes: [['a', 'douce']] }, 0, 'decor.lieu')
    expect(s).toEqual({ colonnes: ['decor.lieu'], lignes: [['a', '']] })
  })
  it('supprime une colonne en gardant les cellules des autres', () => {
    const s = changerColonne({ colonnes: ['lumiere', 'decor.lieu'], lignes: [['a', 'douce', 'gare']] }, 0, '')
    expect(s).toEqual({ colonnes: ['decor.lieu'], lignes: [['a', 'gare']] })
  })
  it('modifie une cellule sans muter l\'original', () => {
    const avant = { colonnes: [], lignes: [['a']] }
    const apres = majCellule(avant, 0, 0, 'b')
    expect(apres.lignes[0][0]).toBe('b')
    expect(avant.lignes[0][0]).toBe('a')
  })
  it('ajoute des lignes jusqu\'au plafond puis refuse', () => {
    let s = serieVide()
    for (let i = 0; i < 20; i++) s = ajouterLigne(s)
    expect(s.lignes).toHaveLength(PLAFOND_SERIE)
  })
  it('supprime une ligne mais en garde toujours une', () => {
    expect(supprimerLigne({ colonnes: [], lignes: [['a'], ['b']] }, 0).lignes).toEqual([['b']])
    expect(supprimerLigne({ colonnes: [], lignes: [['a']] }, 0).lignes).toEqual([['']])
  })
})

describe('parserTableau', () => {
  it('lit une colonne collée depuis un tableur, sans tabulation', () => {
    expect(parserTableau('chat\nchien\n\nlapin\n', 1)).toEqual({ lignes: [['chat'], ['chien'], ['lapin']], tronque: false })
  })
  it('lit plusieurs colonnes séparées par des tabulations et complète les manquantes', () => {
    const r = parserTableau('chat\tdouce\nchien\nlapin\tvive\textra', 2)
    expect(r.lignes).toEqual([['chat', 'douce'], ['chien', ''], ['lapin', 'vive']])
  })
  it('gère les fins de ligne Windows et ignore les lignes sans sujet', () => {
    expect(parserTableau('chat\r\n\tdouce\r\nchien', 2).lignes).toEqual([['chat', ''], ['chien', '']])
  })
  it('tronque chaque cellule à 500 caractères', () => {
    expect(parserTableau('x'.repeat(900), 1).lignes[0][0]).toHaveLength(MAX_CELLULE)
  })
  it('plafonne à 12 lignes et le signale', () => {
    const texte = Array.from({ length: 15 }, (_, i) => `s${i}`).join('\n')
    const r = parserTableau(texte, 1)
    expect(r.lignes).toHaveLength(PLAFOND_SERIE)
    expect(r.tronque).toBe(true)
  })
  it('renvoie un tableau vide pour un texte sans sujet', () => {
    expect(parserTableau('\n \n', 1)).toEqual({ lignes: [], tronque: false })
  })
})

describe('collerTableau / copierTableau', () => {
  it('remplace les lignes selon le nombre de colonnes courant', () => {
    const { serie, tronque } = collerTableau({ colonnes: ['lumiere'], lignes: [['']] }, 'chat\tdouce\nchien\tdure')
    expect(serie).toEqual({ colonnes: ['lumiere'], lignes: [['chat', 'douce'], ['chien', 'dure']] })
    expect(tronque).toBe(false)
  })
  it('garde le tableau si le texte collé ne contient rien d\'exploitable', () => {
    const avant = { colonnes: [], lignes: [['chat']] }
    expect(collerTableau(avant, '  \n').serie).toEqual(avant)
  })
  it('copie le tableau en texte à tabulations', () => {
    expect(copierTableau([['chat', 'douce'], ['chien', '']])).toBe('chat\tdouce\nchien\t')
  })
})

describe('lignesUtiles', () => {
  it('renvoie les indices des lignes dont le sujet est rempli', () => {
    expect(lignesUtiles({ colonnes: [], lignes: [['a'], ['  '], ['c']] })).toEqual([0, 2])
  })
})

describe('gabaritPourLigne', () => {
  const base = { ...gabaritVide(), style: { type: 'aquarelle', palette: '' }, lumiere: 'lumière du matin' }
  it('pose le sujet et les colonnes supplémentaires sans modifier la base', () => {
    const g = gabaritPourLigne(base, [CHEMIN_SUJET, 'decor.lieu'], ['un chat', 'une gare'])
    expect(g.sujet.description).toBe('un chat')
    expect(g.decor.lieu).toBe('une gare')
    expect(g.style.type).toBe('aquarelle')
    expect(base.sujet.description).toBe('')
    expect(base.decor.lieu).toBe('')
  })
  it('garde la valeur du formulaire quand la cellule est vide', () => {
    const g = gabaritPourLigne(base, [CHEMIN_SUJET, 'lumiere'], ['un chat', ''])
    expect(g.lumiere).toBe('lumière du matin')
  })
})

describe('verifierLot', () => {
  it('ne signale rien quand toutes les lignes sont valides', () => {
    expect(verifierLot(gabaritVide(), [CHEMIN_SUJET], [['un chat'], ['']])).toEqual([])
  })
  it('signale une ligne dont la description dépasse la limite, avec son numéro', () => {
    const base = { ...gabaritVide(), sujet: { description: '', details: 'x'.repeat(4100) } }
    const erreurs = verifierLot(base, [CHEMIN_SUJET], [['un chat'], ['un chien']])
    expect(erreurs).toHaveLength(2)
    expect(erreurs[0]).toMatch(/^Ligne 1 : .*trop longue/)
    expect(erreurs[1]).toMatch(/^Ligne 2 :/)
  })
})
