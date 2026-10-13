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
// etats[i] = { statut, message?, genId? } suit chaque ligne ; il vit avec le tableau pour survivre à un changement d'onglet.
export const serieVide = () => ({ colonnes: [], lignes: [['']], etats: [] })

// Une image terminée, ou dont l'issue est à vérifier dans l'Historique, ne doit jamais être relancée (double débit du quota).
const STATUTS_TERMINES = ['fini', 'a_verifier']

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
  return { ...serie, colonnes, lignes }
}

// Modifier une cellule remet cette ligne à lancer ; le suivi des autres lignes est conservé.
export function majCellule(serie, i, j, valeur) {
  return {
    ...serie,
    lignes: serie.lignes.map((l, k) => (k === i ? l.map((c, m) => (m === j ? valeur : c)) : l)),
    ...(serie.etats ? { etats: serie.etats.map((e, k) => (k === i ? {} : e)) } : {}),
  }
}

export function ajouterLigne(serie) {
  if (serie.lignes.length >= PLAFOND_SERIE) return serie
  return { ...serie, lignes: [...serie.lignes, Array(1 + serie.colonnes.length).fill('')] }
}

export function supprimerLigne(serie, i) {
  const lignes = serie.lignes.filter((_, k) => k !== i)
  return {
    ...serie,
    lignes: lignes.length ? lignes : [Array(1 + serie.colonnes.length).fill('')],
    ...(serie.etats ? { etats: serie.etats.filter((_, k) => k !== i) } : {}),
  }
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
  return { serie: lignes.length ? { ...serie, lignes, etats: [] } : serie, tronque }
}

// Lignes à créer : celles qui ont un sujet et dont l'image n'est ni terminée ni à vérifier.
export const lignesALancer = (serie) => lignesUtiles(serie).filter((i) => !STATUTS_TERMINES.includes(serie.etats?.[i]?.statut))

const etatsComplets = (serie) => Array.from({ length: serie.lignes.length }, (_, k) => serie.etats?.[k] ?? {})

export function majEtatSerie(serie, i, etat) {
  const etats = etatsComplets(serie)
  etats[i] = { ...etats[i], ...etat }
  return { ...serie, etats }
}

export function marquerAttente(serie, indices) {
  return { ...serie, etats: etatsComplets(serie).map((e, k) => (indices.includes(k) ? { ...e, statut: 'attente' } : e)) }
}

export const effacerSuivi = (serie) => ({ ...serie, etats: [] })

// Un modèle qui verrouille un champ ne peut pas servir de colonne : on la retire en gardant les autres cellules.
export function retirerColonnesVerrouillees(serie, verrous = []) {
  let s = serie
  for (let i = s.colonnes.findIndex((c) => verrous.includes(c)); i !== -1; i = s.colonnes.findIndex((c) => verrous.includes(c))) {
    s = changerColonne(s, i, '')
  }
  return s
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
