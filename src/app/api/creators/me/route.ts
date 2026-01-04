// GET /api/creators/me?ownerAddress=... - Get creator dashboard data
import { NextRequest, NextResponse } from 'next/server';
import {
  getCreatorByOwnerAddress,
  getSnippetsByCreator,
  getCreatorEarnings,
} from '@/lib/db-creators';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerAddress = searchParams.get('ownerAddress');

    // Validation
    if (!ownerAddress || ownerAddress.trim().length === 0) {
      return NextResponse.json(
        { error: 'ownerAddress query parameter required' },
        { status: 400 }
      );
    }

    // Find creator by owner address
    const creator = await getCreatorByOwnerAddress(ownerAddress);
    if (!creator) {
      return NextResponse.json(
        { error: 'Creator not found. Please register first.' },
        { status: 404 }
      );
    }

    // Get creator's snippets
    const snippets = await getSnippetsByCreator(creator.id);

    // Get earnings
    const earnings = await getCreatorEarnings(creator.id);

    return NextResponse.json({
      creator: {
        id: creator.id,
        display_name: creator.display_name,
        owner_address: creator.owner_address,
        payout_address: creator.payout_address,
        bio: creator.bio,
        created_at: creator.created_at,
      },
      snippets: snippets.map((s) => ({
        id: s.id,
        title: s.title,
        summary: s.summary,
        category: s.category,
        status: s.status,
        created_at: s.created_at,
      })),
      earnings: {
        total_earned_nanoerg: earnings.total_earned,
        total_earned_erg: (parseInt(earnings.total_earned) / 1e9).toFixed(6),
        confirmed_payments: earnings.confirmed_payments,
        pending_payments: earnings.pending_payments,
      },
    });
  } catch (error: any) {
    console.error('Error fetching creator dashboard:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard' },
      { status: 500 }
    );
  }
}
