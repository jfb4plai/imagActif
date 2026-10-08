import { RATIO_IDS } from './ratios.js'

export const SCHEMA_VERSION = 1
export const EXCLUSION_DEFAUT = "pas de texte dans l'image"

const MAX_TEXTE = 500
const MAX_LISTE = 10
const SEED_MAX = 4294967295
const CLES_CONNUES = ['schema_version', 'sujet', 'style', 'composition', 'lumiere', 'exclusions', 'format', 'generation', 'personnalise']

export function gabaritVide() {
  return {
    schema_version: SCHEMA_VERSION,
    sujet: { description: '', details: '' },
    style: { type: '', palette: '' },
    composition: { cadrage: '', point_de_vue: '', arriere_plan: '' },
    lumiere: '',
    exclusions: [EXCLUSION_DEFAUT],
    format: { ratio: '1:1' },
    generation: { seed: null },
    personnalise: [],
  }
}

const txt = (v) => (typeof v === 'string' ? v.trim().slice(0, MAX_TEXTE) : '')
const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// Transforme n'importe quel objet (import collé, ancien JSON) en gabarit valide.
// Ne lève une erreur que si l'entrée n'est pas un objet. Rien n'est exécuté.
export function normaliserGabarit(entree) {
  if (!estObjet(entree)) throw new Error('JSON invalide : un objet est attendu.')
  const avertissements = []

  let ratio = '1:1'
  if (entree.format?.ratio !== undefined) {
    if (RATIO_IDS.includes(entree.format.ratio)) ratio = entree.format.ratio
    else avertissements.push(`Format « ${String(entree.format.ratio)} » inconnu : carré 1:1 utilisé.`)
  }

  let seed = null
  const s = entree.generation?.seed
  if (s !== undefined && s !== null) {
    if (Number.isInteger(s) && s >= 0 && s <= SEED_MAX) seed = s
    else avertissements.push('Graine invalide : ignorée.')
  }

  const personnalise = []
  if (Array.isArray(entree.personnalise)) {
    for (const p of entree.personnalise) {
      const nom = txt(p?.nom)
      const valeur = txt(p?.valeur)
      if (nom && valeur) personnalise.push({ nom, valeur })
    }
  }
  for (const [cle, valeur] of Object.entries(entree)) {
    if (CLES_CONNUES.includes(cle) || cle === '__proto__') continue
    const v = txt(typeof valeur === 'string' ? valeur : JSON.stringify(valeur))
    const nom = txt(cle)
    if (nom && v) {
      personnalise.push({ nom, valeur: v })
      avertissements.push(`Champ inconnu « ${nom} » déplacé dans les champs personnalisés.`)
    }
  }

  const gabarit = {
    schema_version: SCHEMA_VERSION,
    sujet: { description: txt(entree.sujet?.description), details: txt(entree.sujet?.details) },
    style: { type: txt(entree.style?.type), palette: txt(entree.style?.palette) },
    composition: {
      cadrage: txt(entree.composition?.cadrage),
      point_de_vue: txt(entree.composition?.point_de_vue),
      arriere_plan: txt(entree.composition?.arriere_plan),
    },
    lumiere: txt(entree.lumiere),
    exclusions: Array.isArray(entree.exclusions)
      ? entree.exclusions.map(txt).filter(Boolean).slice(0, MAX_LISTE)
      : [EXCLUSION_DEFAUT],
    format: { ratio },
    generation: { seed },
    personnalise: personnalise.slice(0, MAX_LISTE),
  }
  return { gabarit, avertissements }
}

export function validerPourGeneration(gabarit) {
  const erreurs = []
  if (!gabarit.sujet.description) erreurs.push("Décrivez le sujet de l'image.")
  return erreurs
}
