/**
 * Destination du bouton de réservation du SITE PUBLIC Active Games.
 *
 * 23/09/2026 — Décision de Shimi, autorisée par Jeremy : un seul agenda pour
 * les deux enseignes (Laser City + Active Games). Le client doit pouvoir
 * réserver laser ou active au même endroit, depuis l'un ou l'autre site.
 * Le bouton pointe donc vers l'agenda Tor4U partagé.
 *
 * ⚠️ Le tunnel de réservation interne d'Active Games (/reservation) n'est PAS
 * supprimé : la page et tout son code restent en place et fonctionnels. Seul
 * le lien est débranché.
 *
 * POUR REBRANCHER la réservation Active Games — une seule ligne à changer :
 *     export const BOOKING_URL = '/reservation'
 */
export const BOOKING_URL =
  'https://www.tor4you.co.il/edstn.asp?siteid=16437&sid=A1BB1506B39E2EDB'

/** Vrai tant que BOOKING_URL sort du site (permet de gérer le lien externe). */
export const BOOKING_IS_EXTERNAL = /^https?:\/\//.test(BOOKING_URL)
