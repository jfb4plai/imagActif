// FLUX n'a pas de prompt négatif : « À éviter » est une consigne textuelle, pas une garantie.
const fin = (s) => (/[.!?…]$/.test(s) ? s : `${s}.`)
const ligne = (etiquette, valeur) => (valeur ? fin(`${etiquette} : ${valeur}`) : '')

export function composePrompt(g) {
  const parties = [
    g.sujet.description && fin(g.sujet.description),
    g.sujet.details && fin(g.sujet.details),
    ligne('Style', g.style.type),
    ligne('Palette', g.style.palette),
    ligne('Cadrage', g.composition.cadrage),
    ligne('Point de vue', g.composition.point_de_vue),
    ligne('Arrière-plan', g.composition.arriere_plan),
    ligne('Lumière', g.lumiere),
    ...g.personnalise.map((p) => ligne(p.nom, p.valeur)),
    g.exclusions.length ? fin(`À éviter : ${g.exclusions.join(', ')}`) : '',
  ]
  return parties.filter(Boolean).join(' ')
}
