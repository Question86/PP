// GET /api/creators - List all creators
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const creators = await query(
      'SELECT id, display_name, bio, payout_address, created_at FROM creators ORDER BY id'
    );

    return NextResponse.json(creators);
  } catch (error) {
    console.error('Error fetching creators:', error);
    return NextResponse.json(
      { error: 'Failed to fetch creators' },
      { status: 500 }
    );
  }
}
