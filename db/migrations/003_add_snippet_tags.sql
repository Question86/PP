-- Migration: Add tags column to snippets table for search functionality
-- Date: 2026-01-03
-- Purpose: Enable keyword-based recommendation search

USE promptpage;

-- Add tags column for searchable keywords (TEXT to avoid overflow)
ALTER TABLE snippets 
ADD COLUMN tags TEXT NULL AFTER summary;

-- Add fulltext index for efficient keyword search
CREATE FULLTEXT INDEX idx_snippet_search ON snippets(title, summary, tags);

-- Verification query
SELECT id, title, summary, tags, category 
FROM snippets 
LIMIT 5;
