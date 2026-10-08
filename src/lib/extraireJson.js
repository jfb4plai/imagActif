// Extrait le premier objet JSON d'un texte collé : une IA l'entoure souvent d'un bloc ```json ou d'une phrase d'introduction.
// Lève une SyntaxError si aucun objet JSON complet n'est trouvé.
export function extraireJson(texte) {
  const brut = String(texte ?? '')
  const debut = brut.indexOf('{')
  if (debut === -1) throw new SyntaxError('Aucun objet JSON trouvé.')

  // Parcours en tenant compte des chaînes : les accolades dans un texte ne comptent pas.
  let profondeur = 0
  let dansChaine = false
  let echappe = false
  for (let i = debut; i < brut.length; i++) {
    const c = brut[i]
    if (dansChaine) {
      if (echappe) echappe = false
      else if (c === '\\') echappe = true
      else if (c === '"') dansChaine = false
      continue
    }
    if (c === '"') dansChaine = true
    else if (c === '{') profondeur++
    else if (c === '}') {
      profondeur--
      if (profondeur === 0) return JSON.parse(brut.slice(debut, i + 1))
    }
  }
  throw new SyntaxError('Objet JSON incomplet.')
}
