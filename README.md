# se7en Browser

Un navigateur web pour Windows au design « Liquid Glass », avec une IA qui tourne sur ton PC (Ollama + Qwen).

**Design** (maquette « Navigateur Liquid Glass ») : verre fumé posé sur un fond ambiant flou, liseré lumineux, pilules
partout ; l'ivoire marque la sélection et l'action principale, le champagne tout ce qui vient de l'IA (orbe, étincelle).
Polices Urbanist (titres) et Figtree (interface), embarquées. Thème sombre (fidèle à la maquette), clair (brume ivoire,
sélection en graphite) ou auto ; la « couleur de l'ambiance » teinte le fond. Tout est dans `src/renderer/src/theme/glass.css`.
Il fait partie de la suite se7en et s'installe depuis **Seventh OS**.

> En construction : étapes 1 à 8b terminées. Voir « Avancement » plus bas.

## Raccourcis

| Raccourci | Action |
| --- | --- |
| Ctrl+T | nouvel onglet |
| Ctrl+W | fermer l'onglet |
| Ctrl+Maj+T | rouvrir le dernier onglet fermé |
| Ctrl+Tab / Ctrl+Maj+Tab | onglet suivant / précédent |
| Ctrl+1 … Ctrl+8, Ctrl+9 | onglet n, dernier onglet |
| Ctrl+L, Alt+D, F6 | aller dans la barre d'adresse |
| F5, Ctrl+R (Ctrl+F5 : sans cache) | actualiser |
| Alt+← / Alt+→ | page précédente / suivante |
| Ctrl+B | afficher / cacher la barre latérale |
| Ctrl+, | paramètres |
| Ctrl+H | historique |
| Ctrl+J | téléchargements |
| Ctrl+D | ajouter / retirer des favoris |
| Ctrl+Maj+O | favoris |
| Ctrl+Espace | panneau IA |
| Ctrl+O | ouvrir un PDF du PC |

Clic molette sur un onglet : le fermer. Glisser un onglet : le déplacer. Clic droit : épingler en prioritaire, dupliquer, fermer les autres.

**Onglets prioritaires** : épinglés dans la barre latérale (glisser un onglet dedans, ou clic droit). Ils sont gardés
d'une session à l'autre et ne se chargent qu'à l'ouverture. Les fermer les met en veille et les ramène à leur adresse d'origine.

