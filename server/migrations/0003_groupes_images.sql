-- Discussions de groupe, images dans les messages

-- Un message de groupe a « groupe » rempli et « a » vide ; un message avec image a « image » rempli
-- (l'image elle-même est dans la table images).
ALTER TABLE messages ADD COLUMN groupe TEXT;
ALTER TABLE messages ADD COLUMN image TEXT;
CREATE INDEX messages_groupe ON messages (groupe, date);

-- Images et captures envoyées (JPEG, PNG ou WebP, 1,5 Mo au plus), effacées avec leurs messages après 90 jours
CREATE TABLE images (
  id TEXT PRIMARY KEY,
  de TEXT NOT NULL,
  a TEXT,                            -- destinataire (message entre amis)
  groupe TEXT,                       -- ou groupe
  type TEXT NOT NULL,
  donnees BLOB NOT NULL,
  date INTEGER NOT NULL
);
CREATE INDEX images_date ON images (date);

CREATE TABLE groupes (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  createur TEXT NOT NULL,
  date INTEGER NOT NULL
);

-- Membres d'un groupe ; « lu » : date jusqu'à laquelle le membre a lu les messages du groupe
CREATE TABLE membres (
  groupe TEXT NOT NULL,
  id TEXT NOT NULL,
  lu INTEGER NOT NULL DEFAULT 0,
  date INTEGER NOT NULL,
  PRIMARY KEY (groupe, id)
);
CREATE INDEX membres_id ON membres (id);
