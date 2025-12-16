-- Add discovery fields to server_identities
ALTER TABLE server_identity ADD COLUMN description TEXT;
ALTER TABLE server_identity ADD COLUMN is_discoverable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE server_identity ADD COLUMN icon_url TEXT;
