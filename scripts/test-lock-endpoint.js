const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function testLockEndpoint() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('Testing Payment Intent Generation...\n');
    
    // Fetch composition
    const [compositions] = await connection.query(
      'SELECT * FROM compositions WHERE id = ?',
      [3]
    );
    
    if (compositions.length === 0) {
      console.error('❌ Composition not found');
      return;
    }
    
    const composition = compositions[0];
    console.log('✓ Composition found:', composition);
    
    // Fetch composition items with aggregation
    const [items] = await connection.query(`
      SELECT 
        creator_payout_address,
        SUM(price_nanoerg) as total_nanoerg
      FROM composition_items
      WHERE composition_id = ?
      GROUP BY creator_payout_address
    `, [3]);
    
    console.log('\n✓ Aggregated Creator Payouts:');
    console.table(items);
    
    // Build payment intent
    const platformFee = composition.platform_fee_nanoerg;
    const platformAddress = process.env.PLATFORM_ERGO_ADDRESS;
    
    const paymentIntent = {
      platform: {
        address: platformAddress,
        amount: platformFee
      },
      creators: items.map(item => ({
        address: item.creator_payout_address,
        amount: item.total_nanoerg
      })),
      totalRequired: platformFee + items.reduce((sum, item) => sum + item.total_nanoerg, 0)
    };
    
    console.log('\n=== PAYMENT INTENT ===');
    console.log(JSON.stringify(paymentIntent, null, 2));
    
  } finally {
    await connection.end();
  }
}

testLockEndpoint().catch(console.error);
