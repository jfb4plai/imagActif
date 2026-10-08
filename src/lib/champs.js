export const STYLES_SUGGERES = [
  'illustration plate aux contours nets',
  'aquarelle',
  'dessin au crayon de couleur',
  'dessin au trait noir et blanc',
  'pictogramme simple',
  'photographie réaliste',
]

export const CHAMPS = [
  {
    path: 'sujet.description', label: 'Sujet principal', type: 'textarea', obligatoire: true,
    placeholder: "Un chat roux qui dort sur le rebord d'une fenêtre d'école",
    aide: "Ce que l'image doit montrer, en une ou deux phrases : c'est l'élément le plus important. Ne décrivez jamais un élève réel et ne citez aucun nom : ce texte est envoyé à BFL.",
  },
  {
    path: 'sujet.details', label: 'Détails du sujet', type: 'textarea',
    placeholder: 'Pelage roux tigré, yeux fermés, une plante verte à côté',
    aide: "Objets, couleurs, nombre de personnages à faire apparaître. Plus c'est concret, moins l'IA improvise.",
  },
  {
    path: 'style.type', label: 'Style visuel', type: 'texte', suggestions: STYLES_SUGGERES,
    placeholder: 'illustration plate aux contours nets',
    aide: "Le style change tout le rendu. Pour garder des images homogènes d'une fiche à l'autre, gardez le même style : enregistrez un modèle.",
  },
  {
    path: 'style.palette', label: 'Palette de couleurs', type: 'texte',
    placeholder: 'tons chauds, orange et beige, peu de contrastes',
    aide: "Couleurs dominantes. Pour une image épurée, demandez peu de couleurs et un fond uni.",
  },
  {
    path: 'composition.cadrage', label: 'Cadrage', type: 'texte',
    placeholder: 'plan rapproché, sujet centré',
    aide: "Distance et placement du sujet dans l'image. Un sujet centré sur fond simple donne une image épurée.",
  },
  {
    path: 'composition.point_de_vue', label: 'Point de vue', type: 'texte',
    placeholder: 'vue de face, à hauteur du sujet',
    aide: "Depuis où l'on regarde la scène (de face, de dessus, de profil…).",
  },
  {
    path: 'composition.arriere_plan', label: 'Arrière-plan', type: 'texte',
    placeholder: 'fond uni beige',
    aide: "Ce qu'il y a derrière le sujet. Un fond uni évite les éléments parasites.",
  },
  {
    path: 'lumiere', label: 'Lumière', type: 'texte',
    placeholder: 'lumière douce du matin',
    aide: "Ambiance lumineuse : elle influence les ombres et les couleurs.",
  },
  {
    path: 'exclusions', label: 'À éviter', type: 'liste',
    placeholder: "pas de texte dans l'image\nvisages réalistes",
    aide: "Une chose par ligne. Les modèles d'images écrivent mal : « pas de texte dans l'image » est conseillé, ajoutez votre texte dans votre document. Ces consignes sont des demandes, pas des garanties : l'IA peut ne pas les respecter à 100 %.",
  },
  {
    path: 'format.ratio', label: "Format de l'image", type: 'ratio',
    aide: "Forme de l'image (carré, paysage, portrait…). Choisissez-la selon l'endroit où elle sera placée dans votre document.",
  },
  {
    path: 'generation.seed', label: 'Graine (facultatif)', type: 'seed',
    placeholder: 'laisser vide pour une image nouvelle',
    aide: "Un nombre qui fixe le « tirage au sort » de l'IA. Même graine et mêmes champs : image très proche. Changez un seul champ en gardant la graine pour obtenir une variante proche. Laissez vide pour une image toute nouvelle.",
  },
  {
    path: 'personnalise', label: 'Champs personnalisés', type: 'custom',
    aide: "Ajoutez vos propres critères (nom + valeur), par exemple « Saison : automne ». Ils sont ajoutés tels quels à la description envoyée à l'IA, dans l'ordre.",
  },
]
