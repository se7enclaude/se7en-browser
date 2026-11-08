import { describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import {
  aVerifier,
  cheminModele,
  comparerManifestes,
  comparerVersions,
  dateFr,
  INTERVALLE_VERIFICATION,
  lireUpdatecheck,
  plusRecenteQue,
  signalerUneFois,
  texteExtension,
  texteModele,
  texteOllama,
  urlUpdatecheck,
  versionDeSortieOllama,
  versionDeTag
} from '../src/shared/composants'
import { listesPerimees, renouvelerMoteur, RENOUVELLEMENT_LISTES } from '../src/main/bloqueur/renouvellement'

describe('comparaison de versions', () => {
  it('compare nombre par nombre, avec ou sans « v »', () => {
    expect(comparerVersions('0.40.15', 'v0.40.15')).toBe(0)
    expect(comparerVersions('0.40.15', '0.40.9')).toBeGreaterThan(0)
    expect(comparerVersions('0.9.0', '0.10.0')).toBeLessThan(0)
    expect(comparerVersions('4.9.135', '4.9.135.0')).toBe(0)
    expect(comparerVersions('6.1.6', '6.1.5.2')).toBeGreaterThan(0)
  })
  it('une préversion passe avant la version finale', () => {
    expect(comparerVersions('0.13.0-rc1', '0.13.0')).toBeLessThan(0)
    expect(comparerVersions('0.13.0-rc10', '0.13.0-rc2')).toBeGreaterThan(0)
    expect(plusRecenteQue('0.13.0', '0.13.0-rc1')).toBe(true)
  })
  it('plusRecenteQue refuse les versions inconnues', () => {
    expect(plusRecenteQue(null, '1.0')).toBe(false)
    expect(plusRecenteQue('1.0', null)).toBe(false)
    expect(plusRecenteQue('1.0.0', '1.0.0')).toBe(false)
  })
  it('lit le tag GitHub et la sortie de « ollama --version »', () => {
    expect(versionDeTag('v0.40.15')).toBe('0.40.15')
    expect(versionDeTag('nightly')).toBeNull()
    expect(versionDeTag(42)).toBeNull()
    expect(versionDeSortieOllama('ollama version is 0.12.3')).toBe('0.12.3')
    expect(versionDeSortieOllama('Warning: could not connect to a running Ollama instance\nWarning: client version is 0.40.1')).toBe('0.40.1')
    expect(versionDeSortieOllama('rien')).toBeNull()
  })
})

describe('fréquence des vérifications', () => {
  it('au plus toutes les 12 heures', () => {
    const t = 1_800_000_000_000
    expect(aVerifier(null, t)).toBe(true)
    expect(aVerifier(t - 3600_000, t)).toBe(false)
    expect(aVerifier(t - INTERVALLE_VERIFICATION, t)).toBe(true)
    expect(aVerifier(t + 3600_000, t)).toBe(true) // horloge reculée
  })
  it('une nouveauté n’est signalée qu’une fois par version', () => {
    const deja: string[] = []
    expect(signalerUneFois(deja, 'ollama:0.41.0')).toBe(true)
    expect(signalerUneFois(deja, 'ollama:0.41.0')).toBe(false)
    expect(signalerUneFois(deja, 'ollama:0.42.0')).toBe(true)
  })
})

describe('réponse updatecheck du Chrome Web Store', () => {
  const XML =
    '<?xml version="1.0" encoding="UTF-8"?><gupdate xmlns="http://www.google.com/update2/response" protocol="2.0" server="prod"><daystart elapsed_days="7251" elapsed_seconds="55933"/>' +
    '<app appid="eimadpbcbfnmbkopoojfekhnkhdbieeh" cohort="1::" cohortname="" status="ok"><updatecheck _esbAllowlist="true" codebase="https://clients2.googleusercontent.com/crx/blobs/x/EIMAD_4_9_135_0.crx" fp="1.0b78" hash_sha256="0b78" protected="0" size="858730" status="ok" version="4.9.135"/></app>' +
    '<app appid="mnjggcdmjocbbbhaepdhchncahnbgone" status="ok"><updatecheck status="noupdate"/></app>' +
    '<app appid="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" status="error-unknownApplication"/>' +
    '</gupdate>'
  it('donne la version publiée de chaque extension', () => {
    const r = lireUpdatecheck(XML)
    expect(r.eimadpbcbfnmbkopoojfekhnkhdbieeh).toEqual({ version: '4.9.135', statut: 'ok' })
    expect(r.mnjggcdmjocbbbhaepdhchncahnbgone).toEqual({ version: null, statut: 'noupdate' })
    expect(r.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa).toEqual({ version: null, statut: 'error-unknownApplication' })
  })
  it('ignore une réponse vide ou abîmée', () => {
    expect(lireUpdatecheck('')).toEqual({})
    expect(lireUpdatecheck('<html>erreur</html>')).toEqual({})
    expect(lireUpdatecheck('<app appid="pas-un-id"><updatecheck version="1.0"/></app>')).toEqual({})
  })
  it('une seule requête pour toutes les extensions', () => {
    const u = new URL(urlUpdatecheck(['eimadpbcbfnmbkopoojfekhnkhdbieeh', 'mnjggcdmjocbbbhaepdhchncahnbgone'], '140.0.7339.0'))
    expect(u.hostname).toBe('clients2.google.com')
    expect(u.searchParams.get('response')).toBe('updatecheck')
    expect(u.searchParams.getAll('x')).toEqual(['id=eimadpbcbfnmbkopoojfekhnkhdbieeh&v=0.0.0.0&uc', 'id=mnjggcdmjocbbbhaepdhchncahnbgone&v=0.0.0.0&uc'])
  })
  it('texte affiché', () => {
    expect(texteExtension('4.9.130', { disponible: '4.9.135', verifie: Date.now() })).toMatchObject({ etat: 'mise-a-jour', texte: 'Mise à jour disponible : 4.9.130 → 4.9.135' })
    expect(texteExtension('4.9.135', { disponible: '4.9.135', verifie: Date.now() }).texte).toMatch(/^À jour \(version 4\.9\.135, vérifié le /)
    expect(texteExtension('1.0', undefined).etat).toBe('inconnu')
  })
})

describe('modèles Ollama', () => {
  const sha = (t: string): string => createHash('sha256').update(t).digest('hex')
  const couches = (extra = ''): string =>
    `[{"mediaType":"application/vnd.ollama.image.model","digest":"sha256:a3de","size":5}${extra},{"mediaType":"application/vnd.ollama.image.params","digest":"sha256:cff3","size":1}]`
  const distant = `{"schemaVersion":2,"config":{"digest":"sha256:05a6"},"layers":${couches()}}`
  it('chemin sur le registre', () => {
    expect(cheminModele('qwen3:8b')).toEqual({ espace: 'library', modele: 'qwen3', etiquette: '8b' })
    expect(cheminModele('qwen3')).toEqual({ espace: 'library', modele: 'qwen3', etiquette: 'latest' })
    expect(cheminModele('moi/mon-modele:q4')).toEqual({ espace: 'moi', modele: 'mon-modele', etiquette: 'q4' })
    expect(cheminModele('hf.co/x/y:z')).toBeNull()
    expect(cheminModele('../x')).toBeNull()
  })
  it('même manifeste : à jour', () => {
    expect(comparerManifestes(distant, sha(distant), distant, sha(distant))).toBe('a-jour')
  })
  it('Ollama récent garde l’empreinte du manifeste publié parmi ses couches', () => {
    const local = `{"schemaVersion":2,"config":{"digest":"sha256:05a6"},"layers":${couches(`,{"mediaType":"application/vnd.docker.distribution.manifest.v2+json","digest":"sha256:${sha(distant)}","size":859}`)}}`
    expect(comparerManifestes(local, sha(local), distant, sha(distant))).toBe('a-jour')
  })
  it('mêmes couches écrites autrement : à jour ; couche changée : mise à jour', () => {
    const local = `{"layers":${couches()},"config":{"digest":"sha256:05a6"},"schemaVersion":2}`
    expect(comparerManifestes(local, sha(local), distant, sha(distant))).toBe('a-jour')
    const nouveau = distant.replace('sha256:a3de', 'sha256:ffff')
    expect(comparerManifestes(local, sha(local), nouveau, sha(nouveau))).toBe('mise-a-jour')
  })
  it('manifeste local introuvable : état inconnu', () => {
    expect(comparerManifestes(null, null, distant, sha(distant))).toBe('inconnu')
    expect(comparerManifestes(distant, sha(distant), 'pas du json', sha('pas du json'))).toBe('inconnu')
  })
  it('texte affiché', () => {
    expect(texteModele(undefined).texte).toBe('Pas encore vérifié')
    expect(texteModele({ local: 'aaaaaaaa11', distant: 'bbbbbbbb22', etat: 'mise-a-jour', verifie: Date.now() }).texte).toMatch(
      /^Mise à jour disponible \(aaaaaaaa → bbbbbbbb\), vérifié le /
    )
    expect(texteModele({ local: 'b', distant: '500a1f067a9f', etat: 'a-jour', verifie: Date.now() }).texte).toMatch(/^À jour \(empreinte 500a1f06\), vérifié le /)
  })
})

describe('Ollama : texte affiché', () => {
  const verifie = new Date(2026, 10, 9, 14, 5).getTime()
  it('à jour, mise à jour disponible, pas encore vérifié', () => {
    expect(texteOllama({ installee: '0.40.15', derniere: '0.40.15', verifie }, null).texte).toBe('À jour (version 0.40.15, vérifié le 9 novembre 2026 à 14:05)')
    expect(texteOllama({ installee: '0.40.1', derniere: '0.40.15', verifie }, null)).toEqual({ texte: 'Mise à jour disponible : 0.40.1 → 0.40.15', etat: 'mise-a-jour' })
    expect(texteOllama({ installee: null, derniere: null, verifie: null }, '0.40.1').etat).toBe('inconnu')
    expect(texteOllama({ installee: null, derniere: '1.0.0', verifie }, null).texte).toBe('')
  })
  it('date en français', () => {
    expect(dateFr(new Date(2026, 0, 3, 9, 7).getTime())).toBe('3 janvier 2026 à 09:07')
  })
})

describe('bloqueur : renouvellement des listes', () => {
  const t = 1_800_000_000_000
  it('listes de moins d’une semaine : rien n’est téléchargé', async () => {
    const telecharger = vi.fn(async () => 'neuf')
    const r = await renouvelerMoteur({ actuel: 'ancien', listes: t - 3600_000, maintenant: t, telecharger, enregistrer: async () => undefined })
    expect(telecharger).not.toHaveBeenCalled()
    expect(r).toEqual({ moteur: 'ancien', listes: t - 3600_000, renouvele: false, echec: false })
  })
  it('hors-ligne avec des listes périmées : l’ancien moteur continue de bloquer', async () => {
    const enregistrer = vi.fn(async () => undefined)
    const r = await renouvelerMoteur({
      actuel: 'ancien',
      listes: t - RENOUVELLEMENT_LISTES - 1,
      maintenant: t,
      telecharger: async () => {
        throw new Error('hors-ligne')
      },
      enregistrer
    })
    expect(r.moteur).toBe('ancien')
    expect(r.listes).toBe(t - RENOUVELLEMENT_LISTES - 1)
    expect(r.echec).toBe(true)
    expect(enregistrer).not.toHaveBeenCalled() // l'ancien cache n'est jamais touché
  })
  it('hors-ligne au premier lancement : pas de moteur, on réessaiera', async () => {
    const r = await renouvelerMoteur<string>({ actuel: null, listes: null, maintenant: t, telecharger: () => Promise.reject(new Error('x')), enregistrer: async () => undefined })
    expect(r).toEqual({ moteur: null, listes: null, renouvele: false, echec: true })
  })
  it('en ligne : nouvelles listes enregistrées et datées', async () => {
    const enregistrer = vi.fn(async () => undefined)
    const r = await renouvelerMoteur({ actuel: 'ancien', listes: t - RENOUVELLEMENT_LISTES, maintenant: t, telecharger: async () => 'neuf', enregistrer })
    expect(enregistrer).toHaveBeenCalledWith('neuf')
    expect(r).toEqual({ moteur: 'neuf', listes: t, renouvele: true, echec: false })
  })
  it('cache impossible à écrire : nouvelles listes utilisées, date inchangée (on retentera)', async () => {
    const r = await renouvelerMoteur({ actuel: null, listes: null, maintenant: t, telecharger: async () => 'neuf', enregistrer: () => Promise.reject(new Error('disque plein')) })
    expect(r).toEqual({ moteur: 'neuf', listes: null, renouvele: true, echec: false })
  })
  it('périmées : jamais, plus d’une semaine, ou date dans le futur', () => {
    expect(listesPerimees(null, t)).toBe(true)
    expect(listesPerimees(t - 1000, t)).toBe(false)
    expect(listesPerimees(t + 1000, t)).toBe(true)
  })
})
