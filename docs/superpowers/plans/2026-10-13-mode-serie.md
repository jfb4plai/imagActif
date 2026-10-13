# Mode Série (génération en lot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de créer jusqu'à 12 images d'un style commun à partir d'un tableau de sujets (plus 1 ou 2 colonnes de champs au choix), une image après l'autre, chaque image comptant dans le quota.

**Architecture:** Tout côté client, serveur inchangé : chaque ligne appelle `POST /api/generate` puis le suivi `/api/status`, comme une création normale. La logique est dans deux modules purs testés (`serie.js` pour le tableau, `lot.js` pour le déroulé avec API injectée), un composant `SerieForm.jsx` et un câblage dans `Creer.jsx` et `App.jsx`. Le tableau vit dans l'état `brouillon` (pas de base de données, pas de migration).

**Tech Stack:** React 18, Vite 5, Vitest (tests `renderToStaticMarkup` pour les composants, comme `RetoucheForm.test.jsx`), JavaScript (pas de TypeScript dans ce dépôt).

**Spec:** `docs/superpowers/specs/2026-10-13-mode-serie-design.md`

## Global Constraints

- Branche `main` ; **aucun `git push` sans l'accord de JF** (chaque push redéploie sur Vercel) ; `npx vite build` doit passer avant tout push.
- Tests : `npx vitest run` depuis `C:\Users\jfbeg\OneDrive\claude-workspace\ImagActif`.
- Aucune migration SQL, aucune table, aucune modification de `api/`.
- Plafond de lot : 12 images (`PLAFOND_SERIE`). Cellule : 500 caractères maximum. Colonnes supplémentaires : 2 maximum.
- Chaque image du lot compte dans le quota d'essai (10 par jour) ; aucune règle de quota distincte.
- Génération séquentielle (index unique `img_generations_one_pending` : une seule génération « en cours » par utilisateur).
- Guidage PLAI de chaque champ : label précis, placeholder concret avec exemple (FWB, jamais « collège/lycée »), texte d'aide sur la portée. Police min 16 px (classes `plai-*` existantes). Aucun tiret cadratin dans les textes visibles.
- Aucun nom ni donnée d'élève dans les sujets : avertissement visible.
- Aucune référence scientifique ajoutée (donc pas de vérification RISS nécessaire).
- Messages d'erreur via `messageErreur` de `src/lib/messages.js`.
- Commits : message en français, terminé par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Une ligne trop longue (prompt > 4000 caractères) : refus **avant tout envoi**, aucune image du lot lancée ni débitée (test dans Task 1 et Task 3).
- Cellule vide dans une colonne supplémentaire : la valeur du formulaire est conservée, pas effacée (test Task 1).
- Quota épuisé en cours de lot : la ligne bloquée et les suivantes passent en « non lancée », les images déjà faites restent affichées, la relance ne refait que les lignes en échec ou non lancées (tests Task 2).
- Délai dépassé (`timeout`) : la ligne passe en « à vérifier dans l'Historique » et n'est pas relancée automatiquement, pour éviter un double débit du quota (test Task 2).
- Sujet verrouillé par un modèle : la section Série est désactivée avec un message, au lieu de générer N fois la même image (test Task 3).

---

## File Structure

- Create `src/lib/serie.js` : tableau (colonnes, lignes, collage, gabarit par ligne, vérification). Pur.
- Create `src/lib/serie.test.js`.
- Create `src/lib/lot.js` : déroulé séquentiel d'un lot, API injectée. Pur.
- Create `src/lib/lot.test.js`.
- Create `src/components/SerieForm.jsx` : interface du tableau et suivi du lot.
- Create `src/components/SerieForm.test.jsx`.
- Modify `src/components/BandeauRegime.jsx` : exporter la limite d'essai.
- Modify `src/pages/Creer.jsx` : `attendre` extrait de `suivre`, section Série, blocage pendant un lot.
- Modify `src/App.jsx` : `serie` dans le brouillon.
- Modify `public/modes-emploi/imagactif.html` : section Série.
- Modify `docs/superpowers/specs/2026-10-13-mode-serie-design.md` : écarts décidés à l'implémentation.

---

### Task 1: Module `serie.js` (tableau, collage, gabarit par ligne)

**Files:**
- Create: `src/lib/serie.js`
- Test: `src/lib/serie.test.js`

