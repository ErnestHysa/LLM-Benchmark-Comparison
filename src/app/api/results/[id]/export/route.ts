/**
 * GET /api/results/[id]/export
 *
 * Export single benchmark run results as CSV
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;

  // Get benchmark run with model runs
  const benchmarkRun = await prisma.benchmarkRun.findUnique({
    where: { id },
    include: {
      benchmark: true,
      modelRuns: {
        include: {
          categoryScores: {
            include: {
              category: true,
            },
          },
        },
      },
    },
  });

  if (!benchmarkRun) {
    throw new NotFoundError('Benchmark', id);
  }

  // Generate CSV headers
  const headers = [
    'Benchmark Name',
    'Model ID',
    'Status',
    'Score',
    'Tokens Used',
    'Cost ($)',
    'Started At',
    'Completed At',
    'Error Message',
  ];

  // Generate CSV rows with calculated scores
  const rows = benchmarkRun.modelRuns.map((modelRun) => {
    // Calculate total score from category scores
    const totalScore = modelRun.categoryScores.length > 0
      ? modelRun.categoryScores.reduce((sum, cs) => sum + cs.totalScore, 0) / modelRun.categoryScores.length
      : 0;

    return {
      benchmark: benchmarkRun.benchmark?.name || '',
      modelId: modelRun.modelId,
      status: modelRun.status,
      score: totalScore.toFixed(1),
      tokensUsed: modelRun.tokensUsed || 0,
      cost: modelRun.cost?.toFixed(4) || '0',
      startedAt: modelRun.startedAt?.toISOString() || '',
      completedAt: modelRun.completedAt?.toISOString() || '',
      errorMessage: 'error' in modelRun ? (modelRun as any).error?.message || '' : '',
    };
  });

  const csv = [
    headers.join(','),
    ...rows.map((row) => [
      row.benchmark,
      row.modelId,
      row.status,
      row.score,
      row.tokensUsed,
      row.cost,
      row.startedAt,
      row.completedAt,
      row.errorMessage,
    ].map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="benchmark-run-${id}-results.csv"`,
    },
  });
}
