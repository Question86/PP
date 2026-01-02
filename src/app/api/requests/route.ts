// POST /api/requests - Create user request
import { NextRequest, NextResponse } from 'next/server';
import { createRequest } from '@/lib/db-compositions';
import { LIMITS } from '@/lib/config_v2';
import type { CreateRequestRequest, CreateRequestResponse } from '@/types/v2';

export async function POST(request: NextRequest) {
  try {
    const body: CreateRequestRequest = await request.json();

    // Validate input
    if (!body.userAddress || body.userAddress.trim().length < 10) {
      return NextResponse.json(
        { error: 'Valid user address is required' },
        { status: 400 }
      );
    }

    if (!body.userPrompt || body.userPrompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'User prompt is required' },
        { status: 400 }
      );
    }

    if (body.userPrompt.length > LIMITS.MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt too long (max ${LIMITS.MAX_PROMPT_LENGTH} chars)` },
        { status: 400 }
      );
    }

    // Create request
    const requestId = await createRequest({
      user_address: body.userAddress.trim(),
      user_prompt: body.userPrompt.trim(),
    });

    const response: CreateRequestResponse = {
      requestId,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating request:', error);
    return NextResponse.json(
      { error: 'Failed to create request' },
      { status: 500 }
    );
  }
}