**Interfaces:**
- Consumes: `CHAMPS` de `src/lib/champs.js` (entrées `{ path, label, placeholder, aide }`) ; `setIn` de `src/lib/path.js` ; `validerPourGeneration(gabarit)` de `src/lib/gabarit.js` (renvoie un tableau de messages, vide si valide).
- Produces (utilisés par Tasks 2 à 4) :
  - `PLAFOND_SERIE = 12`, `MAX_CELLULE = 500`, `MAX_COLONNES_EXTRA = 2`, `CHEMIN_SUJET = 'sujet.description'`
  - `COLONNES_EXTRA : Array<{ chemin, label, placeholder, aide }>`
  - `colonnesDisponibles(verrous: string[]) : COLONNES_EXTRA filtré`
  - `sujetVerrouille(verrous: string[]) : boolean`
  - `serieVide() : { colonnes: string[], lignes: string[][] }` (une ligne vide, aucune colonne supplémentaire)
  - `changerColonne(serie, position: 0|1, chemin: string) : serie` (chemin `''` supprime la colonne)
  - `majCellule(serie, i, j, valeur) : serie`, `ajouterLigne(serie) : serie`, `supprimerLigne(serie, i) : serie`
  - `parserTableau(texte, nbColonnes) : { lignes: string[][], tronque: boolean }`
  - `collerTableau(serie, texte) : { serie, tronque }`
  - `copierTableau(lignes) : string`
  - `lignesUtiles(serie) : number[]` (indices des lignes dont le sujet n'est pas vide)
  - `gabaritPourLigne(base, chemins: string[], ligne: string[]) : gabarit`
  - `verifierLot(base, chemins, lignes) : string[]` (messages `Ligne N : ...`)

- [ ] **Step 1: Écrire les tests (qui échouent)**

Créer `src/lib/serie.test.js` :

```js
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
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `npx vitest run src/lib/serie.test.js`
Expected: FAIL (module `./serie.js` introuvable).

- [ ] **Step 3: Implémenter `src/lib/serie.js`**

```js
import { CHAMPS } from './champs.js'
import { setIn } from './path.js'
import { validerPourGeneration } from './gabarit.js'

export const PLAFOND_SERIE = 12
export const MAX_CELLULE = 500
export const MAX_COLONNES_EXTRA = 2
export const CHEMIN_SUJET = 'sujet.description'

// Champs texte simples proposés comme colonnes supplémentaires. Les listes (éléments, textes) et le style restent communs à la série.
const CHEMINS_EXTRA = ['sujet.details', 'composition.arriere_plan', 'couleurs.dominantes', 'lumiere', 'decor.lieu', 'atmosphere']

export const COLONNES_EXTRA = CHEMINS_EXTRA.map((chemin) => {
  const c = CHAMPS.find((champ) => champ.path === chemin)
  return { chemin, label: c.label, placeholder: c.placeholder, aide: c.aide }
})

export const colonnesDisponibles = (verrous = []) => COLONNES_EXTRA.filter((c) => !verrous.includes(c.chemin))
export const sujetVerrouille = (verrous = []) => verrous.includes(CHEMIN_SUJET)

// serie = { colonnes: [chemins des colonnes supplémentaires], lignes: [[sujet, ...cellules]] }
export const serieVide = () => ({ colonnes: [], lignes: [['']] })

export function changerColonne(serie, position, chemin) {
  const colonnes = [...serie.colonnes]
  if (chemin) colonnes[position] = chemin
  else colonnes.splice(position, 1)
  const n = 1 + colonnes.length
  const lignes = serie.lignes.map((l) => {
    const c = [...l]
    if (chemin) c[position + 1] = '' // la colonne change de sens : on la vide
    else c.splice(position + 1, 1)
    while (c.length < n) c.push('')
    return c
  })
  return { colonnes, lignes }
}

export function majCellule(serie, i, j, valeur) {
  return { ...serie, lignes: serie.lignes.map((l, k) => (k === i ? l.map((c, m) => (m === j ? valeur : c)) : l)) }
}

export function ajouterLigne(serie) {
  if (serie.lignes.length >= PLAFOND_SERIE) return serie
  return { ...serie, lignes: [...serie.lignes, Array(1 + serie.colonnes.length).fill('')] }
}

export function supprimerLigne(serie, i) {
  const lignes = serie.lignes.filter((_, k) => k !== i)
  return { ...serie, lignes: lignes.length ? lignes : serieVide().lignes.map((l) => Array(1 + serie.colonnes.length).fill('')) }
}

// Texte collé depuis un tableur : une ligne par image, cellules séparées par des tabulations. Une ligne sans sujet est ignorée.
export function parserTableau(texte, nbColonnes) {
  const lignes = []
  let tronque = false
  for (const brute of String(texte ?? '').split(/\r?\n/)) {
    const cellules = brute.split('\t').slice(0, nbColonnes).map((c) => c.trim().slice(0, MAX_CELLULE))
    if (!cellules[0]) continue
    if (lignes.length >= PLAFOND_SERIE) { tronque = true; break }
    while (cellules.length < nbColonnes) cellules.push('')
    lignes.push(cellules)
  }
  return { lignes, tronque }
}

export function collerTableau(serie, texte) {
  const { lignes, tronque } = parserTableau(texte, 1 + serie.colonnes.length)
  return { serie: lignes.length ? { ...serie, lignes } : serie, tronque }
}

export const copierTableau = (lignes) => lignes.map((l) => l.join('\t')).join('\n')

export const lignesUtiles = (serie) => serie.lignes.flatMap((l, i) => ((l[0] ?? '').trim() ? [i] : []))

// Gabarit d'une image : le formulaire courant, avec les valeurs de la ligne. Une cellule vide garde la valeur du formulaire.
export function gabaritPourLigne(base, chemins, ligne) {
  let g = base
  chemins.forEach((chemin, i) => {
    const v = (ligne[i] ?? '').trim()
    if (v) g = setIn(g, chemin, v)
  })
  return g
}

// Vérifie chaque ligne utile avant tout envoi : un lot ne démarre pas si l'une d'elles serait refusée.
export function verifierLot(base, chemins, lignes) {
  const erreurs = []
  lignes.forEach((ligne, i) => {
    if (!(ligne[0] ?? '').trim()) return
    const problemes = validerPourGeneration(gabaritPourLigne(base, chemins, ligne))
    if (problemes.length) erreurs.push(`Ligne ${i + 1} : ${problemes.join(' ')}`)
  })
  return erreurs
}
```

- [ ] **Step 4: Lancer les tests, vérifier le succès**

Run: `npx vitest run src/lib/serie.test.js`
Expected: PASS (tous les tests du fichier).

- [ ] **Step 5: Commit**

```bash
git add src/lib/serie.js src/lib/serie.test.js
git commit -m "feat(serie): tableau de série, collage et gabarit par ligne

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Module `lot.js` (déroulé séquentiel)

**Files:**
- Create: `src/lib/lot.js`
- Test: `src/lib/lot.test.js`

**Interfaces:**
- Consumes: `messageErreur(code, repli)` de `src/lib/messages.js`.
- Produces :
  - `CODES_ARRET : string[]` (codes d'erreur qui arrêtent tout le lot)
  - `async executerLot({ lignes, indices, construire, generer, attendre, arret, onEtat }) : Promise<{ codeArret: string | null }>`
    - `lignes: string[][]`, `indices: number[]` (lignes à exécuter, dans l'ordre)
    - `construire(ligne) : gabarit`
    - `generer(gabarit) : Promise<{ id }>` ; `attendre(id) : Promise<{ gen, url } | undefined>` (`undefined` si la page a été quittée)
    - `arret() : boolean` ; `onEtat(indice, { statut, message?, url?, genId? })`
    - statuts : `cours`, `fini`, `echec`, `non_lancee`, `a_verifier`
    - les lignes qui ne sont pas dans `indices` ne reçoivent aucun appel à `onEtat`.

- [ ] **Step 1: Écrire les tests (qui échouent)**

Créer `src/lib/lot.test.js` :

```js
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
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `npx vitest run src/lib/lot.test.js`
Expected: FAIL (module `./lot.js` introuvable).

- [ ] **Step 3: Implémenter `src/lib/lot.js`**

```js
import { messageErreur } from './messages.js'

// Erreurs qui rendraient échouer toutes les images suivantes : le lot s'arrête.
export const CODES_ARRET = [
  'quota_user', 'quota_global', 'trial_over', 'no_credits', 'invalid_key', 'key_unreadable',
  'terms', 'email_unconfirmed', 'busy', 'rate_limited',
]

// Exécute les lignes demandées l'une après l'autre (une seule génération « en cours » est permise par utilisateur).
// L'API est injectée pour pouvoir tester sans réseau. Les échecs isolés n'arrêtent pas le lot.
export async function executerLot({ lignes, indices, construire, generer, attendre, arret, onEtat }) {
  let stop = false
  let codeArret = null
  for (const i of indices) {
    if (stop || arret()) { onEtat(i, { statut: 'non_lancee' }); continue }
    onEtat(i, { statut: 'cours' })
    try {
      const { id } = await generer(construire(lignes[i]))
      const resultat = await attendre(id)
      if (!resultat) { onEtat(i, { statut: 'non_lancee' }); stop = true; continue } // page quittée
      onEtat(i, { statut: 'fini', url: resultat.url, genId: resultat.gen.id })
    } catch (e) {
      if (CODES_ARRET.includes(e.code)) {
        stop = true
        codeArret = e.code
        onEtat(i, { statut: 'non_lancee', message: messageErreur(e.code, e.message) })
      } else if (e.code === 'timeout') {
        // L'image peut encore aboutir : ne pas la relancer pour ne pas débiter le quota deux fois.
        onEtat(i, { statut: 'a_verifier', message: messageErreur(e.code, e.message) })
      } else {
        onEtat(i, { statut: 'echec', message: messageErreur(e.code, e.message) })
      }
    }
  }
  return { codeArret }
}
```

- [ ] **Step 4: Lancer les tests, vérifier le succès**

Run: `npx vitest run src/lib/lot.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/lot.js src/lib/lot.test.js
git commit -m "feat(serie): déroulé séquentiel d'un lot avec arrêt sur quota et reprise

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Composant `SerieForm.jsx`

**Files:**
- Create: `src/components/SerieForm.jsx`
- Modify: `src/components/BandeauRegime.jsx:5` (exporter la limite)
- Test: `src/components/SerieForm.test.jsx`

**Interfaces:**
- Consumes: tout `serie.js` et `lot.js` (Tasks 1 et 2) ; `BandeauRegime` exporte `LIMITE_ESSAI` ; classes CSS `plai-*` et `img-actions` existantes.
- Produces : composant par défaut
  `SerieForm({ serie, setSerie, gabarit, verrous, regime, usage, bloque, generer, attendre, recharger, onEnCours })`
  - `serie` : `{ colonnes, lignes }` ; `setSerie(nouvelleSerie)`
  - `gabarit` : gabarit du formulaire (style commun) ; `verrous: string[]`
  - `regime` : `'trial' | 'own' | 'none'` ; `usage: number` (images déjà créées aujourd'hui)
  - `bloque: boolean` (création simple en cours ou régime `none`)
  - `generer(gabarit) : Promise<{ id }>` ; `attendre(id) : Promise<{ gen, url } | undefined>`
  - `recharger()` appelée une fois à la fin du lot ; `onEnCours(boolean)` appelée au début et à la fin.

- [ ] **Step 1: Exporter la limite d'essai**

Dans `src/components/BandeauRegime.jsx`, remplacer la ligne 5 :

```js
const LIMITE = Number(import.meta.env.VITE_TRIAL_DAILY_LIMIT) || 10
```

par :

```js
export const LIMITE_ESSAI = Number(import.meta.env.VITE_TRIAL_DAILY_LIMIT) || 10
const LIMITE = LIMITE_ESSAI
```

- [ ] **Step 2: Écrire les tests (qui échouent)**

Créer `src/components/SerieForm.test.jsx` :

```jsx
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
```

- [ ] **Step 3: Lancer les tests, vérifier l'échec**

Run: `npx vitest run src/components/SerieForm.test.jsx`
Expected: FAIL (composant introuvable).

- [ ] **Step 4: Implémenter `src/components/SerieForm.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react'
import { LIMITE_ESSAI } from './BandeauRegime.jsx'
import { messageErreur } from '../lib/messages.js'
import { executerLot } from '../lib/lot.js'
import {
  PLAFOND_SERIE, MAX_CELLULE, MAX_COLONNES_EXTRA, CHEMIN_SUJET, COLONNES_EXTRA, colonnesDisponibles, sujetVerrouille,
  changerColonne, majCellule, ajouterLigne, supprimerLigne, collerTableau, copierTableau, lignesUtiles, gabaritPourLigne, verifierLot,
} from '../lib/serie.js'

const LIBELLES = {
  attente: 'En attente', cours: 'En cours…', fini: 'Terminée', echec: 'Échec', non_lancee: 'Non lancée', a_verifier: 'À vérifier dans l\'Historique',
}
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`
const libelleColonne = (chemin) => COLONNES_EXTRA.find((c) => c.chemin === chemin)

export default function SerieForm({ serie, setSerie, gabarit, verrous, regime, usage, bloque, generer, attendre, recharger, onEnCours }) {
  const [ouvert, setOuvert] = useState(false)
  const [etats, setEtats] = useState([])
  const [enCours, setEnCours] = useState(false)
  const [erreurs, setErreurs] = useState([])
  const [message, setMessage] = useState('')
  const [collage, setCollage] = useState('')
  const [copie, setCopie] = useState('')
  const arretRef = useRef(false)
  const vivant = useRef(true)
  useEffect(() => { vivant.current = true; return () => { vivant.current = false } }, [])

  // Quitter ou recharger la page pendant un lot interromprait la série.
  useEffect(() => {
    if (!enCours) return undefined
    const garde = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', garde)
    return () => window.removeEventListener('beforeunload', garde)
  }, [enCours])

  if (sujetVerrouille(verrous)) {
    return (
      <details className="plai-card" style={{ marginTop: '1rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Série d'images</summary>
        <p className="plai-help">Le sujet est verrouillé par le modèle : toutes les images de la série seraient identiques. Utilisez un modèle dont le sujet n'est pas verrouillé.</p>
      </details>
    )
  }

  const chemins = [CHEMIN_SUJET, ...serie.colonnes]
  const utiles = lignesUtiles(serie)
  const n = utiles.length
  const reste = Math.max(LIMITE_ESSAI - usage, 0)
  const verrouille = enCours
  const colonnesLibres = colonnesDisponibles(verrous)
  const majEtat = (i, e) => setEtats((prev) => { const s = [...prev]; s[i] = { ...(s[i] ?? {}), ...e }; return s })

  async function lancer(indices, premier) {
    setMessage('')
    setErreurs([])
    const problemes = verifierLot(gabarit, chemins, serie.lignes)
    if (problemes.length) { setErreurs(problemes); return }
    arretRef.current = false
    if (premier) setEtats(serie.lignes.map((_, i) => (indices.includes(i) ? { statut: 'attente' } : {})))
    setEnCours(true)
    onEnCours(true)
    const { codeArret } = await executerLot({
      lignes: serie.lignes,
      indices,
      construire: (ligne) => gabaritPourLigne(gabarit, chemins, ligne),
      generer,
      attendre,
      arret: () => arretRef.current || !vivant.current,
      onEtat: (i, e) => { if (vivant.current) majEtat(i, e) },
    })
    if (vivant.current) {
      setEnCours(false)
      if (codeArret) setMessage(messageErreur(codeArret))
      else if (arretRef.current) setMessage('Série arrêtée. Les lignes « non lancées » peuvent être relancées.')
    }
    onEnCours(false)
    recharger()
  }

  const aRelancer = etats.flatMap((e, i) => (e?.statut === 'echec' || e?.statut === 'non_lancee' ? [i] : []))

  function coller() {
    const { serie: s, tronque } = collerTableau(serie, collage)
    setSerie(s)
    setCollage('')
    setEtats([])
    setMessage(tronque ? `Seules les ${PLAFOND_SERIE} premières lignes ont été gardées.` : '')
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(copierTableau(serie.lignes))
      setCopie('Tableau copié.')
    } catch {
      setCopie('Copie impossible depuis ce navigateur.')
    }
  }

  return (
    <details className="plai-card" style={{ marginTop: '1rem' }} open={ouvert} onToggle={(e) => setOuvert(e.currentTarget.open)}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Série d'images</summary>
      <p className="plai-help">
        Une ligne = une image. Le style, la palette, le cadrage et les autres champs du formulaire ci-dessus restent communs à toute la série ;
        seuls le sujet et les colonnes choisies changent d'une image à l'autre. Une cellule laissée vide garde la valeur du formulaire.
      </p>
      <p className="plai-help img-warn">
        Chaque ligne part chez BFL : n'y mettez aucun nom ni donnée d'élève. Le style est commun, mais la composition peut varier d'une image à l'autre.
        Restez sur cette page pendant la création : quitter la page interrompt la série.
      </p>

      <div className="img-actions" style={{ marginTop: '0.75rem' }}>
        {Array.from({ length: Math.min(serie.colonnes.length + 1, MAX_COLONNES_EXTRA) }, (_, p) => {
          const choisie = serie.colonnes[p] ?? ''
          const autre = serie.colonnes[1 - p]
          return (
            <div key={p}>
              <label className="plai-label" htmlFor={`serie-colonne-${p}`}>{`Colonne supplémentaire ${p + 1}`}</label>
              <select id={`serie-colonne-${p}`} className="plai-input" value={choisie} disabled={verrouille}
                aria-describedby={`serie-colonne-${p}-aide`}
                onChange={(e) => { setSerie(changerColonne(serie, p, e.target.value)); setEtats([]) }}>
                <option value="">Aucune</option>
                {colonnesLibres.filter((c) => c.chemin === choisie || c.chemin !== autre).map((c) => (
                  <option key={c.chemin} value={c.chemin}>{c.label}</option>
                ))}
              </select>
              <p className="plai-help" id={`serie-colonne-${p}-aide`}>
                {libelleColonne(choisie)?.aide ?? 'Facultatif : un champ du formulaire qui change aussi d\'une image à l\'autre.'}
              </p>
            </div>
          )
        })}
      </div>

      <table style={{ width: '100%', marginTop: '0.75rem' }}>
        <thead>
          <tr>
            <th scope="col">Sujet</th>
            {serie.colonnes.map((c) => <th key={c} scope="col">{libelleColonne(c).label}</th>)}
            <th scope="col">État</th>
          </tr>
        </thead>
        <tbody>
          {serie.lignes.map((ligne, i) => (
            <tr key={i}>
              {ligne.map((cellule, j) => {
                const colonne = j === 0 ? null : libelleColonne(serie.colonnes[j - 1])
                const libelle = j === 0 ? 'Sujet' : colonne.label
                return (
                  <td key={j}>
                    <input className="plai-input" value={cellule} maxLength={MAX_CELLULE} disabled={verrouille}
                      aria-label={`Ligne ${i + 1} : ${libelle}`}
                      placeholder={j === 0 ? 'un cartable ouvert sur un bureau' : colonne.placeholder}
                      onChange={(e) => { setSerie(majCellule(serie, i, j, e.target.value)); setEtats([]) }} />
                  </td>
                )
              })}
              <td>
                {etats[i]?.statut && (
                  <div role="status">
                    <strong>{LIBELLES[etats[i].statut]}</strong>
                    {etats[i].message && <span className="plai-help"> {etats[i].message}</span>}
                    {etats[i].url && <img src={etats[i].url} alt={`Image générée : ${ligne[0]}`} style={{ display: 'block', maxWidth: '8rem', marginTop: '0.25rem' }} />}
                  </div>
                )}
                {!verrouille && serie.lignes.length > 1 && (
                  <button type="button" className="plai-btn plai-btn-ghost" aria-label={`Supprimer la ligne ${i + 1}`}
                    onClick={() => { setSerie(supprimerLigne(serie, i)); setEtats([]) }}>Supprimer</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="img-actions" style={{ marginTop: '0.75rem' }}>
        <button type="button" className="plai-btn plai-btn-ghost" disabled={verrouille || serie.lignes.length >= PLAFOND_SERIE}
          onClick={() => setSerie(ajouterLigne(serie))}>Ajouter une ligne</button>
        <button type="button" className="plai-btn plai-btn-ghost" onClick={copier}>Copier le tableau</button>
      </div>
      <p className="plai-help">{`${PLAFOND_SERIE} images au maximum par série.`}</p>
      {copie && <p className="plai-success" role="status">{copie}</p>}

      <label className="plai-label" htmlFor="serie-collage" style={{ marginTop: '1rem' }}>Coller depuis un tableur</label>
      <textarea id="serie-collage" className="plai-input" rows={3} value={collage} disabled={verrouille}
        aria-describedby="serie-collage-aide" placeholder={'un cartable\nune trousse\nun compas'}
        onChange={(e) => setCollage(e.target.value)} />
      <p className="plai-help" id="serie-collage-aide">
        Copiez des cellules dans Excel ou LibreOffice et collez-les ici : une ligne par image, les colonnes dans l'ordre du tableau ci-dessus.
        Cela remplace les lignes actuelles.
      </p>
      <button type="button" className="plai-btn plai-btn-ghost" disabled={verrouille || !collage.trim()} onClick={coller}>Remplacer par le texte collé</button>

      <p className="plai-help" style={{ marginTop: '1rem' }}>
        {regime === 'trial'
          ? `${pluriel(n, 'image')} = ${n} sur votre quota. Il vous en reste ${reste} aujourd'hui.${n > reste ? ` Le quota ne suffit pas : le lot s'arrêtera après ${pluriel(reste, 'image')}.` : ''}`
          : pluriel(n, 'image')}
        {' '}Comptez environ 15 secondes par image.
      </p>

      <div className="img-actions">
        <button type="button" className="plai-btn" disabled={n === 0 || bloque || enCours || regime === 'none'}
          onClick={() => lancer(utiles, true)}>
          {enCours ? 'Série en cours…' : `Créer la série (${pluriel(n, 'image')})`}
        </button>
        {enCours && (
          <button type="button" className="plai-btn plai-btn-ghost" onClick={() => { arretRef.current = true }}>Arrêter après l'image en cours</button>
        )}
        {!enCours && aRelancer.length > 0 && (
          <button type="button" className="plai-btn plai-btn-ghost" disabled={bloque || regime === 'none'} onClick={() => lancer(aRelancer, false)}>
            Relancer les lignes en échec ou non lancées ({aRelancer.length})
          </button>
        )}
      </div>

      <div aria-live="polite">{message && <p className="plai-error" role="alert">{message}</p>}</div>
      {erreurs.length > 0 && (
        <ul className="plai-error" role="alert">{erreurs.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
    </details>
  )
}
```

- [ ] **Step 5: Lancer les tests du composant, vérifier le succès**

Run: `npx vitest run src/components/SerieForm.test.jsx`
Expected: PASS (11 tests). Si une assertion échoue sur un texte contenant une apostrophe, le rendu serveur l'écrit `&#x27;` : corriger le test, pas le texte du composant.

- [ ] **Step 6: Commit**

```bash
git add src/components/SerieForm.jsx src/components/SerieForm.test.jsx src/components/BandeauRegime.jsx
git commit -m "feat(serie): composant SerieForm (tableau, collage, suivi du lot)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Câblage dans `Creer.jsx` et `App.jsx`

**Files:**
- Modify: `src/App.jsx` (lignes 15 et 33, plus l'import)
- Modify: `src/pages/Creer.jsx`

**Interfaces:**
- Consumes: `SerieForm` (Task 3), `serieVide` (Task 1), `api.generer(gabarit, parentId)` de `src/lib/api.js`.
- Produces : la section Série visible sous le formulaire de la page Créer ; le tableau vit dans `brouillon.serie`.

- [ ] **Step 1: `App.jsx` : le brouillon porte la série**

Ajouter à côté de l'import existant de `gabaritVide` :

```js
import { serieVide } from './lib/serie.js'
```

Remplacer la ligne 15 :

```js
const brouillonVide = () => ({ gabarit: gabaritVide(), parentId: null, verrous: [] })
```

par :

```js
const brouillonVide = () => ({ gabarit: gabaritVide(), parentId: null, verrous: [], serie: serieVide() })
```

Remplacer (ligne 33) :

```js
setBrouillon({ parentId: null, verrous: [], ...b })
```

par :

```js
setBrouillon({ parentId: null, verrous: [], serie: serieVide(), ...b })
```

- [ ] **Step 2: `Creer.jsx` : imports et état**

Ajouter aux imports :

```js
import SerieForm from '../components/SerieForm.jsx'
import { serieVide } from '../lib/serie.js'
```

Dans le composant, après `const [retouche, setRetouche] = useState(false)`, ajouter :

```js
  const [lotEnCours, setLotEnCours] = useState(false)
```

Après `const majGabarit = ...`, ajouter :

```js
  const serie = brouillon.serie ?? serieVide()
  const majSerie = (s) => setBrouillon((b) => ({ ...b, serie: s }))
```

- [ ] **Step 3: `Creer.jsx` : extraire `attendre` de `suivre`**

Remplacer toute la fonction `suivre` (de `async function suivre(id) {` jusqu'à son `}` de fermeture) par :

```js
  // Attend la fin d'une génération et renvoie { gen, url } ; renvoie undefined si la page a été quittée.
  async function attendre(id) {
    const debut = Date.now()
    while (actif.current && Date.now() - debut < ATTENTE_MAX_MS) {
      await pause(2000)
      const s = await api.statut(id)
      if (s.status === 'done') {
        const gen = await getGeneration(id)
        const urls = await urlsSignees([gen.image_path])
        return { gen, url: urls[gen.image_path] }
      }
      if (s.status === 'refused') throw echec('moderated')
      if (s.status === 'failed') throw echec('failed')
    }
    if (actif.current) throw echec('timeout')
    return undefined
  }

  async function suivre(id) {
    const r = await attendre(id)
    if (r && actif.current) setResultat(r)
  }
```

- [ ] **Step 4: `Creer.jsx` : insérer la section Série**

Dans le JSX, juste après la ligne `<GabaritForm gabarit={brouillon.gabarit} onChange={majGabarit} verrous={brouillon.verrous} />`, ajouter :

```jsx
          <SerieForm
            serie={serie}
            setSerie={majSerie}
            gabarit={brouillon.gabarit}
            verrous={brouillon.verrous}
            regime={regime}
            usage={usage}
            bloque={regime === 'none' || etat === 'cours'}
            generer={(g) => api.generer(g, null)}
            attendre={attendre}
            recharger={recharger}
            onEnCours={setLotEnCours}
          />
```

Remplacer la ligne :

```js
  const bloque = regime === 'none' || etat === 'cours'
```

par :

```js
  const bloque = regime === 'none' || etat === 'cours' || lotEnCours
```

(`bloque` désactive « Créer l'image » et « Retoucher » pendant un lot ; `SerieForm` reçoit sa propre valeur, sans `lotEnCours`, pour ne pas se bloquer lui-même.)

- [ ] **Step 5: Tests complets et build**

Run: `npx vitest run`
Expected: PASS, aucun test existant cassé.

Run: `npx vite build`
Expected: « built in … s », aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/pages/Creer.jsx
git commit -m "feat(serie): section Série sur la page Créer, tableau conservé dans le brouillon

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Textes, spec à jour, vérification dans le navigateur, revue finale

**Files:**
- Modify: `public/modes-emploi/imagactif.html` (nouvelle section après « Retoucher une image », ligne 132)
- Modify: `docs/superpowers/specs/2026-10-13-mode-serie-design.md`

- [ ] **Step 1: Mettre la spec en accord avec le code**

Dans `docs/superpowers/specs/2026-10-13-mode-serie-design.md`, remplacer la ligne qui commence par « 3. Arrêt du lot » par :

```
3. Arrêt du lot (la ligne bloquée et les suivantes en `non_lancee`) pour les codes : `quota_user`, `quota_global`, `trial_over`, `no_credits`, `invalid_key`, `key_unreadable`, `terms`, `email_unconfirmed`, `busy`, `rate_limited`. Messages via `messageErreur`.
```

et la ligne qui commence par « 4. Échec isolé » par :

```
4. Échec isolé (`moderated`, `failed`, `provider_error`) : la ligne passe en `echec`, le lot continue. Délai dépassé (`timeout`) : la ligne passe en `a_verifier` (l'image peut encore aboutir, visible dans l'Historique), le lot continue, et cette ligne n'est pas relancée automatiquement pour ne pas débiter le quota deux fois.
```

- [ ] **Step 2: Section du mode d'emploi**

Insérer dans `public/modes-emploi/imagactif.html`, juste après la balise `</section>` qui ferme « Retoucher une image » :

```html
  <section class="plai-section">
    <h2>Créer une série d'images</h2>
    <p><strong>Quand l'utiliser.</strong> Vous voulez plusieurs images au même style (un imagier, des cartes de vocabulaire, des affichages) en changeant seulement le sujet. Réglez d'abord le style, la palette et le cadrage dans le formulaire (ou chargez un modèle), puis ouvrez « Série d'images ».</p>
    <ol>
      <li>Remplissez la colonne <strong>Sujet</strong>, une ligne par image (12 maximum). Vous pouvez aussi copier des cellules dans Excel ou LibreOffice et les coller dans « Coller depuis un tableur ».</li>
      <li>Si besoin, ajoutez une ou deux <strong>colonnes supplémentaires</strong> (par exemple le lieu du décor). Une cellule laissée vide garde la valeur du formulaire.</li>
      <li>Cliquez sur <strong>Créer la série</strong>. Les images se créent l'une après l'autre (environ 15 secondes chacune). Restez sur la page jusqu'à la fin.</li>
      <li>Relisez chaque image. Les images arrivent aussi dans l'Historique, comme des images ordinaires.</li>
    </ol>
    <p><strong>Quota.</strong> Chaque image de la série compte pour une image de votre quota d'essai. Si le quota ne suffit pas, la série s'arrête et les lignes restantes sont marquées « non lancées » : vous pourrez les relancer plus tard. Une image refusée ou en échec n'est pas décomptée.</p>
    <div class="encadre"><strong>Limites, dites honnêtement :</strong>
      <ul>
        <li>Le style est commun, mais <strong>la composition peut varier</strong> d'une image à l'autre, même avec la même graine.</li>
        <li>Si vous quittez la page pendant la série, elle s'interrompt après l'image en cours. Le tableau est gardé tant que vous restez dans l'application, pas si vous rechargez la page : bouton « Copier le tableau » pour le conserver.</li>
        <li><strong>Chaque sujet part chez BFL.</strong> N'y mettez aucun nom ni donnée d'élève.</li>
      </ul>
    </div>
  </section>
```

- [ ] **Step 3: Vérifier que le texte ne contredit pas le registre RGPD ni les règles**

Run: `grep -n "série\|lot" ../docs/imagactif-registre-rgpd.md src/lib/terms.js | head`
Lire les passages sur les données envoyées à BFL et sur la conservation. Les sujets du tableau sont envoyés et conservés exactement comme ceux du formulaire (image 30 jours, JSON 1 an) : si les textes le disent déjà en termes généraux, ne rien changer ; sinon, ajouter une phrase et incrémenter `TERMS_VERSION` seulement si les règles elles-mêmes changent (demander à JF avant d'incrémenter, car cela redemande l'acceptation à tous les comptes).

- [ ] **Step 4: Commit**

```bash
git add public/modes-emploi/imagactif.html docs/superpowers/specs/2026-10-13-mode-serie-design.md
git commit -m "docs(serie): mode d'emploi et spec alignée sur l'implémentation

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Vérification dans le navigateur (locale, sans appel BFL)**

Lancer le serveur de dev jetable utilisé pour la retouche (compte de test créé puis supprimé, comme au 2026-10-08) ; si le fichier d'environnement local manque, le demander à JF. Contrôler, avec la section « Série d'images » ouverte :
1. Le tableau accepte la saisie, l'ajout et la suppression de lignes, jusqu'à 12.
2. Le collage de trois lignes à une colonne, puis de deux lignes à deux colonnes, remplit le tableau.
3. Les deux listes de colonnes supplémentaires n'offrent pas deux fois le même champ, et un champ verrouillé par un modèle n'y figure pas.
4. Le compteur annonce « N images = N sur votre quota » et prévient quand N dépasse le reste.
5. Une ligne avec un détail de 4100 caractères affiche « Ligne N : … trop longue » sans rien envoyer.
6. Avec un modèle dont le sujet est verrouillé, la section est désactivée avec son message.
7. Lecture à 375 px de large : pas de défilement horizontal de la page (le tableau peut défiler dans sa zone).
Noter honnêtement ce qui n'a pas été contrôlé (lecteur d'écran, mobile réel).

- [ ] **Step 6: Essai réel de 2 images (accord explicite de JF requis, dépense de crédit)**

Demander à JF son accord. Avec deux sujets, lancer la série sur ImagActif en local ou en production : les deux images apparaissent dans la page puis dans l'Historique, le compteur d'usage monte de 2, un arrêt demandé entre les deux marque la seconde « non lancée », et « Relancer » ne refait que celle-là.

- [ ] **Step 7: Revue finale globale**

Dispatcher une revue de toute la branche (skill `superpowers:requesting-code-review`) sur le diff depuis `da8aa5c` : cohérence des noms entre `serie.js`, `lot.js`, `SerieForm.jsx` et `Creer.jsx`, absence d'état mort, accessibilité (labels, `aria-live`), absence de `console.log`. Corriger puis relancer `npx vitest run` et `npx vite build`.

- [ ] **Step 8: Publication (accord de JF requis)**

Après accord de JF : `git push`, vérifier que le déploiement Vercel passe, puis mettre à jour la vignette dans `portail-plai/src/data/apps.ts` et la carte de `landing-jfb4plai` (repos et déploiements séparés ; aucune formulation du type « comme un produit commercial »).