**Vue partagée** : deux onglets côte à côte (bouton à droite de la barre d'adresse, ou clic droit sur un onglet).
La poignée du milieu règle la largeur ; cliquer dans un volet le rend actif.

**Téléchargements** : directement dans le dossier Téléchargements de Windows, avec la « marque du web »
(Zone.Identifier) pour que SmartScreen contrôle les fichiers avant leur ouverture.

Historique, favoris et téléchargements restent sur le PC (`historique.json`, `favoris.json`, `telechargements.json`).

**IA locale** (page `se7en://ia`, ouverte après l'écran d'accueil et depuis les Paramètres) : installe Ollama
(installeur officiel téléchargé depuis ollama.com, signature Authenticode vérifiée, installation silencieuse sans droits
administrateur), le démarre, puis télécharge les modèles avec leur progression. Par défaut : `qwen3:8b` (texte, ≈ 5,2 Go)
et `qwen3-vl:8b` (vision, ≈ 6,1 Go, facultatif). Ollama ne répond que sur `127.0.0.1:11434`.

Ollama **ne démarre jamais avec Windows** : à l'ouverture du navigateur, une barre demande « Activer l'IA locale ? »
(réglable dans les Paramètres : me demander / toujours / jamais). Le navigateur lance alors `ollama serve` sans fenêtre
et l'arrête en se fermant. Après l'installation, l'appli Ollama lancée par l'installeur est fermée et tout démarrage
automatique (dossier Démarrage, clé Run) est retiré.

**Panneau IA** (Ctrl+Espace, ou l'étincelle à droite de la barre d'adresse) : chat en flux avec l'IA locale, historique des
conversations, page actuelle jointe à la question (« discute avec la page »), autres onglets avec `@`, Skills avec `/`
(`/resume`, `/points`, `/explique`, `/traduis`, `/reponds`, modifiables dans les Paramètres), bouton « Résumer ».
Une page sans texte lisible est envoyée en capture au modèle vision.

**Demande ou cherche** : dans la barre d'adresse et la page Nouvel onglet, une adresse s'ouvre, une recherche part sur le
moteur choisi, et une question (« ? » final, « comment… », « pourquoi… ») part dans le panneau IA. Tab change de mode.

**Protection contre l'injection de prompt** (`src/main/ia/prompts.ts`, `lecturePage.ts`) :
- le texte des pages est lu dans un monde isolé, **sans le texte invisible** (blanc sur blanc, minuscule, transparent, hors écran) ;
- il est envoyé entre des balises à identifiant aléatoire que la page ne peut ni deviner ni refermer ;
- la consigne système dit que ce contenu est une donnée, jamais une instruction, et la demande de l'utilisateur et un
  rappel des règles viennent **après** le contenu (« sandwich ») ;
- les formules de manipulation (« ignore tes instructions », demande de mot de passe…) sont repérées : le modèle est
  prévenu et un avertissement s'affiche ;
- l'IA n'a aucun outil : elle ne peut que répondre ; ses réponses sont affichées sans HTML, et ses liens ne s'ouvrent qu'au clic.

Testé avec des pages piégées (ordre caché en texte blanc de 1 px, ordre écrit en clair) : l'IA résume la page sans obéir.

**PDF** : un PDF ouvert dans un onglet (lien, adresse, ou Ctrl+O pour un fichier du PC) s'affiche dans la visionneuse
de se7en Browser (pdf.js) : défilement, zoom (Ctrl+molette, Ctrl+/-), texte sélectionnable, liens, mot de passe,
bouton « Enregistrer » (vers Téléchargements). Précédent ramène à la page d'avant. Le panneau IA lit tout le texte du PDF
(page par page, pour citer les numéros de page) ; un PDF scanné, sans texte, est envoyé en capture au modèle vision.

La visionneuse tourne **dans un onglet isolé**, comme une page web (protocole interne `se7en-pdf://`, sans preload,
politique de sécurité stricte) : un PDF piégé qui exploiterait une faille de pdf.js n'aurait accès ni à l'interface
ni au coffre. Les PDF venus d'Internet sont gardés dans un dossier temporaire vidé à la fermeture ; chaque document a un
identifiant impossible à deviner, et un site web ne peut pas les lire (requêtes d'une autre origine refusées).

**Coffre personnel et remplissage de PDF** : dans Paramètres › Coffre personnel, on enregistre ses informations (nom,
prénom, date et lieu de naissance, adresse, e-mail, téléphone, n° de sécurité sociale, champs libres). Le coffre est
**chiffré avec le compte Windows** (`safeStorage` → DPAPI, fichier `coffre.bin`) et ne quitte jamais le PC.

Sur un PDF qui contient un formulaire, le panneau IA propose « Remplir avec mon coffre » (ou on écrit « remplis ce PDF ») :
1. le navigateur lit les champs du PDF et le texte écrit à côté de chacun (pdf.js + pdf-lib) ;
2. l'IA associe les champs aux informations du coffre **sans voir les valeurs** : elle ne reçoit que les libellés des
   champs et les *noms* des informations, et sa réponse est contrainte par un schéma JSON ; un garde-fou écarte les
   associations absurdes (date de naissance dans « Le : », n° de sécu hors de son champ). Sans IA, repérage par libellé ;
3. un **aperçu modifiable** montre chaque valeur, avec une case pour l'inclure ou non ;
4. **rien n'est écrit avant le clic sur « Remplir »** ; le PDF rempli est un nouveau fichier (l'original ne change pas),
   affiché dans l'onglet, avec « Enregistrer sous… ».

Testé sur un formulaire façon CERFA (15 champs, noms techniques f1…f15, libellé piégé) : 11 champs remplis
correctement, « employeur », « Fait à », « Le » et le champ piégé laissés vides.

**Bloqueur de pubs et de traqueurs** (`src/main/bloqueur`) : moteur de filtres de Ghostery (listes EasyList,
EasyPrivacy… préparées par Ghostery, téléchargées une fois puis renouvelées chaque semaine), utilisé seul : le blocage
se fait au niveau du réseau, **sans aucun script injecté dans les pages**. Le bouclier de la barre d'adresse montre le
nombre de blocages de la page et permet de désactiver le bloqueur sur un site ; réglages dans Paramètres › Confidentialité.

**Onglets rangés par l'IA** : le bouton « Ranger » (à côté de +) ou le menu demande à l'IA de grouper les onglets par
sujet, à partir de leurs titres et de leurs sites seulement. Chaque groupe a une étiquette de couleur : clic pour le
replier, clic droit pour le dégrouper ou fermer ses onglets. Un lien ouvert depuis un onglet rangé rejoint son groupe.

**Mémoire de l'IA** : « retiens que… » / « oublie… » dans le panneau IA. Seul ce que l'utilisateur tape lui-même est
retenu (jamais le contenu d'une page, jamais l'IA d'elle-même) ; les souvenirs sont ajoutés à la consigne système.
Liste, ajout, suppression et désactivation dans Paramètres › Mémoire de l'IA.

**Profils et amis** (`se7en://amis`, menu › Amis) : un profil = un pseudo + un code à 4 chiffres (« Claire#4821 »)
et une photo. On s'ajoute avec ce code, puis on s'envoie des messages et des onglets (liens) en direct ; une
notification Windows signale un message quand la fenêtre n'est pas au premier plan. Pas de mot de passe ni d'e-mail :
une clé Ed25519 est créée sur le PC, chiffrée par le compte Windows (`identite.bin`), et chaque requête est signée
(heure + nonce à usage unique : une requête interceptée ne peut pas être rejouée). Seuls le pseudo, la photo
(recadrée à 256 px sur le PC), la liste d'amis et les messages passent par le serveur ; les messages reçus sont
affichés en texte brut et un lien ne s'ouvre qu'en http(s), sur clic, dans un nouvel onglet.
« Supprimer mon compte » efface tout du serveur. Les messages de plus de 90 jours sont effacés automatiquement.

## Serveur se7en social (`server/`)

Cloudflare Worker + D1 (profils, amis, messages, photos de profil) + Durable Objects (connexion directe par WebSocket).
En ligne sur `https://se7en-social.outil-frontiere.workers.dev` (serveur par défaut du navigateur).

```
cd server
npm install
npm run dev        # serveur local sur http://127.0.0.1:8787 (base D1 locale)
```

Pour tester en local : Paramètres › Profils et amis › Serveur = `http://127.0.0.1:8787`.

Mise en ligne (compte Cloudflare) : `npx wrangler login`, `npx wrangler d1 create se7en-social` (copier l'id dans
`wrangler.toml`), puis `npm run deploy`. L'adresse obtenue va
dans `SERVEUR_SOCIAL_OFFICIEL` (`src/shared/social.ts`) pour que tout le monde l'utilise par défaut.

## Tester sans toucher à son profil

`SE7EN_PROFIL_TEST=<dossier>` lance le navigateur avec un profil à part (réglages, onglets, cookies),
et la fenêtre s'ouvre sans prendre le focus.

## Installer et lancer (développement)

Il faut [Node.js](https://nodejs.org) 22 ou plus récent.

```
npm install
npm run dev        # lance le navigateur avec rechargement à chaud
```

Si `npm install` n'a pas téléchargé Electron (message « Electron failed to install correctly ») :

```
node node_modules/electron/install.js
```

Autres commandes :

| Commande | Rôle |
| --- | --- |
| `npm run build` | compile main, preload et interface dans `out/` |
| `npm start` | lance la version compilée |
| `npm run typecheck` | vérifie les types TypeScript |
| `npm test` | lance les tests (Vitest) |
| `npm run dist` | construit l'installeur Windows |

## Construire l'installeur Windows

Il faut [Inno Setup 6](https://jrsoftware.org/isdl.php) (installé pour l'utilisateur, dans
`%LOCALAPPDATA%\Programs\Inno Setup 6`) et Python 3 (pour poser l'icône sur le `.exe`).

```
npm run dist
```

Résultat : `dist/release/se7en-Browser-Setup-<version>.exe` (≈ 130 Mo). `tools/build.js` compile le navigateur,
copie Electron renommé `se7en Browser.exe` avec son icône, n'ajoute que les modules utiles (pdf.js, pdf-lib, bloqueur),
puis lance Inno Setup (`installer.iss`).

L'installeur ne demande pas de droits administrateur : il installe dans `%LOCALAPPDATA%\Programs\se7en Browser`,
avec raccourcis menu Démarrer (et Bureau en option). Le même `.exe` sert de mise à jour (`/VERYSILENT`, et
`/RELAUNCH=1` pour rouvrir le navigateur). La désinstallation garde les données (`%APPDATA%\se7en Browser`) ;
Ollama a sa propre désinstallation.

Icônes : `npm run icons` (Pillow) régénère `build/icon.ico`, `icon.png` et les images de l'installeur.

Publication (étape 10, avec `gh` connecté) : `node tools/release.js publish "notes"` crée la release `v<version>` sur
`se7enclaude/se7en-browser` avec l'installeur et `latest.json` (`{ version, notes, published, setup: { name, sha256, size } }`),
lu par Seventh OS.

Le premier `npm install` copie aussi les fichiers de pdf.js (polices, tables de caractères) dans
`src/renderer/public/pdfjs` (`tools/copier-pdfjs.mjs`, relancé avant `dev` et `build`).

## Organisation du code

```
src/
  main/        processus principal (Node) : fenêtre, stockage, sécurité, IPC
  preload/     pont sécurisé entre l'interface et le main (window.se7en)
  renderer/    interface React (barre de titre, onglets, panneaux)
  shared/      types et contrat IPC communs
server/        serveur se7en social (Cloudflare Worker)
tests/         tests Vitest
```

## Sécurité

- `contextIsolation`, `sandbox` activés et `nodeIntegration` désactivé partout.
- L'interface ne peut ni naviguer ailleurs ni ouvrir de fenêtres ; elle n'a accès qu'aux canaux listés dans `src/shared/ipc.ts`, et le main vérifie que chaque message vient bien d'elle.
- Les réglages reçus sont validés champ par champ (`fusionnerReglages`).
- Chaque onglet est une `WebContentsView` isolée (session `persist:web`, séparée de l'interface), sans preload.
  Elle ne peut ouvrir que du http(s) ; `window.open` devient un nouvel onglet ; les permissions sensibles
  (caméra, micro, position, notifications…) sont refusées en attendant la demande site par site.
- Les icônes des sites sont téléchargées par le main et passées en `data:` : l'interface ne contacte jamais Internet.

## Avancement

1. ✅ Coque : fenêtre sans cadre, verre natif Windows 11 (repli Windows 10), thèmes clair/sombre/auto, teintes
2. ✅ Navigation : onglets, barre d'adresse, raccourcis
3. ✅ Barre latérale des onglets prioritaires (Ctrl+B), écran d'accueil, paramètres
4. ✅ Historique, favoris, téléchargements, Nouvel onglet, vue partagée (Splits)
5. ✅ Ollama : détection, installation, modèles
6. ✅ Panneau IA (Ctrl+Espace), « Demande ou cherche », @onglets, Skills, résumé, protection anti-injection
7. ✅ PDF : visionneuse isolée, discuter avec un PDF
8. ✅ Coffre chiffré et remplissage de PDF
8b. ✅ Bloqueur de pubs et traqueurs, onglets rangés par l'IA, mémoire
8c. ✅ Profils et amis (serveur Cloudflare en ligne)
9. ✅ Installeur Windows (Inno Setup)
10. ✅ Publication (v1.0.0) et ajout dans Seventh OS
