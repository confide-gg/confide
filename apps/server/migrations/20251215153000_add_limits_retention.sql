-- Add limits and retention fields to server_identity
ALTER TABLE server_identity ADD COLUMN max_users INTEGER NOT NULL DEFAULT 100;
ALTER TABLE server_identity ADD COLUMN max_upload_size_mb INTEGER NOT NULL DEFAULT 100;
ALTER TABLE server_identity ADD COLUMN message_retention TEXT NOT NULL DEFAULT '30d';
