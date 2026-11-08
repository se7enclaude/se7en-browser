-- Synchronisation chiffrée de bout en bout : un paquet chiffré par espace de synchronisation.
-- Le serveur ne voit ni la clé, ni le contenu, ni à quel profil l'espace appartient.
CREATE TABLE IF NOT EXISTS sync (
  id TEXT PRIMARY KEY,      -- dérivé de la clé de synchronisation (empreinte), impossible à deviner
  auth TEXT NOT NULL,       -- empreinte SHA-256 du jeton d'écriture (lui-même dérivé de la clé)
  donnees TEXT NOT NULL,    -- paquet chiffré (AES-256-GCM), en base64
  version INTEGER NOT NULL, -- augmente à chaque écriture (deux PC ne s'écrasent pas)
  maj INTEGER NOT NULL
);
