const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const DATABASE_URL = envContent.match(/DATABASE_URL=(.+)/)?.[1]?.trim();

async function setupTestData() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL not found in .env.local');
  }
  console.log('Connecting to:', DATABASE_URL.replace(/:[^:]*@/, ':****@'));
  const connection = await mysql.createConnection(DATABASE_URL);

  try {
    console.log('Connected to database');

    // Clear existing test data
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('TRUNCATE TABLE composition_items');
    await connection.query('TRUNCATE TABLE compositions');
    await connection.query('TRUNCATE TABLE requests');
    await connection.query('TRUNCATE TABLE snippet_versions');
    await connection.query('TRUNCATE TABLE snippets');
    await connection.query('TRUNCATE TABLE creators');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ Cleared existing test data');

    // Insert test creators with different testnet addresses
    await connection.query(`
      INSERT INTO creators (display_name, payout_address) VALUES 
        ('TestCreator1', '3WwFvKjMDws93LvrW5sP2pPE5x5fPGX1KFNYbFjYt1V91PqVUaPz'),
        ('TestCreator2', '3WxTTK5njudBFxYP7sAkVU9ehPbcL1o3HV3zJB4MJjq8ZgvPsDFB')
    `);
    console.log('✓ Inserted 2 test creators');

    // Insert test snippets
    await connection.query(`
      INSERT INTO snippets (creator_id, title, summary, category, status) VALUES
        (1, 'Python Expert System', 'Expert Python developer instructions', 'context', 'published'),
        (1, 'Data Analysis Context', 'Data analysis methodology', 'context', 'published'),
        (2, 'Code Review Guidelines', 'Professional code review standards', 'guardrail', 'published')
    `);
    console.log('✓ Inserted 3 test snippets');

    // Insert snippet versions with prices
    await connection.query(`
      INSERT INTO snippet_versions (snippet_id, version, content, content_hash, price_nanoerg) VALUES
        (1, 1, 'You are an expert Python developer with deep knowledge of best practices...', SHA2('python_expert_v1', 256), 10000000),
        (2, 1, 'Use data-driven approach with statistical validation...', SHA2('data_analysis_v1', 256), 15000000),
        (3, 1, 'Review code for quality, security, and maintainability...', SHA2('code_review_v1', 256), 20000000)
    `);
    console.log('✓ Inserted 3 snippet versions');

    // Verify inserted data
    const [rows] = await connection.query(`
      SELECT s.id as snippet_id, s.title, sv.version, sv.price_nanoerg, c.display_name, c.payout_address 
      FROM snippets s 
      JOIN snippet_versions sv ON s.id = sv.snippet_id 
      JOIN creators c ON s.creator_id = c.id
    `);

    console.log('\n=== Database Setup Complete ===');
    console.table(rows);

  } finally {
    await connection.end();
  }
}

setupTestData().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
