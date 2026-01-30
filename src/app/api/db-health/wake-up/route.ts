import { NextResponse } from 'next/server';
import { wakeUpDatabase } from '@/lib/db-health';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  try {
    const health = await wakeUpDatabase(5, 3000); // 5 retries with 3 second delay
    
    if (health.isHealthy) {
      return NextResponse.json({
        ...health,
        message: 'Database is now awake and ready!',
      });
    } else {
      return NextResponse.json(health, { status: 503 });
    }
  } catch (error) {
    return NextResponse.json({
      isHealthy: false,
      isIdle: true,
      message: error instanceof Error ? error.message : 'Failed to wake up database',
      lastChecked: new Date(),
    }, { status: 503 });
  }
}
