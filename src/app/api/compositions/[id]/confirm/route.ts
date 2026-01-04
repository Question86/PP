// POST /api/compositions/[id]/confirm - Confirm payment transaction
import { NextRequest, NextResponse } from 'next/server';
import {
  getCompositionById,
  updateCompositionStatus,
  createPayment,
  updatePaymentStatus,
  getPaymentByTxId,
  upsertPayment,
} from '@/lib/db-compositions';
import { verifyPayment, getTransaction } from '@/lib/explorer';
import { PLATFORM_ERGO_ADDRESS, PLATFORM_FEE_NANOERG, MIN_CONFIRMATIONS } from '@/lib/config_v2';
import { pool } from '@/lib/db';
import { computeCommitment } from '@/lib/payments';
import type { RowDataPacket } from 'mysql2';
import type { ConfirmPaymentRequest, ConfirmPaymentResponse, PaymentIntent } from '@/types/v2';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const compositionId = parseInt(params.id);
    if (isNaN(compositionId)) {
      return NextResponse.json(
        { error: 'Invalid composition ID' },
        { status: 400 }
      );
    }

    const body: ConfirmPaymentRequest = await request.json();

    // Validate txId
    if (!body.txId || body.txId.trim().length < 32) {
      return NextResponse.json(
        { error: 'Valid transaction ID is required' },
        { status: 400 }
      );
    }

    // Validate user address
    if (!body.userAddress || body.userAddress.trim().length < 10) {
      return NextResponse.json(
        { error: 'Valid user address is required' },
        { status: 400 }
      );
    }

    const txId = body.txId.trim();

    // Get composition
    const composition = await getCompositionById(compositionId);
    if (!composition) {
      return NextResponse.json(
        { error: 'Composition not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (composition.user_address.toLowerCase() !== body.userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Forbidden: Not your composition' },
        { status: 403 }
      );
    }

    // Check status - allow awaiting_payment or paid with same txId
    if (composition.status === 'paid' && composition.tx_id !== txId) {
      return NextResponse.json(
        {
          error: 'Composition already paid with different transaction',
          existingTxId: composition.tx_id,
        },
        { status: 409 }
      );
    }

    if (composition.status !== 'awaiting_payment' && composition.status !== 'paid') {
      return NextResponse.json(
        {
          error: `Composition is in ${composition.status} status`,
          currentStatus: composition.status,
        },
        { status: 400 }
      );
    }

    // Check confirmations FIRST - Fetch tx from Explorer
    const tx = await getTransaction(txId);
    if (!tx) {
      return NextResponse.json(
        { error: 'Transaction not found on Explorer' },
        { status: 404 }
      );
    }

    console.log(`[Confirm] Transaction ${txId} has ${tx.confirmationsCount} confirmations (required: ${MIN_CONFIRMATIONS})`);

    // If not enough confirmations, return 202 Accepted with pending status
    if (tx.confirmationsCount < MIN_CONFIRMATIONS) {
      // Upsert payment record with status='submitted' if not exists
      await upsertPayment({
        composition_id: compositionId,
        tx_id: txId,
      });

      return NextResponse.json(
        {
          status: 'pending',
          confirmationsCount: tx.confirmationsCount,
          requiredConfirmations: MIN_CONFIRMATIONS,
          message: `Transaction pending: ${tx.confirmationsCount}/${MIN_CONFIRMATIONS} confirmations`,
        },
        { status: 202 }
      );
    }

    // Transaction is confirmed - proceed with verification
    // Check if payment already confirmed
    const existingPayment = await getPaymentByTxId(txId);
    if (existingPayment && existingPayment.status === 'confirmed') {
      return NextResponse.json({
        ok: true,
        status: 'paid',
        message: 'Payment already confirmed',
      });
    }

    // Upsert payment record (will be updated to confirmed below)
    await upsertPayment({
      composition_id: compositionId,
      tx_id: txId,
    });

    // Build payment intent for verification - ONLY source: composition_items
    const [itemRows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        creator_payout_address,
        SUM(price_nanoerg) as total_amount,
        COUNT(*) as snippet_count,
        JSON_ARRAYAGG(snippet_version_id) as snippet_version_ids
       FROM composition_items
       WHERE composition_id = ?
       GROUP BY creator_payout_address`,
      [compositionId]
    );

    if (itemRows.length === 0) {
      throw new Error('No composition items found - cannot verify payment');
    }

    const paymentIntent: PaymentIntent = {
      compositionId,
      platformOutput: {
        address: PLATFORM_ERGO_ADDRESS,
        amount: PLATFORM_FEE_NANOERG.toString(),
      },
      creatorOutputs: itemRows.map((row) => ({
        address: row.creator_payout_address,
        amount: row.total_amount.toString(),
        snippetCount: row.snippet_count,
        snippetVersionIds: JSON.parse(row.snippet_version_ids || '[]'),
      })),
      memo: compositionId.toString(),
      totalRequired: composition.total_price_nanoerg,
      estimatedFee: '1000000',
      protocolVersion: 1,
    };

    // Compute expected commitment
    const commitmentHex = computeCommitment(paymentIntent);
    paymentIntent.commitmentHex = commitmentHex;

    // Verify transaction (STRICT MODE: requireCommitment=true)
    const verificationResult = await verifyPayment(txId, paymentIntent, {
      requireCommitment: true,
    });

    if (verificationResult.valid) {
      // Mark as confirmed
      await updatePaymentStatus(txId, 'confirmed');
      await updateCompositionStatus(compositionId, 'paid', txId);

      const response: ConfirmPaymentResponse = {
        ok: true,
        status: 'paid',
        verificationDetails: {
          platformOutputVerified: verificationResult.platformOutputValid,
          creatorOutputsVerified: verificationResult.creatorOutputsValid,
          registersVerified: verificationResult.registersValid,
        },
      };

      return NextResponse.json(response);
    } else {
      // Mark as rejected
      await updatePaymentStatus(txId, 'rejected');
      await updateCompositionStatus(compositionId, 'failed');

      const response: ConfirmPaymentResponse = {
        ok: false,
        status: 'failed',
        verificationDetails: {
          platformOutputVerified: verificationResult.platformOutputValid,
          creatorOutputsVerified: verificationResult.creatorOutputsValid,
          registersVerified: verificationResult.registersValid,
        },
      };

      return NextResponse.json(response, { status: 400 });
    }
  } catch (error) {
    console.error('Error confirming payment:', error);
    return NextResponse.json(
      { error: 'Failed to confirm payment' },
      { status: 500 }
    );
  }
}
