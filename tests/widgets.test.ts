import { describe, expect, it } from 'vitest'
import { fusionnerReglages, REGLAGES_DEFAUT } from '../src/shared/reglages'
import { devinerTransporteur, fixerRef, grossir, lienSuivi, lireFlux, nouveauWidget, numeroColis, placement, validerWidgets, WIDGETS_DEFAUT } from '../src/shared/widgets'

describe('grossir ou étirer un widget', () => {
  it('grossir agrandit le contenu et le cadre ensemble, rapetisser revient en arrière', () => {
    const w = nouveauWidget('meteo', [], 'm')
    const gros = grossir(w, 1)
    expect(gros.zoom).toBe(1.15)
    expect(gros.l).toBe(Math.round(w.l * 1.15))
    expect(gros.h).toBe(Math.round(w.h * 1.15))
    const retour = grossir(gros, -1)
    expect(retour.zoom).toBeUndefined()
    expect(retour.l).toBe(w.l)
  })

  it('garde le grossissement entre ×0,6 et ×3', () => {
    let w = nouveauWidget('meteo', [], 'm')
    for (let i = 0; i < 30; i++) w = grossir(w, 1)
    expect(w.zoom).toBe(3)
    expect(validerWidgets([{ ...w, zoom: 99 }])![0].zoom).toBe(3)
    expect(validerWidgets([{ ...w, zoom: 1 }])![0].zoom).toBeUndefined()
  })
})

describe('widgets du Nouvel onglet', () => {
  it('pose Amis et Météo par défaut', () => {
    expect(REGLAGES_DEFAUT.widgets).toEqual(WIDGETS_DEFAUT)
  })

  it('écarte les widgets invalides et borne les valeurs', () => {
    const r = validerWidgets([
      {
        id: 'a',
        type: 'meteo',
        x: 2,
        y: -1,
        l: 50,
        h: 99999,
        ville: { nom: 'Lyon', detail: 'France', lat: 45.7, lon: 4.8 }
      },
      { id: 'a', type: 'sorties', x: 0, y: 0, l: 200, h: 200 },
      { id: 'B!', type: 'sorties', x: 0, y: 0, l: 200, h: 200 },
      { id: 'c', type: 'notes', x: 0, y: 0, l: 200, h: 200 },
      { id: 'd', type: 'sport', x: 0.5, y: 0.5, l: 300, h: NaN },
      {
        id: 'e',
        type: 'sport',
        x: 0.5,
        y: 0.5,
        l: 300,
        h: 300,
        equipes: [
          { id: '133714', nom: 'Paris SG', ligue: 'Ligue 1' },
          { id: 'x', nom: 'Faux', ligue: '' }
        ]
      },
      {
        id: 'f',
        type: 'colis',
        x: 0,
        y: 0,
        l: 300,
        h: 300,
        colis: [
          { numero: '6A12345678901', nom: 'Casque', transporteur: 'laposte' },
          { numero: 'a b', nom: '', transporteur: 'laposte' }
        ]
      },
      {
        id: 'g',
        type: 'actualites',
        x: 0,
        y: 0,
        l: 300,
        h: 300,
        source: 'inconnue'
      },
      {
        id: 'h',
        type: 'meteo',
        x: 0,
        y: 0,
        l: 300,
        h: 300,
        ville: { nom: 'Nulle part', detail: '', lat: 999, lon: 0 }
      }
    ])!
    expect(r.map((w) => w.id)).toEqual(['a', 'e', 'f', 'g', 'h'])
    expect(r[0]).toMatchObject({
      x: 1,
      y: 0,
      l: 180,
      h: 1200,
      ville: { nom: 'Lyon' }
    })
    expect(r[1].equipes).toEqual([{ id: '133714', nom: 'Paris SG', ligue: 'Ligue 1' }])
    expect(r[2].colis).toHaveLength(1)
    expect(r[3].source).toBe('franceinfo')
    expect(r[4].ville).toBeUndefined()
  })

  it('ne remplace la disposition que si elle est valide', () => {
    expect(fusionnerReglages(REGLAGES_DEFAUT, { widgets: 'non' }).widgets).toEqual(WIDGETS_DEFAUT)
    expect(fusionnerReglages(REGLAGES_DEFAUT, { widgets: [] }).widgets).toEqual([])
  })

  it('suit la taille de la fenêtre en proportion, et reste entièrement visible', () => {
    const w = { ...nouveauWidget('meteo', [], 'n'), x: 0.9, y: 0.9, l: 400, h: 300, ref: [1000, 800] as [number, number] }
    expect(placement(w, 1000, 800)).toEqual({ left: 600, top: 500, width: 400, height: 300, echelle: 1 })
    // fenêtre deux fois plus petite : widget et contenu deux fois plus petits, collés au bord
    expect(placement(w, 500, 400)).toEqual({ left: 300, top: 250, width: 200, height: 150, echelle: 0.5 })
    // grossi avec + : le contenu garde son grossissement en plus
    expect(placement({ ...w, zoom: 1.5 }, 500, 400).echelle).toBe(0.75)
  })

  it('donne une taille de référence sans changer l’apparence', () => {
    const w = { ...nouveauWidget('meteo', [], 'n'), l: 300, h: 300 }
    // sans référence, pensé pour ~1500 × 850 : dans une page de 750 × 850, moitié moins grand
    expect(placement(w, 750, 850).width).toBe(150)
    const fixe = fixerRef(w, 750, 850)
    expect(fixe).toMatchObject({ l: 150, h: 150, zoom: 0.6, ref: [750, 850] })
    expect(placement(fixe, 750, 850).width).toBe(150)
  })
})

