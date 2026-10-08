import { describe, it, expect } from 'vitest'
import { CONSIGNE_IMAGE_VERS_JSON, SCHEMA_EXEMPLE } from './consigneImage.js'
import { normaliserGabarit } from './gabarit.js'
import { composePrompt } from './composePrompt.js'
import { extraireJson } from './extraireJson.js'
import { RATIO_IDS } from './ratios.js'

describe('consigne « image vers JSON »', () => {
  it('le schéma montré à l\'IA est accepté tel quel par l\'import, sans avertissement', () => {
    const { avertissements } = normaliserGabarit(SCHEMA_EXEMPLE)
    expect(avertissements).toEqual([])
  })

  it('le schéma est en version 2 avec exclusions vides', () => {
    expect(SCHEMA_EXEMPLE.schema_version).toBe(2)
    expect(SCHEMA_EXEMPLE.exclusions).toEqual([])
  })

  it('contient le schéma exact, avec toutes ses clés', () => {
    expect(CONSIGNE_IMAGE_VERS_JSON).toContain(JSON.stringify(SCHEMA_EXEMPLE, null, 2))
    for (const cle of ['sujet', 'elements', 'style', 'couleurs', 'composition', 'lumiere', 'eclairage', 'decor', 'atmosphere', 'textes', 'rendu', 'mouvement', 'exclusions', 'format', 'generation', 'personnalise']) {
      expect(Object.keys(SCHEMA_EXEMPLE)).toContain(cle)
    }
  })

  it('liste tous les formats acceptés', () => {
    for (const ratio of RATIO_IDS) expect(CONSIGNE_IMAGE_VERS_JSON).toContain(`"${ratio}"`)
  })

  it('explique chaque groupe et envoie les textes visibles dans le tableau textes', () => {
    expect(CONSIGNE_IMAGE_VERS_JSON).toContain('Textes visibles')
    expect(CONSIGNE_IMAGE_VERS_JSON).toMatch(/Textes visibles[^\n]*`?textes`?/)
    for (const mot of ['elements', 'couleurs', 'eclairage', 'decor', 'atmosphere', 'rendu', 'mouvement']) {
      expect(CONSIGNE_IMAGE_VERS_JSON).toContain(`- ${mot}`)
    }
  })

  it('annonce les limites réelles de l\'import', () => {
    expect(CONSIGNE_IMAGE_VERS_JSON).toContain('500 caractères')
    expect(CONSIGNE_IMAGE_VERS_JSON).toContain('15 éléments')
    expect(CONSIGNE_IMAGE_VERS_JSON).toContain('10 textes')
    expect(CONSIGNE_IMAGE_VERS_JSON).toContain('10 champs')
  })

  it('interdit d\'identifier des personnes et d\'inventer', () => {
    expect(CONSIGNE_IMAGE_VERS_JSON).toMatch(/n'identifie aucune personne/i)
    expect(CONSIGNE_IMAGE_VERS_JSON).toMatch(/n'invente rien/i)
  })

  it('demande de laisser vide ce qui n\'est pas visible', () => {
    expect(CONSIGNE_IMAGE_VERS_JSON).toContain('""')
    expect(CONSIGNE_IMAGE_VERS_JSON).toContain('[]')
  })

  it('demande une réponse JSON seule', () => {
    expect(CONSIGNE_IMAGE_VERS_JSON).toMatch(/UNIQUEMENT par un objet JSON/)
  })

  it('de bout en bout : une réponse v2 enrobée passe l\'extraction, la normalisation et la composition', () => {
    const reponse = `Voici le résultat :
\`\`\`json
{
  "schema_version": 2,
  "sujet": { "description": "Une salle de classe vide", "details": "Tables alignées" },
  "elements": [{ "nom": "tableau vert", "position": "au fond à gauche", "details": "effacé" }],
  "style": { "type": "photographie", "palette": "tons neutres" },
  "couleurs": { "dominantes": "vert et beige", "saturation": "", "contraste": "", "harmonie": "" },
  "composition": { "cadrage": "plan large", "point_de_vue": "", "arriere_plan": "", "profondeur": "", "plans": "", "symetrie": "" },
  "lumiere": "",
  "eclairage": { "source": "fenêtres", "direction": "", "qualite": "", "temperature": "", "ombres": "" },
  "decor": { "lieu": "école primaire", "moment": "", "meteo_saison": "", "elements": "" },
  "atmosphere": "silencieuse et studieuse",
  "textes": [{ "contenu": "Bienvenue", "position": "en haut du tableau", "style": "craie blanche" }],
  "rendu": { "nettete": "", "textures": "", "grain": "" },
  "mouvement": "",
  "exclusions": [],
  "format": { "ratio": "16:9" },
  "generation": { "seed": null },
  "personnalise": []
}
\`\`\`
J'espère que cela aide.`
    const { gabarit, avertissements } = normaliserGabarit(extraireJson(reponse))
    expect(avertissements).toEqual([])
    const prompt = composePrompt(gabarit)
    expect(prompt).toContain('Atmosphère : silencieuse et studieuse.')
    expect(prompt).toContain('Texte visible : « Bienvenue » (en haut du tableau, craie blanche).')
    expect(prompt).toContain('tableau vert (au fond à gauche) : effacé')
  })
})
