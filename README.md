# ImagActif

Génération d'images pour enseignants FWB (outil PLAI) : gabarit JSON réutilisable, historique 30 jours pour les images, JSON conservé.

Spec : docs/superpowers/specs/2026-10-08-imagactif-design.md
Plan : docs/superpowers/plans/2026-10-08-imagactif-plan.md

Développement : `vercel dev` (pas `vite` seul : il ne sert pas `/api/*`). Tests : `npm test`.

## Essai réel BFL du 2026-10-08

- Endpoint UE `api.eu.bfl.ai`, chemin `flux-2-pro` et paramètre `seed` : acceptés. Domaine de suivi observé : `api.eu2.bfl.ai` (couvert par la garde `*.bfl.ai`). Type de contenu : `image/jpeg`.
- Graine : une même graine avec le même prompt ne redonne PAS la même image (octets différents ; en regardant, même sujet et même style, mais cadrage et décor différents). L'aide du champ « Graine » le dit.
- « À éviter : pas de texte dans l'image » n'est pas toujours respecté : deux aquarelles sur deux portaient une fausse signature manuscrite. L'aide du champ « À éviter » le dit.
