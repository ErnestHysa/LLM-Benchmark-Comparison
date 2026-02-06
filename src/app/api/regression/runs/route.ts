/**
 * GET /api/regression/runs - List regression test runs
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const baselineId = searchParams.get("baselineId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");

    const where: any = {};
    if (baselineId) {
      where.baselineId = baselineId;
    }
    if (status) {
      where.status = status;
    }

    const runs = await prisma.regressionRun.findMany({
      where,
      include: {
        baseline: {
          select: {
            id: true,
            name: true,
          },
        },
        modelRuns: {
          select: {
            modelId: true,
            totalScore: true,
            previousScore: true,
            scoreDiff: true,
            status: true,
          },
        },
        alerts: {
          select: {
            alertType: true,
            severity: true,
            message: true,
            acknowledged: true,
          },
        },
      },
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ runs });
  } catch (error) {
    console.error("[GET /api/regression/runs] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch regression runs" } },
      { status: 500 }
    );
  }
}
