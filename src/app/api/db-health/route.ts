import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/db-health';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const health = await checkDatabaseHealth();
    return NextResponse.json(health);
  } catch (error) {
    return NextResponse.json({
      isHealthy: false,
      isIdle: true,
      message: error instanceof Error ? error.message : 'Database health check failed',
      lastChecked: new Date(),
    }, { status: 503 });
  }
}
