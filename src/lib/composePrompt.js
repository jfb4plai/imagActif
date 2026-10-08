// FLUX n'a pas de prompt négatif : « À éviter » est une consigne textuelle, pas une garantie.
const fin = (s) => (/[.!?…]$/.test(s) ? s : `${s}.`)
const ligne = (etiquette, valeur) => (valeur ? fin(`${etiquette} : ${valeur}`) : '')

// Éléments : une seule phrase « nom (position) : détails ; nom2 ».
function phraseElements(elements = []) {
  const items = elements.map((e) => `${e.nom}${e.position ? ` (${e.position})` : ''}${e.details ? ` : ${e.details}` : ''}`)
  return items.length ? fin(`Éléments : ${items.join(' ; ')}`) : ''
}

function phraseTexte(t) {
  const precisions = [t.position, t.style].filter(Boolean).join(', ')
  return fin(`Texte visible : « ${t.contenu} »${precisions ? ` (${precisions})` : ''}`)
}

export function composePrompt(g) {
  const couleurs = g.couleurs ?? {}
  const eclairage = g.eclairage ?? {}
  const decor = g.decor ?? {}
  const rendu = g.rendu ?? {}
  const parties = [
    g.sujet.description && fin(g.sujet.description),
    g.sujet.details && fin(g.sujet.details),
    phraseElements(g.elements),
    ligne('Style', g.style.type),
    ligne('Palette', g.style.palette),
    ligne('Couleurs dominantes', couleurs.dominantes),
    ligne('Saturation', couleurs.saturation),
    ligne('Contraste', couleurs.contraste),
    ligne('Harmonie des couleurs', couleurs.harmonie),
    ligne('Cadrage', g.composition.cadrage),
    ligne('Point de vue', g.composition.point_de_vue),
    ligne('Arrière-plan', g.composition.arriere_plan),
    ligne('Profondeur de champ', g.composition.profondeur),
    ligne('Plans présents', g.composition.plans),
    ligne('Symétrie', g.composition.symetrie),
    ligne('Lumière', g.lumiere),
    ligne('Source de lumière', eclairage.source),
    ligne('Direction de la lumière', eclairage.direction),
    ligne('Qualité de la lumière', eclairage.qualite),
    ligne('Température de la lumière', eclairage.temperature),
    ligne('Ombres', eclairage.ombres),
    ligne('Lieu', decor.lieu),
    ligne('Moment', decor.moment),
    ligne('Météo et saison', decor.meteo_saison),
    ligne('Éléments du décor', decor.elements),
    ligne('Atmosphère', g.atmosphere),
    ...(g.textes ?? []).map(phraseTexte),
    ligne('Netteté', rendu.nettete),
    ligne('Textures', rendu.textures),
    ligne('Grain', rendu.grain),
    ligne('Mouvement', g.mouvement),
    ...g.personnalise.map((p) => ligne(p.nom, p.valeur)),
    g.exclusions.length ? fin(`À éviter : ${g.exclusions.join(', ')}`) : '',
  ]
  return parties.filter(Boolean).join(' ')
}
