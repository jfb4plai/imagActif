# ImagActif : spec de conception

Date : 2026-10-08. Statut : validé section par section avec JF, en attente de relecture du fichier.

## 1. Objectif et public

Outil PLAI pour enseignants FWB : générer des images (illustrations de supports, fiches, albums) à partir d'un **prompt structuré en JSON**, pour pouvoir dupliquer une image réussie, la réutiliser comme modèle et ne changer que certains éléments.

Principes : RGPD d'abord, simplicité d'usage, aucune donnée élève, image présentée comme une proposition à relire (jamais de décision automatique).

Hors périmètre v1 : plusieurs fournisseurs d'images actifs, aide IA à la rédaction du prompt, partage entre enseignants, retouche d'image, références scientifiques (aucune affichée, donc rien à vérifier dans RISS ; tout ajout ultérieur devra l'être).

## 2. Décisions validées

| Sujet | Décision |
|---|---|
| Public | Enseignants FWB, branding PLAI, nom ImagActif, `imagactif.jfb4plai.com`, repo `jfb4plai/ImagActif`, branche `main` |
| Fournisseur | BFL (FLUX) seul en v1, endpoint UE `api.eu.bfl.ai`, appels isolés dans un seul fichier pour en ajouter d'autres plus tard |
| JSON | Hybride, v1 centrée sur le gabarit à champs fixes ; JSON = source de vérité ; champs personnalisés ; import/export |
| Coût | Essai de 3 jours sur la clé BFL de JF avec quota ; ensuite clé BFL personnelle de l'enseignant |
| Clé personnelle | Chiffrée côté serveur (AES-256-GCM), jamais renvoyée au navigateur |
| Conservation | Image supprimée à 30 jours ; JSON conservé jusqu'à suppression par l'enseignant |
| Information | Garantie de l'information de l'utilisateur (voir 6) |
| Architecture | React 18 + Vite 5 + Tailwind v3, fonctions Vercel `/api/*`, Supabase partagé (auth, base, stockage) |

## 3. Architecture et flux de génération

1. Le navigateur envoie le JSON à `/api/generate` avec le jeton de session.
2. Le serveur vérifie le jeton, l'acceptation des règles en vigueur, puis le régime :
   - **essai** (moins de 3 jours après l'inscription, e-mail vérifié) : clé de JF, quota par compte (10 images/jour) et disjoncteur global (100 images/jour). Les deux seuils sont des variables d'environnement.
   - **clé personnelle** : clé déchiffrée en mémoire pour l'appel uniquement.
   - sinon : refus avec message clair (historique et export restent accessibles).
3. `composePrompt(json)` (fonction pure, côté serveur) produit le texte envoyé à FLUX.
4. Appel à BFL via `providers/bfl.js` (`submit()`, `poll()`). Le serveur répond immédiatement avec un identifiant ; le navigateur interroge `/api/status?id=` ; chaque interrogation suit exactement le `polling_url` renvoyé par BFL (ne jamais reconstruire l'hôte).
5. À la fin, le serveur télécharge l'image sans attendre (lien BFL éphémère), la dépose dans le bucket privé et met à jour la ligne.
6. Une seule génération en cours par compte.

Modèle FLUX : défini par variable d'environnement, choisi à la lecture de la documentation BFL au moment du plan.

Fonctions Vercel fixées sur une région UE. Test des fonctions avec `vercel dev`, pas `vite dev`.

## 4. Données

Toutes les tables sont préfixées `img_`, avec RLS (`auth.uid() = user_id`) et `GRANT` explicites dans la même migration. Vérifier l'absence de conflit de noms avant `create table` (grep sur les `.sql` du workspace). `profiles` et le trigger `updated_at` existent déjà : ne pas les recréer.

- `img_accounts` : `user_id`, `trial_started_at`, `terms_version`, `terms_accepted_at`, `has_own_key` (booléen lisible par le client, car `img_user_keys` est illisible côté client).
- `img_generations` : `id`, `user_id`, `json` (jsonb), `prompt_text`, `seed`, `model`, `status` (`pending|done|failed|refused`), `image_path`, `image_expires_at`, `image_deleted_at`, `parent_id`, `created_at`.
- `img_templates` : `id`, `user_id`, `name`, `json`, `locked_fields` (text[]).
- `img_user_keys` : `user_id`, `ciphertext`, `iv`, `secret_version`. **Aucun GRANT pour `anon` ni `authenticated`** : accès réservé à `service_role` (fonctions serveur).
- `img_usage` : `user_id`, `day`, `count`. Écriture par le serveur uniquement.

Stockage : bucket privé, chemins `userId/generationId.png`, liens signés de quelques minutes.

Suppression à 30 jours : tâche planifiée Vercel quotidienne appelant `/api/cleanup` (secret requis). Elle supprime les fichiers via l'API de stockage (pas par SQL, qui laisse des fichiers orphelins) puis renseigne `image_deleted_at`. Le JSON reste.

Suppression « du compte » : suppression de toutes les données ImagActif (lignes, fichiers, clé). L'identifiant de connexion est partagé entre les apps PLAI et n'est pas supprimé. La ligne `img_accounts` est conservée, sans règles acceptées ni clé : seuls la date de début d'essai et le compteur d'images du jour (`img_usage`) sont conservés, pour empêcher de renouveler l'essai gratuit ou de remettre le quota à zéro.
La suppression d'une image passe par `DELETE /api/generation` (le fichier est supprimé avant la ligne).

## 5. Gabarit JSON (v1 initial, v2 depuis le 2026-10-08) et écrans

> Mise à jour 2026-10-08 : le gabarit est passé en v2 (éléments, couleurs, composition avancée, éclairage, décor, atmosphère, textes présents, rendu, mouvement, tous facultatifs, dans un bloc « Détails avancés » replié). Un JSON v1 s’ouvre sans perte. Prompt limité à 4 000 caractères. Spécification complète : `docs/superpowers/plans/2026-10-08-gabarit-v2.md`. Le schéma ci-dessous est celui de la v1, conservé comme noyau de la v2.

```json
{
  "schema_version": 1,
  "sujet": { "description": "", "details": "" },
  "style": { "type": "", "palette": "" },
  "composition": { "cadrage": "", "point_de_vue": "", "arriere_plan": "" },
  "lumiere": "",
  "exclusions": ["pas de texte dans l'image"],
  "format": { "ratio": "1:1" },
  "generation": { "seed": null },
  "personnalise": [ { "nom": "", "valeur": "" } ]
}
```

- Exclusion par défaut « pas de texte dans l'image » (les modèles écrivent mal ; une faute sur un support pour élèves DYS est pire qu'une absence de texte).
- Guidage par champ : label précis, placeholder avec exemple FWB réel, aide sous le champ sur l'effet de la saisie. Sous « sujet » : ne jamais décrire un élève réel ni citer un nom.
- `personnalise` : ajouté au prompt tel quel, dans l'ordre.
- Import d'un JSON collé : validation par schéma, clés inconnues versées dans `personnalise`, rien d'exécuté.
- Modèle = JSON + `locked_fields`. À l'utilisation, champs verrouillés grisés.
- Variante = copie du JSON (même graine optionnelle), `parent_id` renseigné.
- Régénération d'une image supprimée = même JSON, même graine.

Écrans (branding PLAI : teal #0f6e56, orange #f97316, DM Sans / DM Serif Display, logo `/plai-logo.jpg` à hauteur fixe sans déformer ; texte 16 px minimum) :
1. Connexion et règles (case à cocher explicite).
2. Créer : formulaire à gauche, résultat à droite ; bandeau « Essai : encore 2 jours, 7 images aujourd'hui » puis état de la clé BFL.
3. Historique : cartes avec vignette, compte à rebours, Télécharger, Variante, Enregistrer comme modèle, Copier le JSON ; carte sans image : « image supprimée le … » + Régénérer.
4. Modèles : liste, Utiliser, Modifier les champs verrouillés.
5. Mes données : guide pas à pas pour obtenir une clé BFL, ajout/suppression de la clé, export complet (JSON + images encore disponibles), suppression du compte.

Chaque image porte la mention « image générée par IA, à relire avant usage en classe ».

## 6. Garantie d'information sur la conservation

- Inscription (résumé) et première connexion (acceptation obligatoire) : règles en clair (30 jours pour les images, durée du JSON, BFL sous-traitant en UE, quota d'essai), case à cocher obligatoire ; version et date d'acceptation enregistrées. Si les règles changent, nouvelle acceptation requise avant de générer.
- Chaque carte : compte à rebours « supprimée dans N jours », orange à J-5.
- Bouton Télécharger toujours visible à côté du compte à rebours.
- Après suppression : mention datée et bouton Régénérer.
- Texte permanent dans « Mes données » rappelant les durées.

## 7. Erreurs

- Refus de modération BFL : message clair, invitation à reformuler, quota non décompté.
- Échec ou délai dépassé côté BFL : quota non décompté.
- Clé personnelle invalide ou crédits BFL épuisés : messages distincts, lien vers le guide.
- Disjoncteur global atteint : « essai momentanément indisponible, réessayez demain ou ajoutez votre clé ».
- Double clic : bloqué par la règle d'une génération en cours.

## 8. Sécurité

- Jeton vérifié côté serveur à chaque appel.
- AES-256-GCM, IV unique, numéro de version du secret (rotation possible).
- Journaux serveur sans prompt ni clé.
- `/api/cleanup` protégé par secret ; liens signés à courte durée.
- Aucune clé dans le frontend ni dans un `console.log`. Secrets uniquement dans les variables Vercel (poser avec `printf`, pas `echo`, puis vérifier avec `env pull`).
- E-mail vérifié obligatoire pour l'essai ; plafond global journalier.

## 9. RGPD

- Minimisation : e-mail, JSON, images. Aucun outil de mesure tiers, aucun cookie de suivi.
- Polices DM Sans et DM Serif Display **hébergées dans l'app** (pas de Google Fonts).
- Droits : accès et portabilité (export), effacement (suppression du compte).
- Sous-traitants : BFL (endpoint UE), Supabase, Vercel.
- Actions préalables à la mise en ligne, pour JF : (a) vérifier la région du projet Supabase partagé `dfoaumjleqtxjeaplnna` ; si hors UE, trancher avant le plan ; (b) demander le DPA de BFL et la durée de conservation des prompts et images chez BFL (non vérifiée à ce jour : la page d'aide BFL décrit l'endpoint UE comme conforme RGPD, ce n'est pas un contrat) ; (c) inscrire le traitement au registre ; (d) aligner la sauvegarde Supabase planifiée : exclure le stockage d'images ou limiter sa rétention à 30 jours.
- Autre fournisseur ultérieur (ex. Gemini) : ne pas l'ajouter avant lecture des conditions actuelles (usage des données de l'offre gratuite, clause EEE non tranchée à ce jour).

## 10. Tests

- Unitaires : `composePrompt`, validation de schéma, chiffrement (aller-retour), quota, dates d'expiration (horloge simulée), import JSON.
- RLS en transaction annulée : un compte ne lit ni les lignes, ni les images, ni la clé d'un autre ; `anon` et `authenticated` ne peuvent pas lire `img_user_keys`.
- Bout en bout avec BFL simulé ; un seul essai réel en `vercel dev` avant mise en ligne.
- `npx vite build` sans erreur avant tout `git push` sur `main`.
- Vérification visuelle du branding (nav, container, footer, logo non déformé) et parcours complet en navigateur, y compris inscription, connexion et réinitialisation du mot de passe.

## 11. Après le build

Checklist PLAI : RLS actif partout, aucune clé exposée, mode d'emploi HTML PLAI (autonome, `plai-style.css`), vignette dans `portail-plai/src/data/apps.ts` (repo et déploiement séparés), puis audit (sécurité, fiabilité, UX).