describe('suivi de colis', () => {
  it('nettoie le numéro et devine le transporteur', () => {
    expect(numeroColis(' 1z 999-aa1 0123456784 ')).toBe('1Z999AA10123456784')
    expect(devinerTransporteur('1Z999AA10123456784')).toBe('ups')
    expect(devinerTransporteur('LA123456789FR')).toBe('laposte')
    expect(devinerTransporteur('XY123456789FR')).toBe('chronopost')
    expect(devinerTransporteur('6A12345678901')).toBe('laposte')
    expect(devinerTransporteur('1234567890')).toBe('dhl')
    expect(devinerTransporteur('12345678')).toBe('mondialrelay')
  })

  it('ouvre la page de suivi officielle du transporteur', () => {
    expect(lienSuivi({ numero: '6A12345678901', nom: '', transporteur: 'laposte' })).toBe('https://www.laposte.fr/outils/suivre-vos-envois?code=6A12345678901')
    expect(lienSuivi({ numero: '1Z999AA10123456784', nom: '', transporteur: 'ups' })).toBe('https://www.ups.com/track?loc=fr_FR&tracknum=1Z999AA10123456784')
  })
})

describe('flux RSS', () => {
  it('lit titres, liens et dates (RSS et Atom), et ignore le reste', () => {
    const rss = `<rss><channel><title>Journal</title>
      <item><title><![CDATA[Grève : ce qu'il faut savoir]]></title><link>https://exemple.fr/a?x=1&amp;y=2</link><pubDate>Tue, 03 Nov 2026 06:00:00 GMT</pubDate></item>
      <item><title>Sans lien</title><link>javascript:alert(1)</link></item>
      <item><title>L&#039;Équipe &amp; co</title><link>https://exemple.fr/b</link></item>
    </channel></rss>`
    expect(lireFlux(rss)).toEqual([
      {
        titre: "Grève : ce qu'il faut savoir",
        lien: 'https://exemple.fr/a?x=1&y=2',
        date: Date.parse('2026-11-03T06:00:00Z')
      },
      { titre: "L'Équipe & co", lien: 'https://exemple.fr/b', date: 0 }
    ])
    const atom = `<feed><entry><title>Atome</title><link href="https://exemple.fr/c"/><updated>2026-11-02T10:00:00Z</updated></entry></feed>`
    expect(lireFlux(atom)).toEqual([
      {
        titre: 'Atome',
        lien: 'https://exemple.fr/c',
        date: Date.parse('2026-11-02T10:00:00Z')
      }
    ])
  })
})
