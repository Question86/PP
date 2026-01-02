-- PromptPage Database Schema
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS promptpage
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE promptpage;

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
