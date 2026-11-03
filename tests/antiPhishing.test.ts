import { describe, expect, it } from 'vitest'
import { analyserPage } from '../src/main/securite/antiPhishing'

const page = (url: string, titre: string, motDePasse = true) => ({ url, titre, texte: '', motDePasse })

describe('anti-phishing', () => {
  it('laisse tranquilles les vrais sites et les pages sans mot de passe', () => {
    expect(analyserPage(page('https://accounts.google.com/signin', 'Connexion – Comptes Google')).niveau).toBe('aucun')
    expect(analyserPage(page('https://www.paypal.com/signin', 'Connectez-vous à PayPal')).niveau).toBe('aucun')
    expect(analyserPage(page('https://mabanque.bnpparibas/fr/connexion', 'BNP Paribas – Connexion')).niveau).toBe('aucun')
    expect(analyserPage(page('https://exemple-paypal.com', 'PayPal', false)).niveau).toBe('aucun')
    expect(analyserPage(page('https://forum.exemple.fr/login', 'Connexion au forum')).niveau).toBe('aucun')
  })

  it("repère une marque dans une adresse qui n'est pas la sienne", () => {
    const v = analyserPage(page('https://paypal-securite-compte.com/login', 'PayPal : vérifiez votre compte'))
    expect(v.niveau).toBe('fort')
    expect(v.marque).toBe('PayPal')
  })

  it('trouve douteuse une marque citée sur un autre site', () => {
    expect(analyserPage(page('https://login-secure-verif.net', 'Connexion à votre compte Microsoft')).niveau).toBe('douteux')
  })

  it('repère les adresses piégées', () => {
    expect(analyserPage(page('https://xn--pypal-4ve.com', 'Connexion')).niveau).toBe('fort')
    expect(analyserPage(page('http://192.168.4.20/login', 'Connexion')).niveau).toBe('fort')
    expect(analyserPage(page('http://forum.exemple.fr/login', 'Connexion')).niveau).toBe('fort')
  })
})

describe('anti-phishing : connexion avec un compte tiers', () => {
  it('ne se méfie pas de « Se connecter avec Google »', () => {
    const v = analyserPage({ url: 'https://forum-velo.fr/login', titre: 'Forum vélo – Connexion', texte: 'Se connecter avec Google. Pas encore de compte ?', motDePasse: true })
    expect(v.niveau).toBe('aucun')
  })
})
