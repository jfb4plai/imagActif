export const MESSAGES = {
  terms: "Acceptez d'abord les règles d'utilisation.",
  email_unconfirmed: 'Confirmez votre adresse e-mail avant de générer des images.',
  trial_over: "L'essai de 3 jours est terminé. Ajoutez votre clé BFL dans « Mes données » pour continuer.",
  quota_user: "Limite de l'essai atteinte pour aujourd'hui. Réessayez demain ou ajoutez votre clé BFL.",
  quota_global: "L'essai est momentanément indisponible. Réessayez demain ou ajoutez votre clé BFL.",
  busy: 'Une image est déjà en cours de création. Attendez qu\'elle soit terminée.',
  invalid_key: 'Votre clé BFL est refusée. Vérifiez-la ou ajoutez-en une nouvelle dans « Mes données ».',
  no_credits: "Votre compte BFL n'a plus de crédits. Rechargez-le sur le site de BFL.",
  rate_limited: 'BFL reçoit trop de demandes. Réessayez dans une minute.',
  key_unreadable: "Votre clé n'a pas pu être lue. Ajoutez-la à nouveau dans « Mes données ».",
  moderated: "BFL a refusé ce contenu. Reformulez la description. Cette tentative n'est pas décomptée de votre quota d'essai.",
  failed: "La génération a échoué chez BFL. Réessayez. Cette tentative n'est pas décomptée de votre quota d'essai.",
  timeout: "La génération prend plus de temps que prévu. Elle apparaîtra dans l'historique si elle aboutit.",
  provider_error: 'Le service d\'images ne répond pas correctement. Réessayez plus tard.',
  invalid_json: 'Le contenu envoyé est invalide.',
  invalid_parent: "L'image d'origine est introuvable.",
}

export function messageErreur(code, repli = 'Une erreur est survenue. Réessayez.') {
  return MESSAGES[code] ?? repli
}
