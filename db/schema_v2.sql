-- PromptPage V2 Database Schema
-- Modular Snippet Marketplace
-- MySQL 8.0+

-- =====================================================
-- SETUP
-- =====================================================

CREATE DATABASE IF NOT EXISTS promptpage
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE promptpage;

-- =====================================================
-- V1 TABLE (LEGACY - Keep for backward compatibility)
-- =====================================================

CREATE TABLE IF NOT EXISTS prompts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_address VARCHAR(255) NOT NULL,
  prompt_text LONGTEXT NOT NULL,
  prompt_hash VARCHAR(64) NOT NULL,
  status ENUM('stored', 'mint_pending', 'minted', 'failed') NOT NULL DEFAULT 'stored',
  mint_tx_id VARCHAR(64) NULL,
  token_id VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_owner_address (owner_address),
  INDEX idx_token_id (token_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- V2 TABLES - MODULAR SNIPPET MARKETPLACE
-- =====================================================

-- =====================================================
-- CREATORS & SNIPPETS
-- =====================================================

CREATE TABLE IF NOT EXISTS creators (
  id INT AUTO_INCREMENT PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  payout_address VARCHAR(255) NOT NULL,
  bio TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payout_address (payout_address),
  UNIQUE KEY unique_payout (payout_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS snippets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  creator_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  category ENUM('guardrail', 'format', 'tone', 'eval', 'tooling', 'context', 'other') NOT NULL,
  status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE,
  INDEX idx_creator (creator_id),
  INDEX idx_status (status),
  INDEX idx_category (category),
  INDEX idx_status_category (status, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS snippet_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  snippet_id INT NOT NULL,
  version INT NOT NULL,
  content LONGTEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  price_nanoerg BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE,
  UNIQUE KEY unique_version (snippet_id, version),
  INDEX idx_content_hash (content_hash),
  INDEX idx_snippet_version (snippet_id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- USER REQUESTS & COMPOSITIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_address VARCHAR(255) NOT NULL,
  user_prompt LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_address (user_address),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS compositions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  user_address VARCHAR(255) NOT NULL,
  status ENUM('proposed', 'awaiting_payment', 'paid', 'failed') DEFAULT 'proposed',
  total_price_nanoerg BIGINT NOT NULL,
  platform_fee_nanoerg BIGINT NOT NULL,
  tx_id VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  INDEX idx_user_address (user_address),
  INDEX idx_status (status),
  INDEX idx_tx_id (tx_id),
  INDEX idx_user_status (user_address, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS composition_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  composition_id INT NOT NULL,
  snippet_version_id INT NOT NULL,
  creator_payout_address VARCHAR(255) NOT NULL,
  price_nanoerg BIGINT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  FOREIGN KEY (composition_id) REFERENCES compositions(id) ON DELETE CASCADE,
  FOREIGN KEY (snippet_version_id) REFERENCES snippet_versions(id) ON DELETE RESTRICT,
  INDEX idx_composition (composition_id),
  INDEX idx_creator_address (creator_payout_address),
  INDEX idx_snippet_version (snippet_version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- PAYMENTS & VERIFICATION
-- =====================================================

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  composition_id INT NOT NULL,
  tx_id VARCHAR(64) NOT NULL,
  status ENUM('submitted', 'confirmed', 'rejected') DEFAULT 'submitted',
  confirmed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (composition_id) REFERENCES compositions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_tx (tx_id),
  INDEX idx_composition (composition_id),
  INDEX idx_status (status),
  INDEX idx_tx_id (tx_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- ANALYTICS (OPTIONAL - FOR PHASE 2+)
-- =====================================================

CREATE TABLE IF NOT EXISTS snippet_usage_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  snippet_version_id INT NOT NULL,
  usage_count INT DEFAULT 0,
  total_earned_nanoerg BIGINT DEFAULT 0,
  last_used_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (snippet_version_id) REFERENCES snippet_versions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_stats (snippet_version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SEED DATA (OPTIONAL - FOR TESTING)
-- =====================================================

-- Uncomment to add demo creator and snippets for testing
/*
INSERT INTO creators (display_name, payout_address, bio) VALUES
('Demo Creator', '9fTestAddressHere...', 'Example creator for testing');

SET @creator_id = LAST_INSERT_ID();

INSERT INTO snippets (creator_id, title, summary, category, status) VALUES
(@creator_id, 'Professional Tone', 'Ensures responses are formal and professional', 'tone', 'published'),
(@creator_id, 'JSON Output Enforcer', 'Forces structured JSON output format', 'format', 'published'),
(@creator_id, 'Escalation Handler', 'Manages customer escalation scenarios', 'guardrail', 'published');

INSERT INTO snippet_versions (snippet_id, version, content, content_hash, price_nanoerg)
SELECT id, 1, 
  'You must maintain a professional, formal tone in all responses...',
  SHA2('You must maintain a professional, formal tone in all responses...', 256),
  10000000
FROM snippets WHERE title = 'Professional Tone';

INSERT INTO snippet_versions (snippet_id, version, content, content_hash, price_nanoerg)
SELECT id, 1,
  'You must output valid JSON only. Never include explanatory text...',
  SHA2('You must output valid JSON only. Never include explanatory text...', 256),
  8000000
FROM snippets WHERE title = 'JSON Output Enforcer';

INSERT INTO snippet_versions (snippet_id, version, content, content_hash, price_nanoerg)
SELECT id, 1,
  'When customer issues escalate, follow protocol: 1) Acknowledge concern...',
  SHA2('When customer issues escalate, follow protocol: 1) Acknowledge concern...', 256),
  15000000
FROM snippets WHERE title = 'Escalation Handler';
*/
