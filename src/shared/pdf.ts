/* PDF : adresses de la visionneuse, partagées entre le main et l'interface. */

/** Protocole interne de la visionneuse : se7en-pdf://app/ sert la visionneuse, se7en-pdf://app/doc/<id> le fichier PDF. */
export const PROTOCOLE_PDF = 'se7en-pdf'
export const URL_VISIONNEUSE = `${PROTOCOLE_PDF}://app/pdf.html`

export function urlVisionneuse(idDoc: string, nom = ''): string {
  return `${URL_VISIONNEUSE}?doc=${encodeURIComponent(idDoc)}&nom=${encodeURIComponent(nom)}`
}

/** Identifiant du document affiché par cette adresse de visionneuse, ou null. */
export function idDocDeVisionneuse(url: string): string | null {
  if (!url.startsWith(URL_VISIONNEUSE)) return null
  try {
    return new URL(url).searchParams.get('doc')
  } catch {
    return null
  }
}

export const RE_ID_DOC = /^[0-9a-f-]{36}$/
