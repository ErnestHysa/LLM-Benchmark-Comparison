/**
 * GET /api/batch/configs/[id] - Get a batch configuration
 * PUT /api/batch/configs/[id] - Update a batch configuration
 * DELETE /api/batch/configs/[id] - Delete a batch configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getBatchConfig,
  updateBatchConfig,
  deleteBatchConfig,
  toggleBatchConfig,
  validateBatchConfig,
} from '@/lib/batch/config';
import { NotFoundError, errorResponse, getStatusCode } from '@/lib/errors';
import { logError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// ============================================
// GET - Get a batch configuration
// ============================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {

    const config = await getBatchConfig(id);

    if (!config) {
      throw new NotFoundError('BatchConfig', id);
    }

    return NextResponse.json({ config });

  } catch (error) {
    logError(error, { context: `GET /api/batch/configs/${id}` });

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
// PUT - Update a batch configuration
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    // Check if config exists
    const existing = await getBatchConfig(id);
    if (!existing) {
      throw new NotFoundError('BatchConfig', id);
    }

    // Validate updates
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

    // Update configuration
    const config = await updateBatchConfig(id, body);

    return NextResponse.json({
      config,
      warnings: validation.warnings,
    });

  } catch (error) {
    logError(error, { context: `PUT /api/batch/configs/${id}` });

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
// DELETE - Delete a batch configuration
// ============================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {

    // Check if config exists
    const existing = await getBatchConfig(id);
    if (!existing) {
      throw new NotFoundError('BatchConfig', id);
    }

    await deleteBatchConfig(id);

    return NextResponse.json({
      message: 'Batch configuration deleted successfully',
      id,
    });

  } catch (error) {
    logError(error, { context: `DELETE /api/batch/configs/${id}` });

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
// PATCH - Toggle batch configuration active status
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { isActive } = body;

    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'isActive must be a boolean' } },
        { status: 400 }
      );
    }

    // Check if config exists
    const existing = await getBatchConfig(id);
    if (!existing) {
      throw new NotFoundError('BatchConfig', id);
    }

    const config = await toggleBatchConfig(id, isActive);

    return NextResponse.json({
      config,
      message: `Batch configuration ${isActive ? 'enabled' : 'disabled'}`,
    });

  } catch (error) {
    logError(error, { context: `PATCH /api/batch/configs/${id}` });

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
