# ImagActif : série « même décor » (image de référence)

Date : 2026-10-13. Statut : design validé en principe par JF (« ton avis : ok »), spec à relire avant plan.

## Intention

Dans une série d'images, garder le même décor, la même lumière et le même style d'une image à l'autre (un imagier dont toutes les cartes semblent prises sur le même bureau), ce que le texte seul ne donne pas.

Constat de l'essai réel du 2026-10-13 (5 images, cartable en référence ; n = 2 par condition, un seul sujet de base : indicatif) :
- Avec la 1re image en `input_image`, fond, décor, lumière et style restent identiques entre images. Sans référence, le fond et le décor changent d'une image à l'autre (le bureau disparaît, le mur change).
- La taille et la position du sujet suivent le nouvel objet (plus petit, décentré), pas le cadrage de la base. Ce n'est pas contrôlable.
- Une fausse signature est apparue sur 1 des 3 images par texte seul, sur aucune des 2 images avec référence (trop peu pour conclure).

Décisions de JF : option facultative « garder le même décor », désactivée par défaut, avec la limite sur la taille du sujet affichée honnêtement.

## Hors périmètre

- Choisir une image de l'Historique comme référence (la référence est toujours la 1re image réussie de la série).
- Contrôler la taille ou la position du sujet.
- Chaîner les images (chacune sert de référence à la suivante) : toutes les images partent de la même base.
- Modifier la retouche existante.

## Comportement

Case à cocher dans la section « Série d'images » : « Garder le même décor (la première image sert de référence aux suivantes) », décochée par défaut, avec une aide : « Fond, lumière et style restent identiques. La taille et la position du sujet peuvent changer : un objet peut apparaître plus petit ou décentré. L'image de référence est renvoyée à BFL. ».

Quand la case est cochée :
1. **Référence** : la 1re ligne de la série dans l'ordre du tableau dont l'image est terminée (`etats[i].statut === 'fini'` avec `genId`). Si aucune n'existe, la 1re ligne à créer est générée normalement (texte seul) et devient la référence. Une relance (« Créer les images restantes ») réutilise la référence déjà faite, sans la recréer.
2. **Si la 1re image échoue** (échec, `a_verifier`, non lancée) : le lot s'arrête avec le message « La première image n'a pas abouti : sans elle, les suivantes n'ont pas de référence. » Les lignes restantes passent en `non_lancee`. Aucune image de référence n'est jamais choisie parmi des lignes postérieures.
3. **Colonnes** : seule la colonne « Détails du sujet » reste proposée comme colonne supplémentaire. Les autres (arrière-plan, couleurs, lumière, lieu, atmosphère) contrediraient la référence : elles sont masquées avec une aide « Désactivé avec « même décor » : ce champ viendrait contredire l'image de référence. ». Si des colonnes incompatibles sont déjà choisies quand on coche la case, elles sont retirées (cellules supprimées) après avertissement visible.
4. **Quota** : chaque image du lot compte, y compris la référence, comme aujourd'hui.
5. **Référence indisponible** (image supprimée après 30 jours, ou absente) : l'image de la ligne échoue avec le message existant `source_indisponible` et le lot s'arrête (les suivantes échoueraient pareil).

## Serveur

`POST /api/generate` accepte un champ optionnel `referenceId` (UUID d'une génération de l'utilisateur).

- Sans `referenceId` : comportement actuel inchangé.
- Avec `referenceId` : même contrôles que la retouche (UUID valide, génération de l'utilisateur, `status === 'done'`, `image_path` non nul, sinon `invalid_parent` ou `source_indisponible`). Le gabarit de la ligne est validé comme d'habitude (`normaliserGabarit` + `validerPourGeneration`).
- Prompt envoyé à BFL : `Garde exactement la même composition, le même cadrage, le même fond, le même style et la même lumière. Remplace uniquement le sujet par : {sujet.description}[. Détails : {sujet.details}]. {SUFFIXE_RETOUCHE}` (formulation de l'essai du 2026-10-13, FR puis suffixe anglais déjà utilisé par la retouche). Limite de longueur identique au prompt normal.
- Appel `bfl.edit` avec un lien signé de 300 s vers l'image de référence (comme la retouche). La taille de l'image suit la référence ; pas de graine.
- Enregistrement : `json` = gabarit de la ligne (son propre sujet, pour que « Refaire une image » et l'archive d'un an décrivent la bonne image), `prompt_text` = prompt envoyé, `parent_id` = référence, `edit_instruction` laissé vide (la carte n'affiche donc pas « Retouche : »). Quota, remboursement, une seule génération en cours : inchangés.

## Données et RGPD

L'image de référence est renvoyée à BFL par un lien signé de 300 s, comme pour la retouche. Les règles (version 2026-10-12), le mode d'emploi et le registre mentionnent déjà l'envoi d'image pour la retouche : leurs formulations doivent être étendues à « retouche ou série avec décor commun ». Une hausse de `TERMS_VERSION` redemanderait l'acceptation à tous les comptes : elle ne se fait qu'avec l'accord explicite de JF (décision à prendre au moment de la mise à jour des textes).

## Tests

- Serveur (`generate.test.js`) : `referenceId` valide produit un appel `edit` avec le prompt attendu et enregistre `parent_id`, `json` de la ligne, pas d'`edit_instruction` ; référence d'un autre utilisateur, non terminée, sans image, UUID invalide : refus sans débit de quota ; sans `referenceId` : comportement actuel.
- Lot (`lot.test.js`) : choix de la référence (première ligne terminée, ou première ligne créée), arrêt si la première image échoue, réutilisation de la référence à la relance.
- Interface (`SerieForm.test.jsx`) : case décochée par défaut, aide visible, colonnes incompatibles retirées et masquées quand la case est cochée.
- Essai réel de 2 images avec BFL, uniquement avec l'accord de JF (dépense de crédit).

## Textes à mettre à jour

Mode d'emploi (section série), règles et registre (voir ci-dessus), vignette portail et carte de la landing (une phrase), mémoire du projet.
