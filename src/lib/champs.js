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
    path: 'elements', label: 'Éléments à faire apparaître', type: 'liste-objets', avance: true, section: 'Éléments', max: 15,
    aide: "Chaque ligne décrit un objet ou un personnage de la scène, avec sa place. Plus la liste est précise, moins l'IA improvise. Quinze éléments au maximum ; une ligne sans nom est ignorée.",
    colonnes: [
      { cle: 'nom', label: 'Nom', placeholder: 'un tableau noir' },
      { cle: 'position', label: 'Position', placeholder: 'à gauche, contre le mur' },
      { cle: 'details', label: 'Détails', placeholder: 'craie blanche, schéma de fractions écrit dessus' },
    ],
  },
  {
    path: 'couleurs.dominantes', label: 'Couleurs : dominantes', type: 'texte', avance: true, section: 'Couleurs',
    placeholder: 'bleu pétrole et jaune moutarde',
    aide: 'Les deux ou trois couleurs qui doivent se voir le plus. Elles pèsent plus que la palette générale.',
  },
  {
    path: 'couleurs.saturation', label: 'Couleurs : saturation', type: 'texte', avance: true, section: 'Couleurs',
    placeholder: 'couleurs douces, peu saturées',
    aide: "Intensité des couleurs : vives pour une image qui attire l'oeil, douces pour une image calme et peu chargée.",
  },
  {
    path: 'couleurs.contraste', label: 'Couleurs : contraste', type: 'texte', avance: true, section: 'Couleurs',
    placeholder: 'contraste élevé entre le sujet et le fond',
    aide: 'Écart entre zones claires et sombres. Un fort contraste rend le sujet plus lisible, par exemple pour une image projetée au tableau.',
  },
  {
    path: 'couleurs.harmonie', label: 'Couleurs : harmonie', type: 'texte', avance: true, section: 'Couleurs',
    placeholder: 'couleurs complémentaires, orange et bleu',
    aide: "La façon dont les couleurs s'accordent (monochrome, complémentaires, proches). Elle donne une unité à l'image.",
  },
  {
    path: 'composition.profondeur', label: 'Composition : profondeur de champ', type: 'texte', avance: true, section: 'Composition avancée',
    placeholder: 'sujet net, arrière-plan flou',
    aide: 'Ce qui est net et ce qui est flou. Un arrière-plan flou isole le sujet et réduit les éléments qui distraient.',
  },
  {
    path: 'composition.plans', label: 'Composition : plans présents', type: 'texte', avance: true, section: 'Composition avancée',
    placeholder: 'premier plan : un cartable ; arrière-plan : la cour de récréation',
    aide: 'Ce qui se trouve devant, au milieu et au fond. Cela organise la scène en couches.',
  },
  {
    path: 'composition.symetrie', label: 'Composition : symétrie', type: 'texte', avance: true, section: 'Composition avancée',
    placeholder: 'composition symétrique, sujet au centre',
    aide: "Image équilibrée de part et d'autre, ou volontairement décalée. Une composition symétrique paraît calme et ordonnée.",
  },
  {
    path: 'eclairage.source', label: 'Éclairage : source', type: 'texte', avance: true, section: 'Éclairage',
    placeholder: "grande fenêtre d'une classe, côté gauche",
    aide: "D'où vient la lumière (fenêtre, lampe, soleil). L'IA en déduit la forme des zones éclairées.",
  },
  {
    path: 'eclairage.direction', label: 'Éclairage : direction', type: 'texte', avance: true, section: 'Éclairage',
    placeholder: 'lumière venant de la gauche, légèrement de dessus',
    aide: 'Le sens des rayons. Il détermine de quel côté tombent les ombres.',
  },
  {
    path: 'eclairage.qualite', label: 'Éclairage : qualité', type: 'texte', avance: true, section: 'Éclairage',
    placeholder: 'lumière diffuse et douce',
    aide: 'Lumière douce (ombres floues) ou dure (ombres nettes). La lumière douce donne un rendu plus apaisé.',
  },
  {
    path: 'eclairage.temperature', label: 'Éclairage : température', type: 'texte', avance: true, section: 'Éclairage',
    placeholder: "lumière chaude, couleur de fin d'après-midi",
    aide: "Chaude (jaune-orangé) ou froide (bleutée). Elle teinte toute l'image.",
  },
  {
    path: 'eclairage.ombres', label: 'Éclairage : ombres', type: 'texte', avance: true, section: 'Éclairage',
    placeholder: 'ombres courtes et légères sous les objets',
    aide: "Force et longueur des ombres. Sans consigne, l'IA choisit seule.",
  },
  {
    path: 'decor.lieu', label: 'Décor : lieu', type: 'texte', avance: true, section: 'Décor',
    placeholder: "une cour de récréation d'école fondamentale",
    aide: 'Où se passe la scène. Un lieu précis évite un décor générique.',
  },
  {
    path: 'decor.moment', label: 'Décor : moment', type: 'texte', avance: true, section: 'Décor',
    placeholder: 'début de matinée, avant les cours',
    aide: "Moment de la journée. Il influence la lumière et l'ambiance.",
  },
  {
    path: 'decor.meteo_saison', label: 'Décor : météo et saison', type: 'texte', avance: true, section: 'Décor',
    placeholder: 'journée de pluie en automne',
    aide: 'Météo et saison, utiles par exemple pour illustrer un texte sur les saisons.',
  },
  {
    path: 'decor.elements', label: 'Décor : éléments du décor', type: 'texte', avance: true, section: 'Décor',
    placeholder: 'préau, vélos rangés, quelques feuilles mortes',
    aide: "Objets du lieu qui ne sont pas le sujet. Restez brefs : trop d'éléments chargent l'image.",
  },
  {
    path: 'atmosphere', label: 'Atmosphère', type: 'texte', avance: true, section: 'Atmosphère',
    placeholder: 'calme et concentrée, comme un début de cours',
    aide: "Impression générale à transmettre. C'est un mot-clé d'ambiance : l'IA l'interprète librement.",
  },
  {
    path: 'textes', label: "Textes présents dans l'image", type: 'liste-objets', avance: true, section: 'Textes présents', max: 10,
    aide: "Texte à faire apparaître (affiche, tableau, panneau). Attention : les IA écrivent mal, le texte demandé peut ne pas apparaître correctement (lettres inventées, fautes). Relisez toujours l'image et, si besoin, ajoutez le texte vous-même dans votre document. Dix textes au maximum ; une ligne sans contenu est ignorée.",
    colonnes: [
      { cle: 'contenu', label: 'Contenu', placeholder: 'Bienvenue en 3e année' },
      { cle: 'position', label: 'Position', placeholder: 'en haut, centré' },
      { cle: 'style', label: 'Style', placeholder: 'grandes lettres bleues' },
    ],
  },
  {
    path: 'rendu.nettete', label: 'Rendu : netteté', type: 'texte', avance: true, section: 'Rendu et matières',
    placeholder: 'contours bien nets',
    aide: 'Précision des contours. Des contours nets conviennent aux images à photocopier ou à projeter.',
  },
  {
    path: 'rendu.textures', label: 'Rendu : textures', type: 'texte', avance: true, section: 'Rendu et matières',
    placeholder: 'papier légèrement texturé, bois clair',
    aide: "Matières visibles (papier, bois, tissu). Elles donnent du relief à l'image.",
  },
  {
    path: 'rendu.grain', label: 'Rendu : grain', type: 'texte', avance: true, section: 'Rendu et matières',
    placeholder: 'aucun grain, aplats lisses',
    aide: "Présence d'un grain de pellicule ou d'un aspect lisse. Un rendu lisse reste plus lisible en petit format.",
  },
  {
    path: 'mouvement', label: 'Mouvement', type: 'texte', avance: true, section: 'Mouvement',
    placeholder: 'deux enfants courent vers le préau, silhouettes légèrement floues',
    aide: "Impression de mouvement ou d'immobilité. Ne décrivez jamais d'élève réel : parlez de personnages imaginaires.",
  },
  {
    path: 'exclusions', label: 'À éviter', type: 'liste',
    placeholder: "pas de texte dans l'image\nvisages réalistes",
    aide: "Une chose par ligne. Les modèles d'images écrivent mal : « pas de texte dans l'image » est conseillé, ajoutez votre texte dans votre document. Ces consignes sont des demandes, pas des garanties : lors de nos essais, des images à l'aquarelle ont reçu une fausse signature malgré « pas de texte dans l'image ». Relisez chaque image avant de l'utiliser.",
  },
  {
    path: 'format.ratio', label: "Format de l'image", type: 'ratio',
    aide: "Forme de l'image (carré, paysage, portrait…). Choisissez-la selon l'endroit où elle sera placée dans votre document.",
  },
  {
    path: 'generation.seed', label: 'Graine (facultatif)', type: 'seed',
    placeholder: 'laisser vide pour une image nouvelle',
    aide: "Un nombre transmis à l'IA pour orienter son « tirage au sort ». Lors de nos essais (octobre 2026), une même graine avec les mêmes champs a donné des images au même sujet et au même style, mais pas identiques : cadrage et décor changeaient. Ne comptez donc pas sur elle pour retrouver exactement une image. Laissez vide pour une image toute nouvelle.",
  },
  {
    path: 'personnalise', label: 'Champs personnalisés', type: 'liste-objets', max: 10,
    colonnes: [
      { cle: 'nom', label: 'Nom', placeholder: 'Saison' },
      { cle: 'valeur', label: 'Valeur', placeholder: 'automne' },
    ],
    aide: "Ajoutez vos propres critères (nom + valeur), par exemple « Saison : automne ». Ils sont ajoutés tels quels à la description envoyée à l'IA, dans l'ordre.",
  },
]
