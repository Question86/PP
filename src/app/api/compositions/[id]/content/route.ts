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
    const fullContent = items
      .map((item, index) => {
        const separator = index > 0 ? '\n\n---\n\n' : '';
        return `${separator}# ${item.snippet_title} (by ${item.creator_name})\n\n${item.content}`;
      })
      .join('');

    return NextResponse.json({
      compositionId,
      status: composition.status,
      txId: composition.tx_id,
      content: fullContent,
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
