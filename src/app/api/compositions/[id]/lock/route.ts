// POST /api/compositions/[id]/lock - Lock composition and get payment intent
import { NextRequest, NextResponse } from 'next/server';
import {
  getCompositionById,
  updateCompositionStatus,
  getAggregatedCreatorPayouts,
} from '@/lib/db-compositions';
import { PLATFORM_ERGO_ADDRESS, PLATFORM_FEE_NANOERG } from '@/lib/config_v2';
import type { LockCompositionRequest, LockCompositionResponse } from '@/types/v2';

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

    const body: LockCompositionRequest = await request.json();

    // Validate user address
    if (!body.userAddress || body.userAddress.trim().length < 10) {
      return NextResponse.json(
        { error: 'Valid user address is required' },
        { status: 400 }
      );
    }

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
    if (composition.status !== 'proposed') {
      return NextResponse.json(
        {
          error: `Cannot lock composition in ${composition.status} status`,
          currentStatus: composition.status,
        },
        { status: 400 }
      );
    }

    // Get aggregated creator payouts
    const creatorPayouts = await getAggregatedCreatorPayouts(compositionId);

    // Build payment intent
    const paymentIntent = {
      compositionId,
      platformOutput: {
        address: PLATFORM_ERGO_ADDRESS,
        amount: PLATFORM_FEE_NANOERG.toString(),
      },
      creatorOutputs: creatorPayouts.map((payout) => ({
        address: payout.creator_address,
        amount: payout.total_amount,
        snippetCount: payout.snippet_count,
        snippetVersionIds: payout.snippet_version_ids,
      })),
      memo: compositionId.toString(),
      totalRequired: composition.total_price_nanoerg,
      estimatedFee: '1000000', // 0.001 ERG
    };

    // Update composition status to awaiting_payment
    await updateCompositionStatus(compositionId, 'awaiting_payment');

    const response: LockCompositionResponse = {
      paymentIntent,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error locking composition:', error);
    return NextResponse.json(
      { error: 'Failed to lock composition' },
      { status: 500 }
    );
  }
}
