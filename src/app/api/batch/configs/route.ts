/**
 * POST /api/batch/configs - Create a new batch configuration
 * GET /api/batch/configs - List all batch configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createBatchConfig,
  getBatchConfigs,
  validateBatchConfig,
  estimateBatchExecutionTime,
  estimateBatchCost,
} from '@/lib/batch/config';
// import type { CreateBatchRequest } from '@/lib/batch/types'; // Unused, commented out
import { errorResponse, getStatusCode } from '@/lib/errors';
import { logError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// ============================================
// POST - Create a new batch configuration
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.info('[Batch Config API] Creating configuration:', { name: body.name });

    // Validate request body
    const validation = validateBatchConfig(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            errors: validation.errors,
            warnings: validation.warnings,
          },
        },
        { status: 400 }
      );
    }

    // Verify benchmarks exist
    const benchmarkCount = await prisma.benchmark.count({
      where: { id: { in: body.benchmarkIds } },
    });

    if (benchmarkCount !== body.benchmarkIds.length) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Some benchmarks not found',
          },
        },
        { status: 404 }
      );
    }

    // Create configuration
    const config = await createBatchConfig(body);

    // Calculate estimates
    const estimates = {
      time: estimateBatchExecutionTime(
        body.benchmarkIds.length,
        body.modelIds.length,
        body.concurrency || 5
      ),
      cost: estimateBatchCost(body.benchmarkIds.length, body.modelIds.length),
    };

    return NextResponse.json({
      config,
      estimates,
      warnings: validation.warnings,
    }, { status: 201 });

  } catch (error) {
    logError(error, { context: 'POST /api/batch/configs' });
    const response = errorResponse(error);
    return NextResponse.json(response, { status: getStatusCode(error as any) });
  }
}

// ============================================
// GET - List all batch configurations
// ============================================

export async function GET(_request: NextRequest) {
  try {
    const configs = await getBatchConfigs();

    return NextResponse.json({
      configs,
      count: configs.length,
    });

  } catch (error) {
    logError(error, { context: 'GET /api/batch/configs' });
    const response = errorResponse(error);
    return NextResponse.json(response, { status: getStatusCode(error as any) });
  }
}
