/**
 * GET /api/baselines - List all regression baselines
 * POST /api/baselines - Create a new regression baseline
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, ValidationError } from "@/lib/errors";

// GET /api/baselines - List all regression baselines
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const benchmarkId = searchParams.get("benchmarkId");
    const isActive = searchParams.get("isActive");

    const where: any = {};
    if (benchmarkId) {
      where.benchmarkId = benchmarkId;
    }
    if (isActive === "true") {
      where.isActive = true;
    }

    const baselines = await prisma.regressionBaseline.findMany({
      where,
      include: {
        benchmark: {
          select: {
            id: true,
            name: true,
            primaryCategory: true,
          },
        },
        runs: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            totalScore: true,
            isRegression: true,
            startedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ baselines });
  } catch (error) {
    console.error("[GET /api/baselines] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch baselines" } },
      { status: 500 }
    );
  }
}

// POST /api/baselines - Create a new regression baseline
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.benchmarkId || !body.modelIds || !body.modelIds.length) {
      throw new ValidationError("Missing required fields", {
        name: ["Name is required"],
        benchmarkId: ["Benchmark ID is required"],
        modelIds: ["At least one model ID is required"],
      });
    }

    // Verify benchmark exists
    const benchmark = await prisma.benchmark.findUnique({
      where: { id: body.benchmarkId },
    });

    if (!benchmark) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Benchmark not found" } },
        { status: 404 }
      );
    }

    // Create baseline
    const baseline = await prisma.regressionBaseline.create({
      data: {
        name: body.name,
        description: body.description,
        benchmarkId: body.benchmarkId,
        modelIds: JSON.stringify(body.modelIds),
        evaluator: body.evaluator || "gpt-4o",
        evaluatorProvider: body.evaluatorProvider || "openai",
        thresholdMin: body.thresholdMin,
        thresholdMax: body.thresholdMax,
        regressionDelta: body.regressionDelta,
        scheduleType: body.scheduleType || "manual",
        scheduleConfig: body.scheduleConfig,
        isActive: body.isActive ?? true,
      },
      include: {
        benchmark: {
          select: {
            id: true,
            name: true,
            primaryCategory: true,
          },
        },
      },
    });

    console.info("[POST /api/baselines] Created baseline:", {
      id: baseline.id,
      name: baseline.name,
    });

    return NextResponse.json({ baseline }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(errorResponse(error), { status: 400 });
    }
    console.error("[POST /api/baselines] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create baseline" } },
      { status: 500 }
    );
  }
}
