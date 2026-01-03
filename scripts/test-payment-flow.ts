/**
 * Test script to verify complete payment flow
 * Snippet selection -> DB lookup -> Price aggregation -> Transaction building
 */

import { pool } from '../src/lib/db';
import { proposeComposition } from '../src/lib/selector';
import { getAggregatedCreatorPayouts } from '../src/lib/db-compositions';
import { computeCommitment } from '../src/lib/payments';
import { PLATFORM_ERGO_ADDRESS, PLATFORM_FEE_NANOERG } from '../src/lib/config_v2';
import type { PaymentIntent } from '../src/types/v2';

async function testPaymentFlow() {
  console.log('='.repeat(80));
  console.log('PAYMENT FLOW TEST');
  console.log('='.repeat(80));

  try {
    // Step 1: Check database setup
    console.log('\n1️⃣  Checking Database Setup...');
    const [creators] = await pool.execute(
      `SELECT c.id, c.display_name, c.payout_address, 
              COUNT(s.id) as snippet_count
       FROM creators c
       LEFT JOIN snippets s ON s.creator_id = c.id
       GROUP BY c.id`
    );
    console.log(`   Found ${(creators as any[]).length} creators:`);
    (creators as any[]).forEach((c: any) => {
      console.log(`   - ${c.display_name}: ${c.snippet_count} snippets, address: ${c.payout_address.slice(0, 20)}...`);
    });

    // Step 2: Check snippets with prices
    console.log('\n2️⃣  Checking Snippets & Prices...');
    const [snippets] = await pool.execute(
      `SELECT s.id, s.title, s.category, sv.id as version_id, 
              sv.price_nanoerg, c.payout_address, c.display_name
       FROM snippets s
       JOIN snippet_versions sv ON s.id = sv.snippet_id
       JOIN creators c ON s.creator_id = c.id
       WHERE s.status = 'published'`
    );
    console.log(`   Found ${(snippets as any[]).length} published snippets:`);
    (snippets as any[]).forEach((s: any) => {
      const priceErg = (parseInt(s.price_nanoerg) / 1e9).toFixed(3);
      console.log(`   - [${s.id}] ${s.title} (${s.category}): ${priceErg} ERG by ${s.display_name}`);
    });

    if ((snippets as any[]).length === 0) {
      console.log('\n❌ No snippets found! Run test_data_setup.sql first.');
      return;
    }

    // Step 3: Test composition proposal (simulates browse page)
    console.log('\n3️⃣  Testing Composition Proposal...');
    const testPrompt = 'Help me with Python development and code review';
    console.log(`   Prompt: "${testPrompt}"`);
    
    const selection = await proposeComposition(testPrompt);
    console.log(`   Selected ${selection.candidates.length} snippets:`);
    
    let totalPrice = BigInt(0);
    selection.candidates.forEach((candidate, i) => {
      const priceErg = (parseInt(candidate.price_nanoerg) / 1e9).toFixed(3);
      totalPrice += BigInt(candidate.price_nanoerg);
      console.log(`   ${i + 1}. ${candidate.snippet_title}: ${priceErg} ERG`);
    });

    const snippetsTotal = Number(totalPrice);
    const grandTotal = snippetsTotal + Number(PLATFORM_FEE_NANOERG);
    console.log(`   Snippets total: ${(snippetsTotal / 1e9).toFixed(3)} ERG`);
    console.log(`   Platform fee: ${(Number(PLATFORM_FEE_NANOERG) / 1e9).toFixed(3)} ERG`);
    console.log(`   Grand total: ${(grandTotal / 1e9).toFixed(3)} ERG`);

    // Step 4: Simulate composition creation
    console.log('\n4️⃣  Simulating Composition Creation...');
    const snippetVersionIds = selection.candidates.map(c => c.snippet_version_id);
    const placeholders = snippetVersionIds.map(() => '?').join(',');
    
    const [payoutData] = await pool.execute(
      `SELECT sv.id as snippet_version_id, c.payout_address, c.display_name
       FROM snippet_versions sv
       INNER JOIN snippets s ON s.id = sv.snippet_id
       INNER JOIN creators c ON c.id = s.creator_id
       WHERE sv.id IN (${placeholders})`,
      snippetVersionIds
    );

    console.log(`   Resolved payout addresses for ${(payoutData as any[]).length} snippets:`);
    (payoutData as any[]).forEach((p: any) => {
      console.log(`   - Version ${p.snippet_version_id} -> ${p.display_name}: ${p.payout_address.slice(0, 25)}...`);
    });

    // Step 5: Test payment intent generation (simulates lock endpoint)
    console.log('\n5️⃣  Testing Payment Intent Generation...');
    
    // Mock composition ID for testing
    const mockCompositionId = 999;
    
    // For testing, manually create aggregated payouts
    const payoutMap = new Map<string, { amount: bigint, snippetCount: number, versionIds: number[] }>();
    
    selection.candidates.forEach((candidate) => {
      const payoutInfo = (payoutData as any[]).find(p => p.snippet_version_id === candidate.snippet_version_id);
      if (!payoutInfo) {
        throw new Error(`Missing payout info for version ${candidate.snippet_version_id}`);
      }
      
      const addr = payoutInfo.payout_address;
      const price = BigInt(candidate.price_nanoerg);
      
      if (!payoutMap.has(addr)) {
        payoutMap.set(addr, { amount: BigInt(0), snippetCount: 0, versionIds: [] });
      }
      
      const existing = payoutMap.get(addr)!;
      existing.amount += price;
      existing.snippetCount += 1;
      existing.versionIds.push(candidate.snippet_version_id);
    });

    console.log(`   Aggregated payouts to ${payoutMap.size} unique creators:`);
    const creatorOutputs: any[] = [];
    payoutMap.forEach((info, address) => {
      const amountErg = (Number(info.amount) / 1e9).toFixed(3);
      console.log(`   - ${address.slice(0, 25)}...: ${amountErg} ERG (${info.snippetCount} snippets, versions: ${info.versionIds.join(',')})`);
      
      creatorOutputs.push({
        address,
        amount: info.amount.toString(),
        snippetCount: info.snippetCount,
        snippetVersionIds: info.versionIds,
      });
    });

    // Build payment intent
    const paymentIntent: PaymentIntent = {
      compositionId: mockCompositionId,
      platformOutput: {
        address: PLATFORM_ERGO_ADDRESS,
        amount: PLATFORM_FEE_NANOERG.toString(),
      },
      creatorOutputs,
      memo: mockCompositionId.toString(),
      totalRequired: grandTotal.toString(),
      estimatedFee: '1000000', // 0.001 ERG
      protocolVersion: 1,
    };

    // Step 6: Compute R4 commitment
    console.log('\n6️⃣  Computing R4 Commitment...');
    const commitmentHex = computeCommitment(paymentIntent);
    paymentIntent.commitmentHex = commitmentHex;
    
    console.log(`   Protocol version: ${paymentIntent.protocolVersion}`);
    console.log(`   Commitment hash: ${commitmentHex}`);
    console.log(`   Platform output: ${PLATFORM_ERGO_ADDRESS.slice(0, 25)}... (${(Number(PLATFORM_FEE_NANOERG) / 1e9).toFixed(3)} ERG)`);
    console.log(`   Creator outputs: ${creatorOutputs.length}`);
    console.log(`   Total required: ${(Number(paymentIntent.totalRequired) / 1e9).toFixed(3)} ERG`);
    console.log(`   Estimated fee: ${(Number(paymentIntent.estimatedFee) / 1e9).toFixed(3)} ERG`);

    // Step 7: Verify payment intent structure
    console.log('\n7️⃣  Verifying Payment Intent Structure...');
    
    // Check all creator outputs have addresses
    const missingAddresses = creatorOutputs.filter(o => !o.address || o.address.length < 30);
    if (missingAddresses.length > 0) {
      console.log(`   ❌ ERROR: ${missingAddresses.length} outputs missing valid addresses!`);
      missingAddresses.forEach(o => console.log(`      ${JSON.stringify(o)}`));
      return;
    }
    console.log(`   ✅ All ${creatorOutputs.length} creator outputs have valid addresses`);

    // Check all outputs have amounts
    const missingAmounts = creatorOutputs.filter(o => !o.amount || BigInt(o.amount) <= 0);
    if (missingAmounts.length > 0) {
      console.log(`   ❌ ERROR: ${missingAmounts.length} outputs missing valid amounts!`);
      return;
    }
    console.log(`   ✅ All creator outputs have valid amounts`);

    // Check snippet version IDs are included
    const totalSnippetIds = creatorOutputs.reduce((sum, o) => sum + o.snippetVersionIds.length, 0);
    console.log(`   ✅ Total snippet version IDs: ${totalSnippetIds}`);

    // Step 8: Summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ PAYMENT FLOW TEST PASSED');
    console.log('='.repeat(80));
    console.log(`
Summary:
  - Creators: ${(creators as any[]).length}
  - Published Snippets: ${(snippets as any[]).length}
  - Selected Snippets: ${selection.candidates.length}
  - Unique Creator Outputs: ${creatorOutputs.length}
  - Total Payment: ${(grandTotal / 1e9).toFixed(3)} ERG
  - R4 Commitment: ${commitmentHex.slice(0, 16)}...
  
Next Step: Test actual transaction building in payment page with Nautilus wallet
    `);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run test
testPaymentFlow().catch(console.error);
