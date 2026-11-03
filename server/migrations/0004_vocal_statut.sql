-- Messages vocaux et statut

-- Message vocal : identifiant du son (rangé dans la table images, avec son type audio/…)
ALTER TABLE messages ADD COLUMN vocal TEXT;

-- Statut choisi par l'utilisateur (JSON : { "type": "dispo" | "occupe" | "jeu" | "absent", "texte": "…" })
ALTER TABLE utilisateurs ADD COLUMN statut TEXT;
