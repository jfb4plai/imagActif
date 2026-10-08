import { gabaritVide } from './gabarit.js'
import { RATIO_IDS } from './ratios.js'

// Gabarit montré à l'IA : celui de l'application, sans exclusion par défaut (c'est l'enseignant qui décide).
export const SCHEMA_EXEMPLE = { ...gabaritVide(), exclusions: [] }

const FORMATS = RATIO_IDS.map((r) => `"${r}"`).join(', ')

// Consigne à coller dans une IA qui lit les images (ImagActif n'envoie jamais l'image : c'est l'enseignant qui la fournit à l'IA de son choix).
// Chaque détail visible a son champ dédié ; « personnalise » ne sert qu'à ce qui n'en a vraiment aucun.
export const CONSIGNE_IMAGE_VERS_JSON = `Analyse l'image jointe et réponds UNIQUEMENT par un objet JSON valide, sans texte avant ni après, sans bloc de code.

Le JSON doit avoir exactement cette structure :
${JSON.stringify(SCHEMA_EXEMPLE, null, 2)}

Comment remplir chaque champ :
- sujet.description : ce que l'image montre, en une ou deux phrases. sujet.details : nombre de personnages ou d'objets principaux et ce qui les distingue.
- elements : un objet par élément visible (15 éléments maximum) : { "nom": "...", "position": "où il se trouve dans l'image", "details": "couleur, taille, matière, état" }. Le nom est obligatoire.
- style.type : technique et rendu (illustration plate, aquarelle, dessin au crayon, photographie, etc.). style.palette : impression générale des couleurs.
- couleurs : dominantes (couleurs principales), saturation (vive, douce, désaturée), contraste (fort, faible), harmonie (monochrome, complémentaires, analogues, etc.).
- composition : cadrage (distance et placement du sujet), point_de_vue (angle de vue), arriere_plan (ce qu'il y a derrière le sujet), profondeur (netteté de l'avant et de l'arrière-plan), plans (premier plan, plan moyen, fond), symetrie (symétrique, asymétrique, centrée, règle des tiers).
- lumiere : impression générale de la lumière, en une courte phrase.
- eclairage : source (soleil, lampe, fenêtre), direction, qualite (dure, douce, diffuse), temperature (chaude, froide, neutre), ombres (longueur, netteté).
- decor : lieu, moment (heure ou période de la journée), meteo_saison, elements (détails du décor, accessoires, arrière-plan lointain).
- atmosphere : ambiance et émotion qui se dégagent de l'image.
- textes : un objet par texte lisible dans l'image (10 textes maximum) : { "contenu": "texte recopié", "position": "où il se trouve", "style": "police, couleur, taille" }. Textes visibles : recopie chaque texte tel qu'il apparaît dans le tableau textes ; laisse [] s'il n'y en a aucun.
- rendu : nettete, textures (papier, tissu, bois, rendu du trait), grain.
- mouvement : ce qui semble bouger, flou de bougé, sensation de vitesse ou d'immobilité.
- exclusions : laisse [] sauf si tu repères un élément à ne pas reproduire (signature, filigrane).
- format.ratio : la valeur la plus proche parmi ${FORMATS}.
- generation.seed : laisse null.
- personnalise : liste d'objets { "nom": "...", "valeur": "..." } pour tout ce qui n'a aucun champ ci-dessus, avec 10 champs maximum.

Limites : 500 caractères maximum par valeur, 15 éléments maximum, 10 textes maximum, 10 champs personnalisés maximum.

Règles :
- N'invente rien : décris uniquement ce qui est visible. Quand un détail n'est pas visible, laisse "" (texte) ou [] (liste). Si un élément est incertain, écris "incertain".
- N'identifie aucune personne : décris-les de façon générique (âge apparent, vêtements, posture), sans nom.
- Écris en français. N'utilise pas de guillemets droits (") à l'intérieur d'une valeur : remplace-les par « et ».
- Reste concret et précis : plus la description est détaillée, plus une nouvelle image sera proche de celle-ci.`
