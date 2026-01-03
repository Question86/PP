// GET /api/snippets - List all published snippets
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
  try {
    // Get all published snippets with their active versions
    const [snippets] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        s.id,
        s.title,
        s.summary,
        s.category,
        sv.price_nanoerg,
        c.display_name as creator_name,
        c.id as creator_id
       FROM snippets s
       JOIN snippet_versions sv ON s.id = sv.snippet_id
       JOIN creators c ON s.creator_id = c.id
       WHERE s.status = 'published'
       ORDER BY s.created_at DESC`
    );

    return NextResponse.json({
      snippets: snippets.map((s) => ({
        id: s.id,
        title: s.title,
        summary: s.summary,
        category: s.category,
        price_nanoerg: parseInt(s.price_nanoerg),
        creator_name: s.creator_name,
        creator_id: s.creator_id,
      })),
    });
  } catch (error) {
    console.error('Error fetching snippets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
