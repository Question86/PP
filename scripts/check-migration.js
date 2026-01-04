// Check if owner_address migration has been applied
require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function check() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    const [rows] = await connection.execute('DESCRIBE creators');
    const hasOwnerAddress = rows.some(row => row.Field === 'owner_address');
    
    console.log('\n=== CREATORS TABLE STRUCTURE ===');
    console.log(JSON.stringify(rows, null, 2));
    console.log('\n=== MIGRATION STATUS ===');
    console.log(`owner_address column exists: ${hasOwnerAddress ? 'YES' : 'NO'}`);
    
    if (!hasOwnerAddress) {
      console.log('\n⚠️  Migration NOT applied. Run: node scripts/apply-migration.js');
    } else {
      console.log('\n✅ Migration already applied');
    }
  } finally {
    await connection.end();
  }
}

check().catch(console.error);
