-- =============================================================================
-- MonkeysCloud — MySQL Initialization
-- =============================================================================
-- This runs ONLY on first container start (empty volume).
-- Creates the platform database with UTF-8 support.
-- =============================================================================

-- Ensure proper character set
ALTER DATABASE monkeyscloud CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant all privileges to the app user
GRANT ALL PRIVILEGES ON monkeyscloud.* TO 'monkeyscloud'@'%';
FLUSH PRIVILEGES;
