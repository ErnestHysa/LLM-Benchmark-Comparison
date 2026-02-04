/**
 * API Routes for Benchmark Runs
 *
 * DELETE /api/benchmark-runs - Delete one or more benchmark runs
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, getStatusCode, ValidationError } from "@/lib/errors";
import { logError } from "@/lib/errors";

/**
 * DELETE handler - Delete one or more benchmark runs
 * Supports both single and bulk deletion
 *
 * Query params:
 * - ids: Comma-separated list of benchmark run IDs to delete
 *
 * Body (alternative):
 * - ids: Array of benchmark run IDs to delete
 */
export async function DELETE(request: NextRequest) {
  try {
    let ids: string[];

    // Try to get IDs from query params first
    const urlIds = request.nextUrl.searchParams.get("ids");
    if (urlIds) {
      ids = urlIds.split(",").filter((id) => id.trim().length > 0);
    } else {
      // Try to get IDs from request body
      const body = await request.json().catch(() => ({}));
      ids = body.ids || [];
    }

    if (ids.length === 0) {
      throw new ValidationError("No benchmark run IDs provided", {
        ids: "At least one ID is required",
      });
    }

    console.info("[DELETE /api/benchmark-runs] Deleting runs:", { ids });

    // Verify all runs exist
    const runs = await prisma.benchmarkRun.findMany({
      where: { id: { in: ids } },
      select: { id: true, benchmarkId: true },
    });

    if (runs.length === 0) {
      throw new ValidationError("No valid benchmark runs found", {
        ids: "None of the provided IDs exist",
      });
    }

    const foundIds = runs.map((r) => r.id);
    const missingIds = ids.filter((id) => !foundIds.includes(id));

    if (missingIds.length > 0) {
      console.warn("[DELETE /api/benchmark-runs] Some IDs not found:", missingIds);
    }

    // Delete runs (cascade delete will handle related records)
    const deleteResult = await prisma.benchmarkRun.deleteMany({
      where: { id: { in: foundIds } },
    });

    console.info("[DELETE /api/benchmark-runs] Deleted runs:", {
      count: deleteResult.count,
    });

    return NextResponse.json({
      success: true,
      message: `Deleted ${deleteResult.count} benchmark run(s)`,
      deletedCount: deleteResult.count,
      deletedIds: foundIds,
      missingIds: missingIds.length > 0 ? missingIds : undefined,
    });
  } catch (error) {
    logError(error, { context: "DELETE /api/benchmark-runs" });

    const response = errorResponse(error);

    if (error instanceof Error) {
      return NextResponse.json(response, {
        status: getStatusCode(error as any),
      });
    }

    return NextResponse.json(response, { status: 500 });
  }
}
