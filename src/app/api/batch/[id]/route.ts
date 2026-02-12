/**
 * GET /api/batch/[id] - Get batch by ID
 * DELETE /api/batch/[id] - Delete batch by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBatch, deleteBatch, getBatchResults, calculateRankings } from '@/lib/batch';
import { NotFoundError, errorResponse, getStatusCode } from '@/lib/errors';
import { logError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// ============================================
// GET - Get batch details with results
// ============================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {

    const batch = await getBatch(id);

    if (!batch) {
      throw new NotFoundError('Batch', id);
    }

    // Get batch results
    const results = await getBatchResults(id);

    // Calculate rankings
    const rankings = calculateRankings(results.map(r => ({
      benchmarkId: r.benchmarkId,
      benchmarkName: r.benchmarkName,
      modelId: r.modelId,
      modelName: r.modelName,
      status: r.status as any,
      score: r.score ?? 0,
      duration: r.duration ?? 0,
    })));

    // Enhance results with rankings
    const resultsWithRank = results.map(result => ({
      ...result,
      rank: rankings.get(result.modelId),
    }));

    // Calculate summary statistics
    const completedResults = results.filter(r => r.status === 'COMPLETED');
    const avgScore = completedResults.length > 0 && completedResults.some(r => r.score)
      ? completedResults.reduce((sum, r) => sum + (r.score || 0), 0) / completedResults.length
      : undefined;

    // Group by model for comparison
    const modelStats = new Map<string, { scores: number[]; count: number }>();
    for (const result of completedResults) {
      if (result.score !== undefined && result.score !== null) {
        const stats = modelStats.get(result.modelId) || { scores: [], count: 0 };
        stats.scores.push(result.score);
        stats.count++;
        modelStats.set(result.modelId, stats);
      }
    }

    const modelComparison = Array.from(modelStats.entries()).map(([modelId, { scores, count }]) => {
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      return {
        modelId,
        modelName: results.find(r => r.modelId === modelId)?.modelName || modelId,
        avgScore,
        minScore: Math.min(...scores),
        maxScore: Math.max(...scores),
        runCount: count,
        rank: rankings.get(modelId) || 0,
      };
    }).sort((a, b) => b.avgScore - a.avgScore);

    return NextResponse.json({
      batch,
      results: resultsWithRank,
      summary: {
        totalRuns: batch.totalRuns,
        completedRuns: batch.completedRuns,
        failedRuns: batch.failedRuns,
        avgScore,
        modelComparison,
      },
    });

  } catch (error) {
    logError(error, { context: `GET /api/batch/${id}` });

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: error.message } },
        { status: 404 }
      );
    }

    const response = errorResponse(error);
    return NextResponse.json(response, { status: getStatusCode(error as any) });
  }
}

// ============================================
// DELETE - Delete a batch
// ============================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {

    // Check if batch exists
    const batch = await prisma.benchmarkBatch.findUnique({
      where: { id },
    });

    if (!batch) {
      throw new NotFoundError('Batch', id);
    }

    // Delete batch (cascade will delete related records)
    await deleteBatch(id);

    return NextResponse.json({
      message: 'Batch deleted successfully',
      id,
    });

  } catch (error) {
    logError(error, { context: `DELETE /api/batch/${id}` });

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: error.message } },
        { status: 404 }
      );
    }

    const response = errorResponse(error);
    return NextResponse.json(response, { status: getStatusCode(error as any) });
  }
}

// ============================================
// PATCH - Update batch status (for cancellation)
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'cancel') {
      // Check if batch exists and is running
      const batch = await prisma.benchmarkBatch.findUnique({
        where: { id },
      });

      if (!batch) {
        throw new NotFoundError('Batch', id);
      }

      if (batch.status !== 'RUNNING' && batch.status !== 'PENDING') {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_STATE',
              message: `Cannot cancel batch with status: ${batch.status}`,
            },
          },
          { status: 400 }
        );
      }

      // Update batch status to FAILED (cancelled)
      await prisma.benchmarkBatch.update({
        where: { id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      });

      return NextResponse.json({
        message: 'Batch cancelled successfully',
        id,
        previousStatus: batch.status,
      });
    }

    return NextResponse.json(
      { error: { code: 'INVALID_ACTION', message: 'Unknown action' } },
      { status: 400 }
    );

  } catch (error) {
    logError(error, { context: `PATCH /api/batch/${id}` });

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: error.message } },
        { status: 404 }
      );
    }

    const response = errorResponse(error);
    return NextResponse.json(response, { status: getStatusCode(error as any) });
  }
}
