-- =============================================================================
-- MonkeysCloud — PostgreSQL Initialization
-- =============================================================================
-- Runs on first container start (empty volume).
-- Creates extensions and sets defaults.
-- =============================================================================

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Set timezone
ALTER DATABASE monkeyscloud SET timezone TO 'UTC';
