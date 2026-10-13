// Reconnaît le format d'un JSON importé. Les gabarits « externes » (série, retouche, extraction, archivage)
// ne doivent pas passer par normaliserGabarit : leurs clés finiraient en champs personnalisés illisibles.
const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

export const TYPES_JSON = ['gabarit', 'serie', 'retouche', 'extraction', 'archivage']

export function detecterTypeJson(o) {
  if (!estObjet(o)) return 'gabarit'
  if (estObjet(o.invariants) && Array.isArray(o.variables)) return 'serie'
  if (Array.isArray(o.text_elements) && Array.isArray(o.edits)) return 'retouche'
  if (estObjet(o.scope) && Array.isArray(o.items)) return 'extraction'
  if (typeof o.title === 'string' && typeof o.summary === 'string' && estObjet(o.tags)) return 'archivage'
  return 'gabarit'
}

const MESSAGES = {
  serie: "Ce JSON est un gabarit de série (invariants + variables). Il n'est pas encore pris en charge ici.",
  retouche: "Ce JSON est une description pour retouche. Il n'est pas pris en charge à l'import du formulaire.",
  extraction: "Ce JSON est une extraction de contenu d'image : il ne décrit pas une image à créer, il n'est pas importé.",
  archivage: "Ce JSON est une fiche d'archivage : il ne décrit pas une image à créer, il n'est pas importé.",
}

export const messageTypeNonPris = (type) => MESSAGES[type] ?? ''
