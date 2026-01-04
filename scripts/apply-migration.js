// Apply owner_address migration to creators table
require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '002_add_creator_owner_address.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the entire migration as multi-statement query
    console.log('Executing migration SQL...\n');
    
    // Remove comments and split into individual statements
    const cleanSQL = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    const statements = cleanSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip USE database statements (already connected to correct DB)
      if (statement.toUpperCase().startsWith('USE ')) {
        console.log(`⊘ [${i + 1}/${statements.length}] Skipping USE statement (already connected)`);
        continue;
      }
      
      try {
        if (statement.toUpperCase().includes('SELECT')) {
          // Execute verification query and display results
          const [rows] = await connection.execute(statement);
          console.log('\n=== VERIFICATION RESULTS ===');
          console.table(rows);
        } else {
          await connection.execute(statement);
          const preview = statement.substring(0, 70).replace(/\s+/g, ' ');
          console.log(`✓ [${i + 1}/${statements.length}]`, preview + '...');
        }
      } catch (error) {
        console.error(`❌ Failed at statement ${i + 1}:`, error.message);
        console.error('Statement:', statement.substring(0, 200));
        throw error;
      }
    }
    
    console.log('\n✅ Migration applied successfully!');
    
    // Final verification
    console.log('\n=== FINAL STRUCTURE CHECK ===');
    const [cols] = await connection.execute('DESCRIBE creators');
    const ownerAddressCol = cols.find(c => c.Field === 'owner_address');
    
    if (ownerAddressCol) {
      console.log('✅ owner_address column exists');
      console.log('   Type:', ownerAddressCol.Type);
      console.log('   Null:', ownerAddressCol.Null);
      console.log('   Key:', ownerAddressCol.Key);
    } else {
      console.error('❌ owner_address column NOT found after migration!');
      process.exit(1);
    }
    
    const [indexes] = await connection.execute(
      "SHOW INDEX FROM creators WHERE Key_name = 'unique_owner_address'"
    );
    console.log(`✅ Unique constraint exists: ${indexes.length > 0 ? 'YES' : 'NO'}`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

applyMigration();
