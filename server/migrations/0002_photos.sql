-- Photos de profil rangées dans la base (256 px, quelques dizaines de Ko) : pas de stockage R2 à activer.
CREATE TABLE photos (
  id TEXT PRIMARY KEY,               -- identifiant de l'utilisateur
  type TEXT NOT NULL,                -- image/jpeg, image/png ou image/webp
  donnees BLOB NOT NULL
);
