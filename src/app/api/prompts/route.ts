/**
 * POST /api/prompts
 * Creates a new prompt and returns metadata for minting
 */
import { NextRequest, NextResponse } from 'next/server';
import { createPrompt } from '@/lib/db-prompts';
import { hashPrompt } from '@/lib/crypto';
import { MAX_PROMPT_LENGTH, MIN_PROMPT_LENGTH, APP_BASE_URL } from '@/lib/config';
import { CreatePromptRequest, CreatePromptResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: CreatePromptRequest = await request.json();
    const { ownerAddress, promptText } = body;

    // Validation
    if (!ownerAddress || typeof ownerAddress !== 'string') {
      return NextResponse.json(
        { error: 'ownerAddress is required and must be a string' },
        { status: 400 }
      );
    }

    if (!promptText || typeof promptText !== 'string') {
      return NextResponse.json(
        { error: 'promptText is required and must be a string' },
        { status: 400 }
      );
    }

    // Length validation
    if (promptText.length < MIN_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt text must be at least ${MIN_PROMPT_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (promptText.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt text must not exceed ${MAX_PROMPT_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Basic sanitization (trim whitespace)
    const sanitizedPrompt = promptText.trim();

    // Compute hash
    const promptHashHex = hashPrompt(sanitizedPrompt);

    // Insert into database
    const promptId = await createPrompt(ownerAddress, sanitizedPrompt, promptHashHex);

    // Build URL path
    const urlPath = `/p/${promptId}`;

    const response: CreatePromptResponse = {
      promptId,
      promptHashHex,
      urlPath,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating prompt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
