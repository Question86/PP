/**
 * POST /api/prompts/[id]/confirm
 * Confirms a mint transaction and updates prompt status
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPromptById, updatePromptMintStatus } from '@/lib/db-prompts';
import { ConfirmMintRequest, ConfirmMintResponse } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const promptId = parseInt(params.id, 10);

    if (isNaN(promptId)) {
      return NextResponse.json(
        { error: 'Invalid prompt ID' },
        { status: 400 }
      );
    }

    const body: ConfirmMintRequest = await request.json();
    const { txId, tokenId } = body;

    if (!txId || typeof txId !== 'string') {
      return NextResponse.json(
        { error: 'txId is required and must be a string' },
        { status: 400 }
      );
    }

    // Verify prompt exists
    const prompt = await getPromptById(promptId);
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt not found' },
        { status: 404 }
      );
    }

    // Update status to mint_pending
    // In production, you would:
    // 1. Query explorer API to verify tx exists
    // 2. Verify R4 register contains the correct hash
    // 3. Only then set status to 'minted'
    // For MVP, we'll trust the client and set to mint_pending
    await updatePromptMintStatus(promptId, 'mint_pending', txId, tokenId);

    const response: ConfirmMintResponse = {
      ok: true,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error confirming mint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
