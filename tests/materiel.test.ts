import { describe, expect, it } from 'vitest'
import { analyserReg, recommander, verdictVitesse } from '../src/shared/materiel'

describe('Le bon modèle selon le PC', () => {
  it('choisit selon la mémoire vidéo d\'abord', () => {
    expect(recommander({ ramGo: 64, coeurs: 24, gpu: 'RTX 4090', vramGo: 24 }).texte).toBe('qwen3:30b')
    expect(recommander({ ramGo: 32, coeurs: 16, gpu: 'RTX 5070 Ti', vramGo: 15.9 }).niveau).toBe('puissant')
    expect(recommander({ ramGo: 16, coeurs: 8, gpu: 'RTX 3060', vramGo: 8 }).texte).toBe('qwen3:8b')
  })

  it('sans carte graphique, regarde la mémoire et le processeur', () => {
    expect(recommander({ ramGo: 32, coeurs: 12, gpu: 'Intel UHD', vramGo: 0 }).niveau).toBe('standard')
    expect(recommander({ ramGo: 8, coeurs: 4, gpu: null, vramGo: 0 }).texte).toBe('qwen3:4b')
    const petit = recommander({ ramGo: 4, coeurs: 2, gpu: null, vramGo: 0 })
    expect(petit.niveau).toBe('tres-modeste')
    expect(petit.vision).toBeNull()
  })

  it('une grosse carte avec peu de mémoire vive ne passe pas au cran du dessus', () => {
    expect(recommander({ ramGo: 16, coeurs: 8, gpu: 'RTX 4090', vramGo: 24 }).niveau).toBe('puissant')
  })

  it('lit la mémoire vidéo et le nom des cartes dans le registre', () => {
    const sortie = [
      String.raw`HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0000`,
      '    HardwareInformation.qwMemorySize    REG_QWORD    0x3faf00000',
      '',
      String.raw`HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0001`,
      '    HardwareInformation.qwMemorySize    REG_QWORD    0x20000000'
    ].join('\r\n')
    const m = analyserReg(sortie, 'HardwareInformation.qwMemorySize')
    expect(m.get('0000')).toBe('0x3faf00000')
    expect(m.get('0001')).toBe('0x20000000')
  })

  it('donne un verdict de vitesse lisible', () => {
    expect(verdictVitesse(60).niveau).toBe('rapide')
    expect(verdictVitesse(12).niveau).toBe('correct')
    expect(verdictVitesse(3).niveau).toBe('lent')
  })
})
