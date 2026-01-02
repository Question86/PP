/**
 * Health check endpoint
 * GET /api/health
 */
import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { validateConfig } from '@/lib/config';

export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      config: 'unknown',
      database: 'unknown',
    },
  };

  // Check configuration
  try {
    validateConfig();
    health.checks.config = 'ok';
  } catch (error: any) {
    health.checks.config = 'error';
    health.status = 'error';
    return NextResponse.json(health, { status: 500 });
  }

  // Check database connection
  try {
    const pool = getDbPool();
    await pool.query('SELECT 1');
    health.checks.database = 'ok';
  } catch (error: any) {
    health.checks.database = 'error';
    health.status = 'error';
    return NextResponse.json(health, { status: 500 });
  }

  return NextResponse.json(health);
}
