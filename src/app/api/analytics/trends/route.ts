/**
 * GET /api/analytics/trends
 *
 * Trend data API endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTrendData } from '@/lib/analytics/aggregators';

export const dynamic = 'force-dynamic';

type Period = '7d' | '30d' | '90d' | 'all';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const benchmarkId = searchParams.get('benchmarkId') || undefined;
    const models = searchParams.get('models');
    const period = (searchParams.get('period') as Period) || '30d';
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');

    const modelIds = models ? models.split(',') : undefined;

    const data = await getTrendData(
      benchmarkId,
      modelIds,
      period,
      periodStart ? new Date(periodStart) : undefined,
      periodEnd ? new Date(periodEnd) : undefined
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Trends API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trend data' },
      { status: 500 }
    );
  }
}
