# ImagActif : mode Série (génération en lot)

Date : 2026-10-13. Statut : design validé en conversation, spec à relire par JF.

## Intention

Permettre à un enseignant FWB de produire une série d'images au style commun (imagier, cartes, affichages) en fournissant une liste de sujets, au lieu de relancer le formulaire à la main pour chaque image. Origine : le schéma « gabarit de génération en série » (invariants + variables + instances) apporté par JF le 2026-10-13 ; seule sa logique est reprise, pas son format JSON.

Décisions de JF (2026-10-13) :
- Chaque image du lot compte dans le quota d'essai (10 images par jour), sans règle de quota distincte.
- Une ligne du tableau change le sujet, plus un ou deux champs texte simples au choix (option B).
- Série éphémère : rien d'enregistré en base, pas de migration (option 1).
- Lot plafonné à 12 images.

## Hors périmètre

- Table `img_series`, reprise d'une série après rechargement, regroupement des images d'un lot dans l'Historique (extensions possibles, indépendantes).
- Images de référence entre images d'une même série pour la cohérence de composition (à tester séparément, étape 3 du plan JF).
- Import d'un JSON de série (le type est détecté et refusé avec un message, commit da8aa5c).
- Colonnes de type liste (éléments, textes) et style : communs à toute la série.

## Architecture

Tout côté client. Le serveur ne change pas : chaque ligne appelle `POST /api/generate` comme une création normale (quota via `reserveQuota`, suivi via `/api/status`).

Contrainte : l'index unique `img_generations_one_pending` (migration 20261008) n'autorise qu'une génération « en cours » par utilisateur. Le lot est donc séquentiel (environ 15 s par image, 3 min pour 12) et l'onglet doit rester ouvert.

Unités :
- `src/lib/serie.js` (pur, testé) :
  - `COLONNES_EXTRA` : chemins proposés, tirés de `CHAMPS` (champs `texte` ou `textarea`, hors sujet.description) : `sujet.details`, `composition.arriere_plan`, `couleurs.dominantes`, `lumiere`, `decor.lieu`, `atmosphere`.
  - `colonnesDisponibles(verrous)` : exclut les champs verrouillés par un modèle.
  - `parserTableau(texte, nbColonnes)` : une ligne par image, cellules séparées par des tabulations, lignes vides ignorées, cellules tronquées à 500 caractères, 12 lignes maximum, colonnes en trop ignorées.
  - `gabaritPourLigne(base, colonnes, ligne)` : copie profonde du gabarit du formulaire avec les valeurs de la ligne posées via `setIn`.
  - `PLAFOND_SERIE = 12`.
- `src/lib/lot.js` : `executerLot({ lignes, base, colonnes, generer, suivre, arret })`, déroulé séquentiel avec l'API et le suivi injectés (testable sans réseau). Renvoie l'état de chaque ligne.
- `src/components/SerieForm.jsx` : tableau, choix des colonnes, collage, compteur de quota, suivi par ligne.
- `src/pages/Creer.jsx` : extraction de `suivre` pour qu'il renvoie `{ gen, url }` au lieu d'écrire dans l'état de l'écran (le formulaire simple continue d'appeler `setResultat` avec ce retour). La section Série s'ajoute sous le formulaire.
- Le tableau est conservé dans `brouillon` (état de l'application) : il survit au changement d'onglet, pas au rechargement.

## Interface

Section repliée « Série d'images » sous le formulaire. Le formulaire courant (ou le modèle chargé) fournit le style commun ; `sujet.description` du formulaire n'est pas exigé quand on lance une série.

Tableau :
- Colonne « Sujet » obligatoire. Jusqu'à 2 colonnes supplémentaires choisies dans une liste déroulante.
- Chaque colonne a un label précis, un placeholder concret en exemple FWB (ex. « une locomotive à vapeur », « fond uni beige ») et une aide qui explique la portée sur l'image.
- Ajout et suppression de lignes ; zone « Coller depuis un tableur » (tabulations) qui remplit le tableau.
- Bouton « Copier le tableau » (texte à tabulations) pour le garder hors de l'application.
- Compteur : « 8 images = 8 sur votre quota ; il vous en reste 5 aujourd'hui » (régime essai) ; en régime clé personnelle, seul le nombre d'images est affiché.
- Avertissement visible : aucun nom ni donnée d'élève (chaque ligne part chez BFL).
- Avertissement de limite : le style est commun mais la composition peut varier d'une image à l'autre.
- Lignes au-delà de 12 : refusées avec message.

## Déroulé du lot

Pour chaque ligne non vide, dans l'ordre :
1. `generer(gabaritPourLigne(...), null)` puis `suivre(id)`.
2. État de ligne : `attente`, `cours`, `fini` (avec miniature), `echec` (avec message), `non_lancee`.
3. Arrêt du lot (la ligne bloquée et les suivantes en `non_lancee`) pour les codes : `quota_user`, `quota_global`, `trial_over`, `no_credits`, `invalid_key`, `key_unreadable`, `terms`, `email_unconfirmed`, `busy`, `rate_limited`. Messages via `messageErreur`.
4. Échec isolé (`moderated`, `failed`, `provider_error`) : la ligne passe en `echec`, le lot continue. Délai dépassé (`timeout`) : la ligne passe en `a_verifier` (l'image peut encore aboutir, visible dans l'Historique), le lot continue, et cette ligne n'est pas relancée automatiquement pour ne pas débiter le quota deux fois.
5. « Arrêter après l'image en cours » : positionne `arret`, le lot s'interrompt entre deux images.
6. « Relancer les lignes en échec ou non lancées » : ne relance que ces lignes, les images réussies ne sont pas refaites (et ne sont pas re-débitées du quota).
7. Alerte `beforeunload` pendant l'exécution.
8. Graine : celle du formulaire si elle est renseignée (commune à toutes les images), sinon tirée par le serveur à chaque image. Aucun `parentId`.
9. Après le lot : `recharger()` (quota affiché) une fois, pas à chaque image.

## Données et RGPD

Aucune nouvelle donnée stockée : chaque image est une génération normale (image 30 jours, JSON 1 an, mêmes purges). Les sujets du tableau ne sont écrits nulle part avant d'être envoyés, ligne par ligne, dans le JSON de chaque génération. Vérifier à la mise à jour des textes que le registre RGPD et les règles couvrent cet usage sans changement ; sinon les amender.

## Tests

- `serie.test.js` : collage (tabulations, lignes vides, plafond 12, troncature), colonnes verrouillées exclues, `gabaritPourLigne` ne mute pas la base et respecte les chemins imbriqués.
- `lot.test.js` (fausse API) : lot complet ; arrêt sur `quota_user` avec lignes restantes `non_lancee` ; poursuite après un échec isolé ; relance des seules lignes en échec ; arrêt demandé entre deux images.
- `SerieForm.test.jsx` : rendu, choix de colonnes (2 maximum), collage, compteur, désactivation du bouton quand le tableau est vide, message de plafond.
- Vérification locale dans le navigateur (serveur de dev jetable, comme pour la retouche). Un essai réel BFL de 2 images n'a lieu qu'avec l'accord explicite de JF (dépense de crédit).

## Textes à mettre à jour après la fonctionnalité

Mode d'emploi (`public/modes-emploi/imagactif.html`), règles (version à incrémenter si le contenu change), vignette portail (`portail-plai/src/data/apps.ts`) et carte landing, registre RGPD si besoin. RISS : aucune référence scientifique n'est ajoutée par cette fonctionnalité.
