import { describe, expect, it } from 'vitest'
import { lireFavorisExportes } from '../src/shared/importFavoris'

const EXPORT_CHROME = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" PERSONAL_TOOLBAR_FOLDER="true">Barre de favoris</H3>
    <DL><p>
        <DT><A HREF="https://www.youtube.com/" ADD_DATE="1700000100" ICON="data:image/png;base64,iVBORw0KGgo=">YouTube</A>
        <DT><A HREF="https://fr.wikipedia.org/wiki/Verre" ADD_DATE="1700000200">Verre &amp; vitraux &#8212; Wikipédia</A>
        <DT><A HREF="javascript:alert(1)" ADD_DATE="1700000300">Piège</A>
        <DT><A HREF="file:///C:/secret.txt">Fichier</A>
        <DT><A HREF="https://www.youtube.com/">YouTube (doublon)</A>
    </DL><p>
</DL><p>`

describe('import de favoris', () => {
  it('lit un export Chrome / Edge / Firefox', () => {
    const f = lireFavorisExportes(EXPORT_CHROME)
    expect(f.map((x) => x.url)).toEqual(['https://www.youtube.com/', 'https://fr.wikipedia.org/wiki/Verre'])
    expect(f[1].titre).toBe('Verre & vitraux — Wikipédia')
    expect(f[0].favicon).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(f[0].date).toBe(1700000100 * 1000)
  })

  it('ignore ce qui n’est pas une adresse web', () => {
    expect(lireFavorisExportes('<a href="chrome://settings">x</a><a href="data:text/html,x">y</a>')).toEqual([])
  })
})
