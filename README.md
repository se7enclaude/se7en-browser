# se7en Browser

Un navigateur web pour Windows au design « Liquid Glass », avec une IA qui tourne sur ton PC (Ollama + Qwen).
Il fait partie de la suite se7en et s'installe depuis **Seventh OS**.

> En construction : étapes 1 à 4 terminées. Voir « Avancement » plus bas.

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

Clic molette sur un onglet : le fermer. Glisser un onglet : le déplacer. Clic droit : épingler en prioritaire, dupliquer, fermer les autres.

**Onglets prioritaires** : épinglés dans la barre latérale (glisser un onglet dedans, ou clic droit). Ils sont gardés
d'une session à l'autre et ne se chargent qu'à l'ouverture. Les fermer les met en veille et les ramène à leur adresse d'origine.

**Vue partagée** : deux onglets côte à côte (bouton à droite de la barre d'adresse, ou clic droit sur un onglet).
La poignée du milieu règle la largeur ; cliquer dans un volet le rend actif.

**Téléchargements** : directement dans le dossier Téléchargements de Windows, avec la « marque du web »
(Zone.Identifier) pour que SmartScreen contrôle les fichiers avant leur ouverture.

Historique, favoris et téléchargements restent sur le PC (`historique.json`, `favoris.json`, `telechargements.json`).

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

La compilation en `.exe` (installeur Inno Setup) arrive à l'étape 9.

## Organisation du code

```
src/
  main/        processus principal (Node) : fenêtre, stockage, sécurité, IPC
  preload/     pont sécurisé entre l'interface et le main (window.se7en)
  renderer/    interface React (barre de titre, onglets, panneaux)
  shared/      types et contrat IPC communs
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
5. Ollama : détection, installation, modèles
6. Panneau IA (Ctrl+Espace), « Demande ou cherche », @onglets, Skills, résumé
7. PDF : visionneuse, discuter avec un PDF
8. Coffre chiffré et remplissage de PDF ; bloqueur, onglets rangés par l'IA, mémoire ; profils et amis
9. Installeur Windows
10. Publication et ajout dans Seventh OS
