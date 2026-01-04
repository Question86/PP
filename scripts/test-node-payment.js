// Test script for Node Wallet Payment Channel
// Tests end-to-end payment flow using local Ergo node wallet

require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function testNodePayment() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('\n=== NODE WALLET PAYMENT TEST ===\n');
    
    // Step 1: Create test composition in awaiting_payment state
    console.log('Step 1: Creating test composition...');
    
    const userAddress = '3WxTTK5njudBFxYP7sAkVU9ehPbcL1o3HV3zJB4MJjq8ZgvPsDFB';
    const platformAddress = '3Ww6Lw9R3838PtQ7ymHuADP4BrSkDK3W8Py7yWL8tCKL6UX13vmZ';
    const creatorAddress = '3WwFvKjMDws93LvrW5sP2pPE5x5fPGX1KFNYbFjYt1V91PqVUaPz';
    
    // Create request
    const [reqResult] = await connection.execute(
      `INSERT INTO requests (user_address, user_prompt) VALUES (?, ?)`,
      [userAddress, 'Test node payment']
    );
    const requestId = reqResult.insertId;
    
    // Create composition
    const totalPrice = 26250000; // 0.02625 ERG
    const platformFee = 1250000; // 0.00125 ERG
    
    const [compResult] = await connection.execute(
      `INSERT INTO compositions (request_id, user_address, total_price_nanoerg, platform_fee_nanoerg, status)
       VALUES (?, ?, ?, ?, 'proposed')`,
      [requestId, userAddress, totalPrice, platformFee]
    );
    const compositionId = compResult.insertId;
    
    // Create composition items (snippets)
    await connection.execute(
      `INSERT INTO composition_items (composition_id, snippet_version_id, price_nanoerg, creator_payout_address)
       VALUES (?, 1, 10000000, ?), (?, 2, 15000000, ?)`,
      [compositionId, creatorAddress, compositionId, creatorAddress]
    );
    
    console.log(`✓ Created composition ${compositionId}`);
    console.log(`  User: ${userAddress}`);
    console.log(`  Total: ${totalPrice} nanoERG (${(totalPrice / 1e9).toFixed(8)} ERG)`);
    
    // Step 2: Lock composition to generate payment intent
    console.log('\nStep 2: Locking composition (generate payment intent)...');
    
    const lockResponse = await fetch(`http://localhost:3000/api/compositions/${compositionId}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress })
    });
    
    if (!lockResponse.ok) {
      const error = await lockResponse.text();
      throw new Error(`Lock failed: ${error}`);
    }
    
    const lockResult = await lockResponse.json();
    console.log(`✓ Composition locked`);
    console.log(`  Platform: ${lockResult.paymentIntent.platformOutput.amount} nanoERG`);
    console.log(`  Creators: ${lockResult.paymentIntent.creatorOutputs.length} output(s)`);
    
    // Step 3: Call node payment endpoint
    console.log('\nStep 3: Calling /api/node/pay...');
    
    const payResponse = await fetch('http://localhost:3000/api/node/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compositionId,
        userAddress
      })
    });
    
    if (!payResponse.ok) {
      const error = await payResponse.text();
      throw new Error(`Payment failed: ${error}`);
    }
    
    const payResult = await payResponse.json();
    console.log(`✓ Payment submitted`);
    console.log(`  TxID: ${payResult.txId}`);
    console.log(`  Recipients: ${payResult.recipients}`);
    console.log(`  Total Amount: ${payResult.totalAmount} nanoERG`);
    
    const txId = payResult.txId;
    
    // Step 4: Wait for transaction to appear on Explorer (2-3 minutes)
    console.log('\nStep 3: Waiting for transaction confirmation...');
    console.log('(This may take 2-4 minutes on testnet)');
    
    let confirmed = false;
    let attempts = 0;
    const maxAttempts = 40; // 40 * 5s = 200s = ~3.3 minutes
    
    while (!confirmed && attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      try {
        const explorerResponse = await fetch(
          `https://api-testnet.ergoplatform.com/api/v1/transactions/${txId}`
        );
        
        if (explorerResponse.ok) {
          const tx = await explorerResponse.json();
          if (tx.confirmationsCount >= 1) {
            console.log(`✓ Transaction confirmed! (${tx.confirmationsCount} confirmations)`);
            confirmed = true;
          } else {
            process.stdout.write(`  Attempt ${attempts}/${maxAttempts}: In mempool, waiting for block...\r`);
          }
        } else if (explorerResponse.status === 404) {
          process.stdout.write(`  Attempt ${attempts}/${maxAttempts}: Not yet in Explorer...\r`);
        }
      } catch (error) {
        process.stdout.write(`  Attempt ${attempts}/${maxAttempts}: Explorer check failed, retrying...\r`);
      }
    }
    
    if (!confirmed) {
      console.log('\n⚠️  Transaction not confirmed within timeout, but may still succeed');
      console.log(`   Check manually: https://testnet.ergoplatform.com/en/transactions/${txId}`);
    }
    
    // Step 5: Call confirm endpoint
    console.log('\nStep 5: Confirming payment...');
    
    const confirmResponse = await fetch(`http://localhost:3000/api/compositions/${compositionId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txId,
        userAddress
      })
    });
    
    if (!confirmResponse.ok) {
      const error = await confirmResponse.text();
      throw new Error(`Confirmation failed: ${error}`);
    }
    
    const confirmResult = await confirmResponse.json();
    console.log(`✓ Payment confirmed`);
    console.log(`  Valid: ${confirmResult.valid}`);
    console.log(`  Platform Output Valid: ${confirmResult.platformOutputValid}`);
    console.log(`  Creator Outputs Valid: ${confirmResult.creatorOutputsValid}`);
    
    // Step 6: Verify composition status
    console.log('\nStep 6: Verifying composition status...');
    
    const [rows] = await connection.execute(
      `SELECT status, tx_id FROM compositions WHERE id = ?`,
      [compositionId]
    );
    
    const composition = rows[0];
    console.log(`✓ Composition status: ${composition.status}`);
    console.log(`  Transaction ID: ${composition.tx_id}`);
    
    if (composition.status === 'paid') {
      console.log('\n✅ NODE WALLET PAYMENT TEST PASSED');
      console.log(`\nTransaction: https://testnet.ergoplatform.com/en/transactions/${txId}`);
    } else {
      console.log('\n⚠️  Status not "paid", may need more confirmations');
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run test
testNodePayment().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
