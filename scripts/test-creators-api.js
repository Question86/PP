// Test /api/creators endpoint logic directly
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function testCreatorsAPI() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'promptpage'
  });

  try {
    const [rows] = await connection.execute(
      'SELECT id, display_name, bio, payout_address, created_at FROM creators ORDER BY id'
    );

    console.log('\n=== /api/creators Response (Simulated) ===\n');
    console.log(JSON.stringify(rows, null, 2));
    
    console.log('\n=== Validation ===');
    console.log(`✓ Total creators: ${rows.length}`);
    
    if (rows.length >= 1) {
      const creator1 = rows[0];
      console.log(`✓ Creator 1: ${creator1.display_name}`);
      console.log(`  Payout Address: ${creator1.payout_address}`);
      const expectedAddr2 = '3WwFvKjMDws93LvrW5sP2pPE5x5fPGX1KFNYbFjYt1V91PqVUaPz';
      if (creator1.payout_address === expectedAddr2) {
        console.log(`  ✓ PASS: Matches Address 2`);
      } else {
        console.log(`  ✗ FAIL: Expected ${expectedAddr2}`);
      }
    }
    
    if (rows.length >= 2) {
      const creator2 = rows[1];
      console.log(`✓ Creator 2: ${creator2.display_name}`);
      console.log(`  Payout Address: ${creator2.payout_address}`);
      const expectedAddr3 = '3WxTTK5njudBFxYP7sAkVU9ehPbcL1o3HV3zJB4MJjq8ZgvPsDFB';
      if (creator2.payout_address === expectedAddr3) {
        console.log(`  ✓ PASS: Matches Address 3`);
      } else {
        console.log(`  ✗ FAIL: Expected ${expectedAddr3}`);
      }
    }
    
  } finally {
    await connection.end();
  }
}

testCreatorsAPI().catch(console.error);
