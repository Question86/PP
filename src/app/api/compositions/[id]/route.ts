// GET /api/compositions/[id] - Get composition details
import { NextRequest, NextResponse } from 'next/server';
import { getCompositionWithItems } from '@/lib/db-compositions';

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

    const composition = await getCompositionWithItems(compositionId);
    if (!composition) {
      return NextResponse.json(
        { error: 'Composition not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(composition);
  } catch (error) {
    console.error('Error fetching composition:', error);
    return NextResponse.json(
      { error: 'Failed to fetch composition' },
      { status: 500 }
    );
  }
}
