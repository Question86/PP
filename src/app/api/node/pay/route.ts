/**
 * POST /api/node/pay
 * Server-side payment via local Ergo node wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { NodeWalletClient } from '@/lib/node-wallet-client';
import { getCompositionById, updateComposition } from '@/lib/db-compositions';

export async function POST(request: NextRequest) {
  try {
    const { compositionId, userAddress } = await request.json();

    // Validate input
    if (!compositionId || !userAddress) {
      return NextResponse.json(
        { error: 'compositionId and userAddress are required' },
        { status: 400 }
      );
    }

    console.log(`[Node Payment] Processing composition ${compositionId} for user ${userAddress}`);

    // 1. Fetch composition
    const composition = await getCompositionById(compositionId);
    if (!composition) {
      return NextResponse.json(
        { error: 'Composition not found' },
        { status: 404 }
      );
    }

    // 2. Verify ownership (case-insensitive)
    if (composition.user_address.toLowerCase() !== userAddress.toLowerCase()) {
      console.error(`[Node Payment] Ownership mismatch: ${composition.user_address} !== ${userAddress}`);
      return NextResponse.json(
        { error: 'Unauthorized: composition does not belong to user' },
        { status: 403 }
      );
    }

    // 3. Verify status
    if (composition.status !== 'awaiting_payment') {
      console.error(`[Node Payment] Invalid status: ${composition.status}`);
      return NextResponse.json(
        { error: `Composition status is ${composition.status}, expected awaiting_payment` },
        { status: 400 }
      );
    }

    // 4. Regenerate payment intent from composition
    const { getAggregatedCreatorPayouts } = await import('@/lib/db-compositions');
    const { PLATFORM_ERGO_ADDRESS, PLATFORM_FEE_NANOERG } = await import('@/lib/config_v2');
    
    const creatorPayouts = await getAggregatedCreatorPayouts(compositionId);
    
    const paymentIntent = {
      platformOutput: {
        address: PLATFORM_ERGO_ADDRESS,
        amount: PLATFORM_FEE_NANOERG.toString(),
      },
      creatorOutputs: creatorPayouts.map((payout: any) => ({
        address: payout.creator_address,
        amount: payout.total_amount,
      })),
    };

    console.log(`[Node Payment] Payment intent:`, paymentIntent);

    // 5. Build recipients list
    const recipients = [
      {
        address: paymentIntent.platformOutput.address,
        value: parseInt(paymentIntent.platformOutput.amount),
      },
      ...paymentIntent.creatorOutputs.map((c: any) => ({
        address: c.address,
        value: parseInt(c.amount),
      })),
    ];

    console.log(`[Node Payment] Recipients:`, recipients);

    // 6. Initialize node wallet client
    const nodeWallet = new NodeWalletClient();

    // Validate recipients
    nodeWallet.validateRecipients(recipients);

    // Check wallet status
    const status = await nodeWallet.getStatus();
    console.log(`[Node Payment] Wallet status:`, status);

    if (!status.isUnlocked) {
      return NextResponse.json(
        { error: 'Node wallet is locked. Please unlock it first.' },
        { status: 503 }
      );
    }

    // Check balance
    const balance = await nodeWallet.getBalance();
    const totalRequired = recipients.reduce((sum, r) => sum + r.value, 0) + 1000000; // +1M for fee
    console.log(`[Node Payment] Balance: ${balance.balance} nanoERG, Required: ${totalRequired} nanoERG`);

    if (balance.balance < totalRequired) {
      return NextResponse.json(
        {
          error: 'Insufficient funds in node wallet',
          balance: balance.balance,
          required: totalRequired,
        },
        { status: 400 }
      );
    }

    // 7. Send transaction
    console.log(`[Node Payment] Sending transaction...`);
    const txId = await nodeWallet.sendTransaction(recipients, 1000000);
    console.log(`[Node Payment] Transaction submitted: ${txId}`);

    // 8. Create payment record with status='submitted'
    const { upsertPayment } = await import('@/lib/db-compositions');
    await upsertPayment({
      composition_id: compositionId,
      tx_id: txId,
    });
    console.log(`[Node Payment] Payment record created for composition ${compositionId}`);

    // 9. Return txId (confirmation will be handled by /confirm endpoint after confirmations)
    return NextResponse.json({
      txId,
      message: 'Transaction submitted successfully',
      recipients: recipients.length,
      totalAmount: recipients.reduce((sum, r) => sum + r.value, 0),
    });

  } catch (error: any) {
    console.error('[Node Payment] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Payment failed',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
