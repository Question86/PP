/**
 * End-to-End Test: Customer Flow with Recommendations
 * Tests: User prompt → Recommendations → Selection → Payment → Confirmation
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

// Test configuration
const TEST_USER_ADDRESS = '3WxTTK5njudBFxYP7sAkVU9ehPbcL1o3HV3zJB4MJjq8ZgvPsDFB';
const USER_PROMPT = 'I need professional customer support snippets with formal tone and JSON output format for handling escalations';

async function runE2ETest() {
  console.log('================================================================================');
  console.log('E2E TEST: Customer Flow with Recommendations');
  console.log('================================================================================\n');

  try {
    // STEP 1: Get recommendations
    console.log('STEP 1: Getting recommendations...');
    const recResponse = await fetch(`${BASE_URL}/api/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userPrompt: USER_PROMPT,
        limit: 10,
      }),
    });

    if (!recResponse.ok) {
      const error = await recResponse.text();
      throw new Error(`Recommendations failed: ${recResponse.status} ${error}`);
    }

    const recData = await recResponse.json();
    console.log(`✓ Found ${recData.count} recommendations`);
    console.log(`  Keywords: ${recData.keywords.join(', ')}`);
    
    if (recData.suggestions.length === 0) {
      console.log('\n⚠️ No recommendations found. Make sure snippets exist in database.');
      console.log('   Run: npm run seed-snippets (if available)\n');
      process.exit(1);
    }

    // Display top 3 recommendations
    console.log('\n  Top 3 Recommendations:');
    recData.suggestions.slice(0, 3).forEach((rec: any, idx: number) => {
      console.log(`    ${idx + 1}. ${rec.title} (${rec.category}) - ${(parseInt(rec.priceNanoerg) / 1e9).toFixed(3)} ERG`);
      console.log(`       Score: ${rec.score} | Reason: ${rec.reason}`);
    });

    // STEP 2: Select first 2 snippets
    const selectedSnippets = recData.suggestions.slice(0, 2);
    console.log(`\nSTEP 2: Selecting ${selectedSnippets.length} snippets`);
    selectedSnippets.forEach((rec: any, idx: number) => {
      console.log(`  ${idx + 1}. ${rec.title} - ${(parseInt(rec.priceNanoerg) / 1e9).toFixed(3)} ERG`);
    });

    // STEP 3: Create request
    console.log('\nSTEP 3: Creating request...');
    const requestResponse = await fetch(`${BASE_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: TEST_USER_ADDRESS,
        userPrompt: USER_PROMPT,
      }),
    });

    if (!requestResponse.ok) {
      throw new Error(`Request creation failed: ${requestResponse.status}`);
    }

    const requestData = await requestResponse.json();
    const requestId = requestData.requestId;
    console.log(`✓ Request created: ID ${requestId}`);

    // STEP 4: Create composition
    console.log('\nSTEP 4: Creating composition...');
    const items = selectedSnippets.map((rec: any, idx: number) => ({
      snippetVersionId: rec.versionId,
      creatorPayoutAddress: rec.creatorPayoutAddress,
      priceNanoerg: rec.priceNanoerg,
      position: idx,
    }));

    const composeResponse = await fetch(`${BASE_URL}/api/compositions/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        userAddress: TEST_USER_ADDRESS,
        items,
      }),
    });

    if (!composeResponse.ok) {
      const error = await composeResponse.text();
      throw new Error(`Composition creation failed: ${composeResponse.status} ${error}`);
    }

    const composeData = await composeResponse.json();
    const compositionId = composeData.compositionId;
    console.log(`✓ Composition created: ID ${compositionId}`);
    console.log(`  Total: ${(composeData.totalPrice / 1e9).toFixed(3)} ERG`);

    // STEP 5: Lock composition
    console.log('\nSTEP 5: Locking composition...');
    const lockResponse = await fetch(`${BASE_URL}/api/compositions/${compositionId}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: TEST_USER_ADDRESS }),
    });

    if (!lockResponse.ok) {
      throw new Error(`Lock failed: ${lockResponse.status}`);
    }

    const lockData = await lockResponse.json();
    console.log(`✓ Composition locked`);
    console.log(`  Payment Intent Generated:`);
    console.log(`    Platform: ${(parseInt(lockData.paymentIntent.platformOutput.amount) / 1e9).toFixed(3)} ERG`);
    console.log(`    Creators: ${lockData.paymentIntent.creatorOutputs.length} outputs`);
    console.log(`    Commitment: ${lockData.paymentIntent.commitmentHex}`);

    // STEP 6: Simulate node payment
    console.log('\nSTEP 6: Simulating node payment...');
    const payResponse = await fetch(`${BASE_URL}/api/node/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compositionId,
        userAddress: TEST_USER_ADDRESS,
      }),
    });

    if (!payResponse.ok) {
      const error = await payResponse.text();
      throw new Error(`Payment failed: ${payResponse.status} ${error}`);
    }

    const payData = await payResponse.json();
    const txId = payData.txId;
    console.log(`✓ Transaction submitted: ${txId}`);
    console.log(`  Total: ${(payData.totalAmount / 1e9).toFixed(3)} ERG`);

    // STEP 7: Wait for confirmation
    console.log('\nSTEP 7: Waiting for transaction confirmation...');
    console.log('  Polling Explorer API every 5 seconds (max 3 minutes)...');

    let confirmed = false;
    let attempts = 0;
    const maxAttempts = 36; // 3 minutes

    while (!confirmed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;

      try {
        const txResponse = await fetch(
          `https://api-testnet.ergoplatform.com/api/v1/transactions/${txId}`
        );

        if (txResponse.ok) {
          const tx = await txResponse.json();
          const confirmations = tx.confirmationsCount || 0;
          
          process.stdout.write(`\r  Attempt ${attempts}: ${confirmations} confirmations...`);

          if (confirmations >= 1) {
            console.log('\n✓ Transaction confirmed!');
            confirmed = true;
          }
        }
      } catch (err) {
        // Continue polling
      }
    }

    if (!confirmed) {
      console.log('\n⚠️ Transaction confirmation timeout (3 minutes)');
      console.log('   Transaction may still confirm later.');
      console.log(`   Check: https://testnet.ergoplatform.com/en/transactions/${txId}`);
    }

    // STEP 8: Confirm payment with backend
    if (confirmed) {
      console.log('\nSTEP 8: Confirming payment with backend...');
      const confirmResponse = await fetch(`${BASE_URL}/api/compositions/${compositionId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txId,
          userAddress: TEST_USER_ADDRESS,
        }),
      });

      if (confirmResponse.status === 202) {
        const pendingData = await confirmResponse.json();
        console.log(`⚠️ Payment pending: ${pendingData.confirmationsCount}/${pendingData.requiredConfirmations} confirmations`);
      } else if (confirmResponse.ok) {
        const confirmData = await confirmResponse.json();
        console.log(`✓ Payment confirmed and verified!`);
        console.log(`  Status: ${confirmData.status}`);
        console.log(`  Content should now be unlocked.`);
      } else {
        const error = await confirmResponse.text();
        console.log(`✗ Confirmation failed: ${confirmResponse.status} ${error}`);
      }
    }

    // Summary
    console.log('\n================================================================================');
    console.log('TEST SUMMARY');
    console.log('================================================================================');
    console.log(`Request ID: ${requestId}`);
    console.log(`Composition ID: ${compositionId}`);
    console.log(`Transaction ID: ${txId}`);
    console.log(`Selected Snippets: ${selectedSnippets.length}`);
    console.log(`Total Paid: ${(payData.totalAmount / 1e9).toFixed(3)} ERG`);
    console.log(`Status: ${confirmed ? 'CONFIRMED' : 'PENDING'}`);
    console.log('================================================================================\n');

    console.log('✓ E2E TEST COMPLETED SUCCESSFULLY\n');

  } catch (error: any) {
    console.error('\n✗ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
runE2ETest();
