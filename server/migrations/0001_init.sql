-- se7en social : schéma de départ

-- Un utilisateur = une clé publique Ed25519 (créée sur son PC). Pas de mot de passe, pas d'e-mail.
CREATE TABLE utilisateurs (
  id TEXT PRIMARY KEY,               -- identifiant aléatoire
  cle TEXT NOT NULL UNIQUE,          -- clé publique Ed25519 (base64url)
  pseudo TEXT NOT NULL,
  code TEXT NOT NULL,                -- 4 chiffres : on s'ajoute avec « pseudo#code »
  photo TEXT,                        -- clé de la photo dans R2, ou NULL
  cree INTEGER NOT NULL,
  UNIQUE (pseudo COLLATE NOCASE, code)
);

-- Amitiés : une ligne par paire (a < b), demandée par « demandeur »
CREATE TABLE amities (
  a TEXT NOT NULL,
  b TEXT NOT NULL,
  demandeur TEXT NOT NULL,
  statut TEXT NOT NULL CHECK (statut IN ('attente', 'acceptee')),
  date INTEGER NOT NULL,
  PRIMARY KEY (a, b)
);
CREATE INDEX amities_b ON amities (b);

-- Messages et liens envoyés entre amis
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  de TEXT NOT NULL,
  a TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('texte', 'lien')),
  texte TEXT NOT NULL,
  url TEXT,
  titre TEXT,
  date INTEGER NOT NULL,
  lu INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX messages_paire ON messages (de, a, date);
CREATE INDEX messages_a ON messages (a, lu);

-- Signatures déjà utilisées (une requête signée ne peut pas être rejouée)
CREATE TABLE nonces (
  nonce TEXT PRIMARY KEY,
  expire INTEGER NOT NULL
);
