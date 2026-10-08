import { gabaritVide } from './gabarit.js'
import { RATIO_IDS } from './ratios.js'

// Gabarit montré à l'IA : celui de l'application, sans exclusion par défaut (c'est l'enseignant qui décide).
export const SCHEMA_EXEMPLE = { ...gabaritVide(), exclusions: [] }

const FORMATS = RATIO_IDS.map((r) => `"${r}"`).join(', ')

// Consigne à coller dans une IA qui lit les images (ImagActif n'envoie jamais l'image : c'est l'enseignant qui la fournit à l'IA de son choix).
// Les détails qui n'ont pas de champ dédié vont dans « personnalise » : atmosphère, textes visibles, etc.
export const CONSIGNE_IMAGE_VERS_JSON = `Analyse l'image jointe et réponds UNIQUEMENT par un objet JSON valide, sans texte avant ni après, sans bloc de code.

Le JSON doit avoir exactement cette structure :
${JSON.stringify(SCHEMA_EXEMPLE, null, 2)}

Comment remplir chaque champ :
- sujet.description : ce que l'image montre, en une ou deux phrases (500 caractères maximum).
- sujet.details : objets, personnages, couleurs, nombre d'éléments et position de chacun (500 caractères maximum).
- style.type : technique et rendu (illustration plate, aquarelle, dessin au crayon, photographie, etc.).
- style.palette : couleurs dominantes et niveau de contraste.
- composition.cadrage : distance et placement du sujet. composition.point_de_vue : angle de vue. composition.arriere_plan : ce qu'il y a derrière le sujet.
- lumiere : source, direction et qualité de la lumière, ombres.
- exclusions : laisse [] sauf si tu repères un élément à ne pas reproduire (signature, filigrane).
- format.ratio : la valeur la plus proche parmi ${FORMATS}.
- generation.seed : laisse null.
- personnalise : liste d'objets { "nom": "...", "valeur": "..." } pour tout le reste, avec 10 champs maximum et 500 caractères maximum par valeur. Utilise notamment :
  - "Atmosphère" : ambiance et émotion qui se dégagent de l'image ;
  - "Textes visibles" : recopie chaque texte lisible entre guillemets, avec sa position (par exemple « titre en haut à gauche ») ; écris "aucun" s'il n'y en a pas ;
  - "Éléments secondaires" : détails du décor, accessoires, arrière-plan lointain ;
  - "Matières et textures" : papier, tissu, bois, rendu du trait, grain.

Règles :
- N'invente rien : décris uniquement ce qui est visible. Si un élément est incertain, écris "incertain".
- N'identifie aucune personne : décris-les de façon générique (âge apparent, vêtements, posture), sans nom.
- Écris en français. N'utilise pas de guillemets droits (") à l'intérieur d'une valeur : remplace-les par « et ».
- Reste concret et précis : plus la description est détaillée, plus une nouvelle image sera proche de celle-ci.`
