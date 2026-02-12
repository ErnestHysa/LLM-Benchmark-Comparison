/**
 * GET /api/batch/[id]/export
 *
 * Export batch results as CSV
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Get batch results
  const results = await prisma.batchRunResult.findMany({
    where: { benchmarkRunId: id },
    orderBy: { createdAt: 'asc' },
  });

  if (results.length === 0) {
    throw new NotFoundError('Batch', id);
  }

  // Generate CSV
  const headers = [
    'Benchmark Name',
    'Model Name',
    'Status',
    'Score',
    'Tokens Used',
    'Cost ($)',
    'Duration (ms)',
    'Error Message',
    'Started At',
    'Completed At',
  ];

  const rows = results.map((result) => [
    result.benchmarkName,
    result.modelName,
    result.status,
    result.score?.toString() ?? '',
    result.tokensUsed?.toString() ?? '',
    result.cost?.toString() ?? '',
    result.duration?.toString() ?? '',
    result.errorMessage ?? '',
    result.startedAt.toISOString(),
    result.completedAt?.toISOString() ?? '',
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="batch-${id}-results.csv"`,
    },
  });
}
