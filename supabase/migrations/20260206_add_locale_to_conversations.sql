-- Ajouter la locale à la conversation pour savoir dans quelle langue communiquer
ALTER TABLE messenger_conversations
ADD COLUMN IF NOT EXISTS locale VARCHAR(2) DEFAULT 'fr';

COMMENT ON COLUMN messenger_conversations.locale IS 'Langue de la conversation (fr, en, he)';
