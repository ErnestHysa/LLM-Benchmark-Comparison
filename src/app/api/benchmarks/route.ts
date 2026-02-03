/**
 * GET /api/benchmarks
 *
 * List all benchmarks with optional filtering
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ListBenchmarksQuerySchema } from "@/lib/validators";
import { errorResponse, getStatusCode, NotFoundError, ValidationError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query parameters
    const validationResult = ListBenchmarksQuerySchema.safeParse({
      category: searchParams.get("category") || undefined,
      limit: searchParams.get("limit") || undefined,
      offset: searchParams.get("offset") || undefined,
      search: searchParams.get("search") || undefined,
    });

    if (!validationResult.success) {
      throw new ValidationError("Invalid query parameters", validationResult.error.flatten());
    }

    const { category, limit, offset, search } = validationResult.data;

    // Build where clause
    const where: {
      primaryCategory?: string;
      isPublic?: boolean;
      OR?: Array<{
        name?: { contains: string; mode?: "insensitive" };
        description?: { contains: string; mode?: "insensitive" };
      }>;
    } = {
      isPublic: true, // Only show public benchmarks
    };

    if (category) {
      where.primaryCategory = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get total count
    const total = await prisma.benchmark.count({ where });

    // Get benchmarks with pagination
    const benchmarks = await prisma.benchmark.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        primaryCategory: true,
        createdAt: true,
        _count: {
          select: {
            runs: true,
          },
        },
      },
    });

    // Get average scores for each benchmark (optional - expensive query)
    const benchmarkIds = benchmarks.map((b) => b.id);
    const scores = await prisma.categoryScore.groupBy({
      by: ["modelRunId"],
      where: {
        modelRun: {
          benchmarkRun: {
            benchmarkId: { in: benchmarkIds },
          },
        },
      },
      _avg: {
        totalScore: true,
      },
    });

    // Map scores to benchmarks
    const benchmarkScores = new Map<string, number>();
    for (const score of scores) {
      const avg = score._avg.totalScore ?? 0;
      // This is simplified - in production, you'd want a more sophisticated query
      if (avg > 0) {
        const currentAvg = benchmarkScores.get(score.modelRunId) ?? 0;
        benchmarkScores.set(score.modelRunId, (currentAvg + avg) / 2);
      }
    }

    // Format response
    const formattedBenchmarks = benchmarks.map((benchmark) => ({
      id: benchmark.id,
      name: benchmark.name,
      description: benchmark.description,
      category: benchmark.primaryCategory,
      runCount: benchmark._count.runs,
      avgScore: null, // Would need more complex query for accurate avg
      createdAt: benchmark.createdAt.toISOString(),
    }));

    return NextResponse.json({
      benchmarks: formattedBenchmarks,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    const response = errorResponse(error);

    if (error instanceof Error) {
      return NextResponse.json(response, {
        status: error instanceof ValidationError ? 400 : getStatusCode(error as any),
      });
    }

    return NextResponse.json(response, { status: 500 });
  }
}
