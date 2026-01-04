-- Clear existing test data
TRUNCATE TABLE composition_items;
TRUNCATE TABLE compositions;
TRUNCATE TABLE requests;
TRUNCATE TABLE snippet_versions;
TRUNCATE TABLE snippets;
TRUNCATE TABLE creators;

-- Insert test creators with owner_address (using placeholder testnet addresses)
-- Note: owner_address = wallet identity, payout_address = payment destination
INSERT INTO creators (owner_address, display_name, payout_address) VALUES 
  ('3WwdXmYP1v8vRlP4M8fVVzVzWvZpJmxT1yKnGqAqTGYQvD7KqH5L', 'TestCreator1', '3WwdXmYP1v8vRlP4M8fVVzVzWvZpJmxT1yKnGqAqTGYQvD7KqH5L'),
  ('3WwdXmYP1v8vRlP4M8fVVzVzWvZpJmxT1yKnGqAqTGYQvD7KqH5M', 'TestCreator2', '3WwdXmYP1v8vRlP4M8fVVzVzWvZpJmxT1yKnGqAqTGYQvD7KqH5M');

-- Insert test snippets (category 'system' changed to 'context' - valid enum value)
INSERT INTO snippets (creator_id, title, summary, category, status) VALUES
  (1, 'Python Expert System', 'Expert Python developer instructions', 'context', 'published'),
  (1, 'Data Analysis Context', 'Data analysis methodology', 'context', 'published'),
  (2, 'Code Review Guidelines', 'Professional code review standards', 'guardrail', 'published');

-- Insert snippet versions with prices (removed status column - doesn't exist in schema)
INSERT INTO snippet_versions (snippet_id, version, content, content_hash, price_nanoerg) VALUES
  (1, 1, 'You are an expert Python developer with deep knowledge of best practices...', SHA2('python_expert_v1', 256), 10000000),
  (2, 1, 'Use data-driven approach with statistical validation...', SHA2('data_analysis_v1', 256), 15000000),
  (3, 1, 'Review code for quality, security, and maintainability...', SHA2('code_review_v1', 256), 20000000);

-- Verify setup
SELECT 'Database setup complete' as status;
SELECT s.id as snippet_id, s.title, sv.version, sv.price_nanoerg, c.display_name, c.owner_address, c.payout_address 
FROM snippets s 
JOIN snippet_versions sv ON s.id = sv.snippet_id 
JOIN creators c ON s.creator_id = c.id;
