-- Migration: Add owner_address to creators table
-- Date: 2026-01-03
-- Purpose: Separate wallet ownership (authentication) from payout address (payment destination)

USE promptpage;

-- Step 1: Add owner_address column (nullable initially for migration)
ALTER TABLE creators 
ADD COLUMN owner_address VARCHAR(255) NULL AFTER payout_address;

-- Step 2: Backfill existing rows (dev/test: set owner_address = payout_address)
UPDATE creators 
SET owner_address = payout_address 
WHERE owner_address IS NULL;

-- Step 3: Make column NOT NULL and add UNIQUE constraint
ALTER TABLE creators 
MODIFY COLUMN owner_address VARCHAR(255) NOT NULL;

ALTER TABLE creators 
ADD UNIQUE KEY unique_owner_address (owner_address);

-- Step 4: Add index for lookups
CREATE INDEX idx_owner_address ON creators(owner_address);

-- Verification query
SELECT id, display_name, owner_address, payout_address, created_at 
FROM creators 
ORDER BY id;
