// POST /api/creators/snippets - Create new snippet
import { NextRequest, NextResponse } from 'next/server';
import { createSnippet } from '@/lib/db-creators';
import { LIMITS, isValidCategory } from '@/lib/config_v2';
import type {
  CreateSnippetRequest,
  CreateSnippetResponse,
} from '@/types/v2';

export async function POST(request: NextRequest) {
  try {
    const body: CreateSnippetRequest = await request.json();

    // Get creator ID from header (MVP simple auth)
    const creatorId = request.headers.get('x-creator-id');
    if (!creatorId || isNaN(parseInt(creatorId))) {
      return NextResponse.json(
        { error: 'Unauthorized: X-Creator-Id header required' },
        { status: 401 }
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
      creator_id: parseInt(creatorId),
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
