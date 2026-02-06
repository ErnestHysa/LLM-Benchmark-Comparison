/**
 * GET /api/regression/alerts - List regression alerts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/regression/alerts - List unacknowledged alerts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const baselineId = searchParams.get("baselineId");
    const acknowledged = searchParams.get("acknowledged");

    const where: any = {};
    if (baselineId) {
      where.baselineId = baselineId;
    }
    if (acknowledged === "false") {
      where.acknowledged = false;
    } else if (acknowledged === "true") {
      where.acknowledged = true;
    }

    const alerts = await prisma.regressionAlert.findMany({
      where,
      include: {
        regressionRun: {
          select: {
            id: true,
            totalScore: true,
            previousScore: true,
            startedAt: true,
            baseline: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("[GET /api/regression/alerts] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch alerts" } },
      { status: 500 }
    );
  }
}
