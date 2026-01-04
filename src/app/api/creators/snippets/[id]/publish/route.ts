// POST /api/creators/snippets/[id]/publish - Publish snippet
import { NextRequest, NextResponse } from 'next/server';
import {
  getSnippetById,
  updateSnippetStatus,
  getSnippetVersionsBySnippet,
  getCreatorByOwnerAddress,
} from '@/lib/db-creators';
import type { PublishSnippetResponse } from '@/types/v2';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const snippetId = parseInt(params.id);
    if (isNaN(snippetId)) {
      return NextResponse.json(
        { error: 'Invalid snippet ID' },
        { status: 400 }
      );
    }

    const body: { ownerAddress: string } = await request.json();

    // Authorization: Find creator by ownerAddress
    if (!body.ownerAddress || body.ownerAddress.trim().length === 0) {
      return NextResponse.json(
        { error: 'Unauthorized: ownerAddress required in request body' },
        { status: 401 }
      );
    }

    const creator = await getCreatorByOwnerAddress(body.ownerAddress);
    if (!creator) {
      return NextResponse.json(
        { error: 'Creator not found. Please register first.' },
        { status: 404 }
      );
    }

    // Verify snippet exists and belongs to creator
    const snippet = await getSnippetById(snippetId);
    if (!snippet) {
      return NextResponse.json(
        { error: 'Snippet not found' },
        { status: 404 }
      );
    }

    if (snippet.creator_id !== creator.id) {
      return NextResponse.json(
        { error: 'Forbidden: Not your snippet' },
        { status: 403 }
      );
    }

    // Check if snippet has at least one version
    const versions = await getSnippetVersionsBySnippet(snippetId);
    if (versions.length === 0) {
      return NextResponse.json(
        { error: 'Cannot publish: snippet has no versions' },
        { status: 400 }
      );
    }

    // Update status to published
    await updateSnippetStatus(snippetId, 'published');

    const response: PublishSnippetResponse = {
      snippetId,
      status: 'published',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error publishing snippet:', error);
    return NextResponse.json(
      { error: 'Failed to publish snippet' },
      { status: 500 }
    );
  }
}
