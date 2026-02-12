/**
 * GET /api/analytics/costs
 *
 * Cost breakdown API endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCostBreakdown } from '@/lib/analytics/aggregators';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodStartParam = searchParams.get('periodStart');
    const periodEndParam = searchParams.get('periodEnd');

    const breakdown = await getCostBreakdown(
      periodStartParam ? new Date(periodStartParam) : undefined,
      periodEndParam ? new Date(periodEndParam) : undefined
    );

    // Calculate percentages
    const totalCost = breakdown.reduce((sum, item) => sum + item.totalCost, 0);

    const breakdownWithPercentages = breakdown.map((item) => ({
      ...item,
      percentage: totalCost > 0 ? (item.totalCost / totalCost) * 100 : 0,
    }));

    return NextResponse.json({
      total: totalCost,
      byProvider: breakdownWithPercentages,
    });
  } catch (error) {
    console.error('[Costs API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost data' },
      { status: 500 }
    );
  }
}
