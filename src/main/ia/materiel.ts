/* Détection du matériel (mémoire, carte graphique) et test de vitesse d'un modèle, pour proposer le bon modèle selon le PC.
 * Rien ne part sur Internet : nvidia-smi (s'il est là) et le registre de Windows suffisent. */
import { execFile } from 'node:child_process'
import { cpus, totalmem } from 'node:os'
import { net } from 'electron'
import { analyserReg, type Materiel } from '../../shared/materiel'
import { API_OLLAMA } from './ollama'

function executer(cmd: string, args: string[]): Promise<string> {
  return new Promise((r) => execFile(cmd, args, { windowsHide: true, timeout: 5000, encoding: 'utf8' }, (err, out) => r(err ? '' : out)))
}

const CLE_AFFICHAGE = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}'

/** Cartes graphiques d'après le registre (nom et mémoire vidéo dédiée, 64 bits : fiable au-delà de 4 Go). */
async function cartesRegistre(): Promise<{ nom: string; vramGo: number }[]> {
  const [mem, noms] = await Promise.all([
    executer('reg', ['query', CLE_AFFICHAGE, '/s', '/v', 'HardwareInformation.qwMemorySize']),
    executer('reg', ['query', CLE_AFFICHAGE, '/s', '/v', 'DriverDesc'])
  ])
  const tailles = analyserReg(mem, 'HardwareInformation.qwMemorySize')
  const libelles = analyserReg(noms, 'DriverDesc')
  return [...libelles].map(([cle, nom]) => {
    const brut = tailles.get(cle)
    const octets = brut ? Number(BigInt(brut.startsWith('0x') ? brut : `0x${brut}`)) : 0
    return { nom, vramGo: octets / 1024 ** 3 }
  })
}

/** NVIDIA : nvidia-smi donne la mémoire exacte. */
async function cartesNvidia(): Promise<{ nom: string; vramGo: number }[]> {
  const out = await executer('nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'])
  return out
    .split(/\r?\n/)
    .map((l) => l.split(',').map((s) => s.trim()))
    .filter((p) => p.length === 2 && p[0] && Number(p[1]) > 0)
    .map(([nom, mo]) => ({ nom, vramGo: Number(mo) / 1024 }))
}

let cache: Materiel | null = null

export async function detecterMateriel(): Promise<Materiel> {
  if (cache) return cache
  const cartes = [...(await cartesNvidia()), ...(process.platform === 'win32' ? await cartesRegistre() : [])]
  // les cartes intégrées déclarent souvent 128 Mo à 512 Mo : en dessous de 1 Go, on considère qu'il n'y a pas de mémoire dédiée
  const meilleure = cartes.sort((a, b) => b.vramGo - a.vramGo)[0]
  cache = {
    ramGo: totalmem() / 1024 ** 3,
    coeurs: cpus().length,
    gpu: meilleure?.nom ?? null,
    vramGo: meilleure && meilleure.vramGo >= 1 ? Math.round(meilleure.vramGo * 10) / 10 : 0
  }
  return cache
}

/** Génère une courte réponse et mesure la vitesse (jetons par seconde), chargement du modèle exclu. */
export async function testerVitesse(modele: string): Promise<number> {
  const rep = await net.fetch(`${API_OLLAMA}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: modele, prompt: 'Écris quatre phrases sur la mer, en français.', stream: false, think: false, options: { num_predict: 96 } })
  })
  if (!rep.ok) throw new Error(`Ollama a répondu ${rep.status}`)
  const d = (await rep.json()) as { eval_count?: number; eval_duration?: number }
  if (!d.eval_count || !d.eval_duration) throw new Error('mesure indisponible')
  return d.eval_count / (d.eval_duration / 1e9)
}
