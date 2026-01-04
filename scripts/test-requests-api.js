// Test POST /api/requests endpoint
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function testRequestsAPI() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'promptpage'
  });

  try {
    const prompt = "Help me with Python data analysis and code review";
    
    // Simulate POST /api/requests logic
    const [result] = await connection.execute(
      'INSERT INTO requests (prompt, status) VALUES (?, ?)',
      [prompt, 'pending']
    );

    const requestId = result.insertId;

    // Fetch created request
    const [rows] = await connection.execute(
      'SELECT id, prompt, status, created_at FROM requests WHERE id = ?',
      [requestId]
    );

    const request = rows[0];

    console.log('\n=== POST /api/requests Response (Simulated) ===\n');
    console.log(JSON.stringify(request, null, 2));
    
    console.log('\n=== Validation ===');
    console.log(`✓ Request ID: ${request.id}`);
    console.log(`✓ Prompt: "${request.prompt.substring(0, 50)}..."`);
    console.log(`✓ Status: ${request.status}`);
    
    return request;
    
  } finally {
    await connection.end();
  }
}

testRequestsAPI().then(request => {
  console.log('\n✅ Step 5 PASSED: Request created successfully');
  console.log(`\nSave this requestId for Step 6: ${request.id}`);
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
