/* Alerte anti-phishing : une page qui demande un mot de passe en se faisant passer pour une marque connue
 * (Google, PayPal, ta banque…) alors que l'adresse n'est pas la sienne.
 * 1. Règles locales (marque citée, adresse qui ne lui appartient pas, adresse piégée) ;
 * 2. dans les cas douteux, l'IA locale donne son avis (le contenu de la page reste une donnée, jamais une instruction).
 * Rien n'est envoyé sur Internet. L'utilisateur peut désactiver l'alerte pour un site. */

export interface Marque {
  nom: string
  /** Noms de domaine officiels (le site et ses sous-domaines). */
  domaines: string[]
  motif: RegExp
}

export const MARQUES: Marque[] = [
  { nom: 'Google', domaines: ['google.com', 'google.fr', 'gmail.com', 'youtube.com'], motif: /\b(google|gmail)\b/i },
  { nom: 'Microsoft', domaines: ['microsoft.com', 'live.com', 'microsoftonline.com', 'office.com', 'outlook.com', 'xbox.com', 'bing.com'], motif: /\b(microsoft|outlook|office\s?365|hotmail|xbox)\b/i },
  { nom: 'Apple', domaines: ['apple.com', 'icloud.com'], motif: /\b(apple\s?id|icloud)\b/i },
  { nom: 'PayPal', domaines: ['paypal.com', 'paypal.fr'], motif: /\bpaypal\b/i },
  { nom: 'Amazon', domaines: ['amazon.fr', 'amazon.com', 'amazon.de', 'amazon.co.uk'], motif: /\bamazon\b/i },
  { nom: 'Facebook', domaines: ['facebook.com', 'meta.com', 'messenger.com'], motif: /\bfacebook\b/i },
  { nom: 'Instagram', domaines: ['instagram.com'], motif: /\binstagram\b/i },
  { nom: 'Netflix', domaines: ['netflix.com'], motif: /\bnetflix\b/i },
  { nom: 'Steam', domaines: ['steampowered.com', 'steamcommunity.com'], motif: /\bsteam\b/i },
  { nom: 'Discord', domaines: ['discord.com', 'discord.gg'], motif: /\bdiscord\b/i },
  { nom: 'Epic Games', domaines: ['epicgames.com'], motif: /\bepic\s?games\b/i },
  { nom: 'Roblox', domaines: ['roblox.com'], motif: /\broblox\b/i },
  { nom: 'Twitch', domaines: ['twitch.tv'], motif: /\btwitch\b/i },
  { nom: 'La Banque Postale', domaines: ['labanquepostale.fr'], motif: /\bbanque postale\b/i },
  { nom: 'Crédit Agricole', domaines: ['credit-agricole.fr', 'ca-paris.fr'], motif: /\bcr[ée]dit agricole\b/i },
  { nom: 'BNP Paribas', domaines: ['bnpparibas', 'mabanque.bnpparibas'], motif: /\bbnp\b/i },
  { nom: 'Société Générale', domaines: ['societegenerale.fr', 'sg.fr'], motif: /\bsoci[ée]t[ée] g[ée]n[ée]rale\b/i },
  { nom: 'Ameli', domaines: ['ameli.fr'], motif: /\bameli\b/i },
  { nom: 'Impots.gouv', domaines: ['impots.gouv.fr', 'gouv.fr'], motif: /\bimpots?\.gouv\b/i },
  { nom: 'La Poste / Colissimo', domaines: ['laposte.fr', 'colissimo.fr', 'chronopost.fr'], motif: /\b(colissimo|chronopost)\b/i }
]

export interface PageAVerifier {
  url: string
  titre: string
  texte: string
  motDePasse: boolean
}

export interface Verdict {
  niveau: 'aucun' | 'douteux' | 'fort'
  marque?: string
  message?: string
}

const appartient = (hote: string, domaine: string): boolean => hote === domaine || hote.endsWith(`.${domaine}`)
const sansAccents = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Règles locales, sans IA. */
export function analyserPage(p: PageAVerifier): Verdict {
  if (!p.motDePasse) return { niveau: 'aucun' }
  let u: URL
  try {
    u = new URL(p.url)
  } catch {
    return { niveau: 'aucun' }
  }
  const hote = u.hostname.toLowerCase()
  // adresses piégées : nom en caractères trompeurs, adresse IP, faux identifiant avant « @ »
  if (hote.split('.').some((x) => x.startsWith('xn--')))
    return { niveau: 'fort', message: `L'adresse ${hote} utilise des caractères qui imitent d'autres lettres, une ruse fréquente des faux sites.` }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hote) || hote.startsWith('['))
    return { niveau: 'fort', message: `Cette page demande un mot de passe sur une adresse IP (${hote}) au lieu d'un nom de site : c'est inhabituel pour un vrai site.` }
  if (u.username) return { niveau: 'fort', message: "L'adresse contient un faux identifiant avant « @ » pour tromper l'œil." }

  // « Se connecter avec Google », « Sign in with Apple », « Payer avec PayPal » : le site utilise la marque, il ne s'en déguise pas
  const sansConnexionTierce = (t: string): string => t.replace(/\b(avec|with|via|par)\s+(votre compte\s+|ton compte\s+)?[\p{L}.-]{2,20}/giu, ' ')
  const titre = sansConnexionTierce(p.titre)
  const texte = sansConnexionTierce(p.texte.slice(0, 3000))
  for (const m of MARQUES) {
    // la page se présente comme la marque : dans son titre, ou plusieurs fois dans son texte
    const toutes = new RegExp(m.motif.source, 'gi')
    if (!m.motif.test(titre) && (texte.match(toutes)?.length ?? 0) < 2) continue
    if (m.domaines.some((d) => (d.includes('.') ? appartient(hote, d) : hote.split('.').includes(d)))) return { niveau: 'aucun' }
    const nomCompact = sansAccents(m.nom).replace(/[^a-z]/g, '')
    // la marque est dans l'adresse, mais ce n'est pas son domaine (paypal-securite-login.com)
    if (sansAccents(hote).replace(/[^a-z]/g, '').includes(nomCompact.slice(0, 6)))
      return {
        niveau: 'fort',
        marque: m.nom,
        message: `Cette page se présente comme ${m.nom}, mais l'adresse ${hote} n'appartient pas à ${m.nom}. Ne tape pas ton mot de passe.`
      }
    return {
      niveau: 'douteux',
      marque: m.nom,
      message: `Cette page parle de ${m.nom} et demande un mot de passe, mais l'adresse ${hote} n'appartient pas à ${m.nom}. Vérifie bien avant de te connecter.`
    }
  }
  const local = hote === 'localhost' || hote.endsWith('.localhost') || hote.startsWith('127.')
  if (u.protocol === 'http:' && !local) return { niveau: 'fort', message: `Cette page demande un mot de passe sans connexion chiffrée (http) : il pourrait être intercepté.` }
  return { niveau: 'aucun' }
}
