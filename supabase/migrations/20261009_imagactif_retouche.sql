-- ImagActif : « Retoucher cette image » (consigne de retouche conservée sur la génération).
-- À exécuter par JF dans le SQL Editor du projet partagé AVANT le déploiement du code. Idempotent.
-- Aucun nouveau droit : les droits select de authenticated couvrent la nouvelle colonne.

alter table img_generations add column if not exists edit_instruction text;
