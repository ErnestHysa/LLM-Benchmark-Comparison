/**
 * POST /api/batch
 * GET /api/batch
 * DELETE /api/batch
 *
 * Batch API endpoints for bulk benchmark operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { executeBatch, getBatches } from '@/lib/batch';
import { validateBatchConfig } from '@/lib/batch/config';
import type { CreateBatchRequest } from '@/lib/batch/types';
import { errorResponse, getStatusCode } from '@/lib/errors';
import { logError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// ============================================
// POST - Create and execute a new batch
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.info('[Batch API] Received request:', {
      name: body.name,
      benchmarkCount: body.benchmarkIds?.length,
      modelCount: body.modelIds?.length,
    });

    // Validate request body
    const validation = validateBatchConfig(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', errors: validation.errors } },
        { status: 400 }
      );
    }

    const {
      benchmarkIds,
      modelIds,
      evaluatorModel,
      evaluatorProvider,
      concurrency = 5,
      timeoutSec = 600,
    } = body as CreateBatchRequest;

    // Verify benchmarks exist
    const benchmarks = await prisma.benchmark.findMany({
      where: { id: { in: benchmarkIds } },
      select: { id: true, name: true },
    });

    if (benchmarks.length !== benchmarkIds.length) {
      const foundIds = new Set(benchmarks.map(b => b.id));
      const missingIds = benchmarkIds.filter(id => !foundIds.has(id));
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: `Benchmarks not found: ${missingIds.join(', ')}`,
          },
        },
        { status: 404 }
      );
    }

    // Get API keys from settings if needed
    const userSettings = await prisma.userSettings.findFirst({
      where: { userId: 'default' },
    });

    let apiKeys: Record<string, string> | undefined;
    if (userSettings?.apiKeys) {
      try {
        // API keys are stored as array of objects, need to transform to Record<provider, key>
        const keysArray: Array<{ provider: string; key: string }> = JSON.parse(userSettings.apiKeys);
        apiKeys = {};
        for (const keyObj of keysArray) {
          if (keyObj.provider && keyObj.key) {
            // key is base64 encoded, need to decode
            const decodedKey = Buffer.from(keyObj.key, 'base64').toString('utf-8');
            apiKeys[keyObj.provider] = decodedKey;
          }
        }
      } catch {
        console.warn('[Batch API] Failed to parse API keys from settings');
      }
    }

    // Execute batch asynchronously (don't wait for completion)
    // SSE broadcasts are handled within executor
    const batchResult = await executeBatch(
      {
        benchmarkIds,
        modelIds,
        evaluatorModel,
        evaluatorProvider,
        concurrency,
        timeoutSec,
        apiKeys,
      },
      undefined, // onProgress callback - SSE handles this
      request.signal
    );

    // Return immediate response with batch ID
    return NextResponse.json({
      batchId: batchResult.batchId,
      status: batchResult.status,
      totalRuns: batchResult.totalRuns,
      message: 'Batch execution started',
    }, { status: 202 });
  } catch (error) {
    logError(error, { context: 'POST /api/batch' });
    const response = errorResponse(error);
    return NextResponse.json(response, { status: getStatusCode(error as any) });
  }
}

// ============================================
// GET - List all batches
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const batches = await getBatches({
      status: status || undefined,
      limit,
      offset,
    });

    const total = await prisma.benchmarkBatch.count();

    return NextResponse.json({
      batches,
      pagination: {
        total: batches.length,
        limit,
        offset,
        hasMore: offset + batches.length < total,
      },
    });
  } catch (error) {
    logError(error, { context: 'GET /api/batch' });
    const response = errorResponse(error);
    return NextResponse.json(response, { status: getStatusCode(error as any) });
  }
}

// ============================================
// DELETE - Delete all batches (optional cleanup)
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    const where: any = {};
    if (statusFilter) {
      where.status = statusFilter;
    }

    const result = await prisma.benchmarkBatch.deleteMany({
      where,
    });

    return NextResponse.json({
      deleted: result.count,
      message: `Deleted ${result.count} batch(es)`,
    });
  } catch (error) {
    logError(error, { context: 'DELETE /api/batch' });
    const response = errorResponse(error);
    return NextResponse.json(response, { status: getStatusCode(error as any) });
  }
}
