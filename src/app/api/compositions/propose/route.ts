// POST /api/compositions/propose - Propose snippet composition
import { NextRequest, NextResponse } from 'next/server';
import { getRequestById } from '@/lib/db-compositions';
import {
  createComposition,
  createCompositionItems,
} from '@/lib/db-compositions';
import { proposeComposition } from '@/lib/selector';
import { PLATFORM_FEE_NANOERG } from '@/lib/config_v2';
import { pool } from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import type {
  ProposeCompositionRequest,
  ProposeCompositionResponse,
} from '@/types/v2';

export async function POST(request: NextRequest) {
  try {
    const body: ProposeCompositionRequest = await request.json();

    // Validate request ID
    if (!body.requestId || isNaN(body.requestId)) {
      return NextResponse.json(
        { error: 'Valid request ID is required' },
        { status: 400 }
      );
    }

    // Get request
    const userRequest = await getRequestById(body.requestId);
    if (!userRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    // Run selection algorithm
    const selection = await proposeComposition(userRequest.user_prompt);

    if (selection.candidates.length === 0) {
      return NextResponse.json(
        {
          error: 'No suitable snippets found for your prompt',
          suggestion: 'Try rephrasing or check back later for new snippets',
        },
        { status: 404 }
      );
    }

    // Calculate totals
    const snippetsTotal = selection.total_price_nanoerg;
    const platformFee = PLATFORM_FEE_NANOERG;
    const grandTotal = snippetsTotal + platformFee;

    // Create composition
    const compositionId = await createComposition({
      request_id: body.requestId,
      user_address: userRequest.user_address,
      total_price_nanoerg: grandTotal,
      platform_fee_nanoerg: platformFee,
    });

    // Get creator payout addresses for ALL snippets in ONE query (no N+1)
    const snippetVersionIds = selection.candidates.map(c => c.snippet_version_id);
    const placeholders = snippetVersionIds.map(() => '?').join(',');
    
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT sv.id as snippet_version_id, c.payout_address
       FROM snippet_versions sv
       INNER JOIN snippets s ON s.id = sv.snippet_id
       INNER JOIN creators c ON c.id = s.creator_id
       WHERE sv.id IN (${placeholders})`,
      snippetVersionIds
    );

    // Build map: snippet_version_id -> payout_address
    const payoutMap = new Map<number, string>();
    for (const row of rows) {
      payoutMap.set(row.snippet_version_id, row.payout_address);
    }

    // Verify all selected snippets have creator addresses (fail fast if missing)
    for (const candidate of selection.candidates) {
      if (!payoutMap.has(candidate.snippet_version_id)) {
        throw new Error(
          `Creator not found for snippet version ${candidate.snippet_version_id}`
        );
      }
    }

    // Build composition items with resolved payout addresses
    const itemsWithCreators = selection.candidates.map((candidate, index) => ({
      composition_id: compositionId,
      snippet_version_id: candidate.snippet_version_id,
      creator_payout_address: payoutMap.get(candidate.snippet_version_id)!,
      price_nanoerg: candidate.price_nanoerg,
      position: index,
    }));

    // Create composition items
    await createCompositionItems(itemsWithCreators);

    // Build response
    const response: ProposeCompositionResponse = {
      compositionId,
      items: selection.candidates.map((candidate) => ({
        snippetTitle: candidate.snippet_title,
        snippetSummary: candidate.snippet_summary,
        creatorName: 'Creator', // TODO: Get from DB
        priceNanoerg: candidate.price_nanoerg,
        category: candidate.snippet_category,
        rationale: candidate.rationale,
      })),
      totals: {
        snippetsTotal: snippetsTotal.toString(),
        platformFee: platformFee.toString(),
        grandTotal: grandTotal.toString(),
      },
      status: 'proposed',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error proposing composition:', error);
    return NextResponse.json(
      { error: 'Failed to propose composition' },
      { status: 500 }
    );
  }
}
