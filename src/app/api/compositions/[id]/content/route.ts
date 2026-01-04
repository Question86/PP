// GET /api/compositions/[id]/content - Deliver content after payment verification
import { NextRequest, NextResponse } from 'next/server';
import { getCompositionById } from '@/lib/db-compositions';
import { pool } from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const compositionId = parseInt(params.id);
    if (isNaN(compositionId)) {
      return NextResponse.json(
        { error: 'Invalid composition ID' },
        { status: 400 }
      );
    }

    // Get composition
    const composition = await getCompositionById(compositionId);
    if (!composition) {
      return NextResponse.json(
        { error: 'Composition not found' },
        { status: 404 }
      );
    }

    // Verify payment status
    if (composition.status !== 'paid') {
      return NextResponse.json(
        {
          error: `Composition is ${composition.status}. Payment required to access content.`,
          status: composition.status,
        },
        { status: 403 }
      );
    }

    // Fetch user prompt from request
    const [requestRows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_prompt
       FROM requests r
       INNER JOIN compositions c ON c.request_id = r.id
       WHERE c.id = ?`,
      [compositionId]
    );

    const userPrompt = requestRows.length > 0 ? requestRows[0].user_prompt : '';

    // Fetch snippet content
    const [items] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        sv.content,
        s.title as snippet_title,
        c.display_name as creator_name,
        ci.position
       FROM composition_items ci
       JOIN snippet_versions sv ON ci.snippet_version_id = sv.id
       JOIN snippets s ON sv.snippet_id = s.id
       JOIN creators c ON s.creator_id = c.id
       WHERE ci.composition_id = ?
       ORDER BY ci.position`,
      [compositionId]
    );

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No content found for this composition' },
        { status: 404 }
      );
    }

    // Concatenate all snippets with separators
    const snippetsContent = items
      .map((item, index) => {
        return `### Snippet ${index + 1}: ${item.snippet_title}
Creator: ${item.creator_name}

${item.content}`;
      })
      .join('\n\n---\n\n');

    // Build masterprompt: snippets + user request
    const masterPrompt = userPrompt 
      ? `${snippetsContent}\n\n---\n\n### User Request:\n${userPrompt}`
      : snippetsContent;

    return NextResponse.json({
      compositionId,
      status: composition.status,
      txId: composition.tx_id,
      userPrompt,
      masterPrompt,
      snippetsCount: items.length,
      items: items.map((item) => ({
        snippetTitle: item.snippet_title,
        content: item.content,
        creatorName: item.creator_name,
      })),
    });
  } catch (error) {
    console.error('Error delivering content:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
