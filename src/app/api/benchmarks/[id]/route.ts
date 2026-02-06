/**
 * GET /api/benchmarks/[id] - Get benchmark detail
 * PUT /api/benchmarks/[id] - Update benchmark
 * DELETE /api/benchmarks/[id] - Delete benchmark
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BenchmarkParamsSchema } from "@/lib/validators";
import { errorResponse, getStatusCode, NotFoundError, ValidationError } from "@/lib/errors";
import { logError } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    // Validate ID
    const validationResult = BenchmarkParamsSchema.safeParse({ id });
    if (!validationResult.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid benchmark ID" } },
        { status: 400 }
      );
    }

    // Get benchmark
    const benchmark = await prisma.benchmark.findUnique({
      where: { id: validationResult.data.id },
      include: {
        categories: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        runs: {
          take: 100,
          orderBy: { startedAt: "desc" },
          include: {
            modelRuns: {
              include: {
                scores: {
                  include: {
                    category: {
                      select: {
                        name: true,
                        color: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!benchmark) {
      throw new NotFoundError("Benchmark", id);
    }

    // Calculate best/worst models from all runs
    const modelScores = new Map<string, { total: number; count: number; modelId: string }>();

    for (const run of benchmark.runs) {
      for (const modelRun of run.modelRuns) {
        const avgScore =
          modelRun.scores.reduce((sum, score) => sum + score.value, 0) / modelRun.scores.length;

        const existing = modelScores.get(modelRun.modelId);
        if (existing) {
          existing.total += avgScore;
          existing.count += 1;
        } else {
          modelScores.set(modelRun.modelId, { total: avgScore, count: 1, modelId: modelRun.modelId });
        }
      }
    }

    // Sort to find best/worst
    const sortedModels = Array.from(modelScores.values())
      .map((m) => ({ modelId: m.modelId, avgScore: m.total / m.count }))
      .sort((a, b) => b.avgScore - a.avgScore);

    const bestModel = sortedModels[0];
    const worstModel = sortedModels[sortedModels.length - 1];

    // Format response
    return NextResponse.json({
      benchmark: {
        id: benchmark.id,
        name: benchmark.name,
        description: benchmark.description,
        prompt: benchmark.prompt,
        primaryCategory: benchmark.primaryCategory,
        categories: benchmark.categories,
        createdAt: benchmark.createdAt.toISOString(),
        updatedAt: benchmark.updatedAt.toISOString(),
        runs: benchmark.runs.length,
        bestModel: bestModel
          ? { modelId: bestModel.modelId, avgScore: bestModel.avgScore }
          : null,
        worstModel: worstModel
          ? { modelId: worstModel.modelId, avgScore: worstModel.avgScore }
          : null,
      },
    });
  } catch (error) {
    logError(error, { context: "GET /api/benchmarks/[id]" });

    const response = errorResponse(error);

    if (error instanceof Error) {
      return NextResponse.json(response, {
        status: getStatusCode(error as any),
      });
    }

    return NextResponse.json(response, { status: 500 });
  }
}

// PUT /api/benchmarks/[id] - Update benchmark
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate ID
    const validationResult = BenchmarkParamsSchema.safeParse({ id });
    if (!validationResult.success) {
      throw new ValidationError("Invalid benchmark ID", validationResult.error.flatten());
    }

    // Check if benchmark exists and is not a system benchmark
    const existing = await prisma.benchmark.findUnique({
      where: { id: validationResult.data.id },
    });

    if (!existing) {
      throw new NotFoundError("Benchmark", id);
    }

    if (existing.isSystem) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Cannot modify system benchmarks" } },
        { status: 403 }
      );
    }

    // Build update data
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.prompt !== undefined) updateData.prompt = body.prompt;
    if (body.primaryCategory !== undefined) updateData.primaryCategory = body.primaryCategory;
    if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;
    if (body.collectionId !== undefined) updateData.collectionId = body.collectionId || null;
    if (body.difficulty !== undefined) updateData.difficulty = body.difficulty;
    if (body.estimatedTokens !== undefined) updateData.estimatedTokens = body.estimatedTokens;
    if (body.tags !== undefined) updateData.tags = body.tags;

    const benchmark = await prisma.benchmark.update({
      where: { id: validationResult.data.id },
      data: updateData,
    });

    console.info(`[PUT /api/benchmarks/${id}] Updated benchmark`);

    return NextResponse.json({ benchmark });
  } catch (error) {
    logError(error, { context: "PUT /api/benchmarks/[id]" });

    const response = errorResponse(error);

    if (error instanceof Error) {
      return NextResponse.json(response, {
        status: error instanceof ValidationError ? 400 : getStatusCode(error as any),
      });
    }

    return NextResponse.json(response, { status: 500 });
  }
}

// DELETE /api/benchmarks/[id] - Delete benchmark
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    // Validate ID
    const validationResult = BenchmarkParamsSchema.safeParse({ id });
    if (!validationResult.success) {
      throw new ValidationError("Invalid benchmark ID", validationResult.error.flatten());
    }

    // Check if benchmark exists and is not a system benchmark
    const existing = await prisma.benchmark.findUnique({
      where: { id: validationResult.data.id },
    });

    if (!existing) {
      throw new NotFoundError("Benchmark", id);
    }

    if (existing.isSystem) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Cannot delete system benchmarks" } },
        { status: 403 }
      );
    }

    await prisma.benchmark.delete({
      where: { id: validationResult.data.id },
    });

    console.info(`[DELETE /api/benchmarks/${id}] Deleted benchmark`);

    return NextResponse.json({ success: true });
  } catch (error) {
    logError(error, { context: "DELETE /api/benchmarks/[id]" });

    const response = errorResponse(error);

    if (error instanceof Error) {
      return NextResponse.json(response, {
        status: error instanceof ValidationError ? 400 : getStatusCode(error as any),
      });
    }

    return NextResponse.json(response, { status: 500 });
  }
}
