// POST /api/creators/snippets/[id]/versions - Create new version
import { NextRequest, NextResponse } from 'next/server';
import { createSnippetVersion, getSnippetById } from '@/lib/db-creators';
import { LIMITS } from '@/lib/config_v2';
import { hashContent } from '@/lib/crypto';
import type {
  CreateVersionRequest,
  CreateVersionResponse,
} from '@/types/v2';

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

    const body: CreateVersionRequest = await request.json();

    // Get creator ID from header
    const creatorId = request.headers.get('x-creator-id');
    if (!creatorId || isNaN(parseInt(creatorId))) {
      return NextResponse.json(
        { error: 'Unauthorized: X-Creator-Id header required' },
        { status: 401 }
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

    if (snippet.creator_id !== parseInt(creatorId)) {
      return NextResponse.json(
        { error: 'Forbidden: Not your snippet' },
        { status: 403 }
      );
    }

    // Validate content
    if (!body.content || body.content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    if (body.content.length > LIMITS.MAX_SNIPPET_CONTENT) {
      return NextResponse.json(
        { error: `Content too long (max ${LIMITS.MAX_SNIPPET_CONTENT} chars)` },
        { status: 400 }
      );
    }

    // Validate price
    let priceNanoerg: bigint;
    try {
      priceNanoerg = BigInt(body.price_nanoerg);
      if (priceNanoerg < 0) {
        throw new Error('Negative price');
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid price_nanoerg' },
        { status: 400 }
      );
    }

    // Compute content hash
    const contentHash = hashContent(body.content.trim());

    // Create version
    const versionId = await createSnippetVersion({
      snippet_id: snippetId,
      content: body.content.trim(),
      content_hash: contentHash,
      price_nanoerg: priceNanoerg,
    });

    // Get version number (should be auto-incremented)
    // For response, we need to query it back or calculate
    // For MVP, we can assume it was created successfully
    const response: CreateVersionResponse = {
      versionId,
      version: 1, // TODO: Get actual version from DB
      content_hash: contentHash,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating version:', error);
    return NextResponse.json(
      { error: 'Failed to create version' },
      { status: 500 }
    );
  }
}
