// POST /api/compositions/[id]/confirm - Confirm payment transaction
import { NextRequest, NextResponse } from 'next/server';
import {
  getCompositionById,
  updateCompositionStatus,
  createPayment,
  updatePaymentStatus,
  getPaymentByTxId,
} from '@/lib/db-compositions';
import { verifyPayment } from '@/lib/explorer';
import { PLATFORM_ERGO_ADDRESS, PLATFORM_FEE_NANOERG } from '@/lib/config_v2';
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

    // Check status
    if (composition.status !== 'awaiting_payment') {
      return NextResponse.json(
        {
          error: `Composition is in ${composition.status} status`,
          currentStatus: composition.status,
        },
        { status: 400 }
      );
    }

    // Check if payment already exists
    const existingPayment = await getPaymentByTxId(txId);
    if (existingPayment) {
      return NextResponse.json(
        {
          error: 'Transaction already submitted',
          status: existingPayment.status,
        },
        { status: 409 }
      );
    }

    // Create payment record
    const paymentId = await createPayment({
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
