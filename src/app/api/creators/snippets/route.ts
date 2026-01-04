// POST /api/creators/snippets - Create new snippet
import { NextRequest, NextResponse } from 'next/server';
import { createSnippet, getCreatorByOwnerAddress } from '@/lib/db-creators';
import { LIMITS, isValidCategory } from '@/lib/config_v2';
import type {
  CreateSnippetRequest,
  CreateSnippetResponse,
} from '@/types/v2';

export async function POST(request: NextRequest) {
  try {
    const body: CreateSnippetRequest & { ownerAddress: string } = await request.json();

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

    // Validate input
    if (!body.title || body.title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (body.title.length > LIMITS.MAX_SNIPPET_TITLE) {
      return NextResponse.json(
        { error: `Title too long (max ${LIMITS.MAX_SNIPPET_TITLE} chars)` },
        { status: 400 }
      );
    }

    if (!body.category || !isValidCategory(body.category)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      );
    }

    // Create snippet
    const snippetId = await createSnippet({
      creator_id: creator.id,
      title: body.title.trim(),
      summary: body.summary?.trim(),
      category: body.category,
    });

    const response: CreateSnippetResponse = {
      snippetId,
      status: 'draft',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating snippet:', error);
    return NextResponse.json(
      { error: 'Failed to create snippet' },
      { status: 500 }
    );
  }
}
