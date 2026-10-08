import { RATIO_IDS } from './ratios.js'
import { composePrompt } from './composePrompt.js'

export const SCHEMA_VERSION = 2
export const PROMPT_MAX_CARACTERES = 4000
export const EXCLUSION_DEFAUT = "pas de texte dans l'image"

const MAX_TEXTE = 500
const MAX_LISTE = 10
const MAX_ELEMENTS = 15
const MAX_TEXTES = 10
const SEED_MAX = 4294967295
const CLES_CONNUES = [
  'schema_version', 'sujet', 'elements', 'style', 'couleurs', 'composition', 'lumiere', 'eclairage', 'decor',
  'atmosphere', 'textes', 'rendu', 'mouvement', 'exclusions', 'format', 'generation', 'personnalise',
]

// Sous-clés connues de chaque groupe de texte.
const GROUPES = {
  couleurs: ['dominantes', 'saturation', 'contraste', 'harmonie'],
  composition: ['cadrage', 'point_de_vue', 'arriere_plan', 'profondeur', 'plans', 'symetrie'],
  eclairage: ['source', 'direction', 'qualite', 'temperature', 'ombres'],
  decor: ['lieu', 'moment', 'meteo_saison', 'elements'],
  rendu: ['nettete', 'textures', 'grain'],
}

const groupeVide = (nom) => Object.fromEntries(GROUPES[nom].map((k) => [k, '']))

export function gabaritVide() {
  return {
    schema_version: SCHEMA_VERSION,
    sujet: { description: '', details: '' },
    elements: [],
    style: { type: '', palette: '' },
    couleurs: groupeVide('couleurs'),
    composition: groupeVide('composition'),
    lumiere: '',
    eclairage: groupeVide('eclairage'),
    decor: groupeVide('decor'),
    atmosphere: '',
    textes: [],
    rendu: groupeVide('rendu'),
    mouvement: '',
    exclusions: [EXCLUSION_DEFAUT],
    format: { ratio: '1:1' },
    generation: { seed: null },
    personnalise: [],
  }
}

const txt = (v) => (typeof v === 'string' ? v.trim().slice(0, MAX_TEXTE) : '')
const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const groupe = (nom, source) => Object.fromEntries(GROUPES[nom].map((k) => [k, txt(estObjet(source) ? source[k] : undefined)]))

// Liste d'objets : ignore ce qui n'est pas un objet et les entrées sans la clé obligatoire.
function liste(source, cleObligatoire, autres, max) {
  if (!Array.isArray(source)) return []
  const sortie = []
  for (const e of source) {
    if (!estObjet(e)) continue
    const obligatoire = txt(e[cleObligatoire])
    if (!obligatoire) continue
    sortie.push({ [cleObligatoire]: obligatoire, ...Object.fromEntries(autres.map((k) => [k, txt(e[k])])) })
    if (sortie.length >= max) break
  }
  return sortie
}

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
    elements: liste(entree.elements, 'nom', ['position', 'details'], MAX_ELEMENTS),
    style: { type: txt(entree.style?.type), palette: txt(entree.style?.palette) },
    couleurs: groupe('couleurs', entree.couleurs),
    composition: groupe('composition', entree.composition),
    lumiere: txt(entree.lumiere),
    eclairage: groupe('eclairage', entree.eclairage),
    decor: groupe('decor', entree.decor),
    atmosphere: txt(entree.atmosphere),
    textes: liste(entree.textes, 'contenu', ['position', 'style'], MAX_TEXTES),
    rendu: groupe('rendu', entree.rendu),
    mouvement: txt(entree.mouvement),
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
  const n = composePrompt(gabarit).length
  if (n > PROMPT_MAX_CARACTERES) {
    erreurs.push(`La description est trop longue (${n} caractères sur ${PROMPT_MAX_CARACTERES}) : raccourcissez-la.`)
  }
  return erreurs
}
