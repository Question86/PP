// GET /api/creators - List all creators
// POST /api/creators - Register new creator
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createCreator, getCreatorByOwnerAddress } from '@/lib/db-creators';

export async function GET() {
  try {
    const creators = await query(
      'SELECT id, display_name, bio, payout_address, owner_address, created_at FROM creators ORDER BY id'
    );

    return NextResponse.json(creators);
  } catch (error) {
    console.error('Error fetching creators:', error);
    return NextResponse.json(
      { error: 'Failed to fetch creators' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: {
      ownerAddress: string;
      payoutAddress: string;
      displayName: string;
      bio?: string;
    } = await request.json();

    // Validation
    if (!body.ownerAddress || body.ownerAddress.trim().length === 0) {
      return NextResponse.json(
        { error: 'ownerAddress is required' },
        { status: 400 }
      );
    }

    if (!body.payoutAddress || body.payoutAddress.trim().length === 0) {
      return NextResponse.json(
        { error: 'payoutAddress is required' },
        { status: 400 }
      );
    }

    if (!body.displayName || body.displayName.trim().length === 0) {
      return NextResponse.json(
        { error: 'displayName is required' },
        { status: 400 }
      );
    }

    // Basic address format validation (Ergo addresses start with 9 and are ~40+ chars)
    if (body.ownerAddress.length < 40 || !body.ownerAddress.startsWith('9')) {
      return NextResponse.json(
        { error: 'Invalid ownerAddress format' },
        { status: 400 }
      );
    }

    if (body.payoutAddress.length < 40 || !body.payoutAddress.startsWith('9')) {
      return NextResponse.json(
        { error: 'Invalid payoutAddress format' },
        { status: 400 }
      );
    }

    // Check if owner_address already registered (enforce uniqueness)
    const existing = await getCreatorByOwnerAddress(body.ownerAddress);
    if (existing) {
      return NextResponse.json(
        {
          error: 'Creator already registered with this owner address',
          creatorId: existing.id,
        },
        { status: 409 }
      );
    }

    // Create creator
    const creatorId = await createCreator({
      owner_address: body.ownerAddress,
      display_name: body.displayName.trim(),
      payout_address: body.payoutAddress,
      bio: body.bio?.trim(),
    });

    return NextResponse.json(
      {
        creatorId,
        status: 'created',
        message: 'Creator registered successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating creator:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create creator' },
      { status: 500 }
    );
  }
}
