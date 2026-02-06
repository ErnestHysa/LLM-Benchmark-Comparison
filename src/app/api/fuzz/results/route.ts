/**
 * GET /api/fuzz/results - Get fuzz test results
 *
 * Returns detailed results for a completed fuzz test run
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");

    if (!runId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "runId is required" } },
        { status: 400 }
      );
    }

    const run = await prisma.benchmarkRun.findUnique({
      where: { id: runId },
    });

    if (!run) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Fuzz test run not found" } },
        { status: 404 }
      );
    }

    // Try to get stored results from metadata or related tables
    let results = null;
    if (run.metadata) {
      try {
        const parsed = JSON.parse(run.metadata as string);

        // Validate the parsed metadata has expected structure
        if (parsed && typeof parsed === "object") {
          // Check if this is a valid results object or a progress update
          if (parsed.completed === true || parsed.progress) {
            results = parsed;
          } else {
            console.warn("[GET /api/fuzz/results] Metadata has unexpected structure:", { keys: Object.keys(parsed) });
            results = parsed; // Still return parsed data, but log warning
          }
        } else {
          console.warn("[GET /api/fuzz/results] Metadata is not a valid object");
        }
      } catch (parseError) {
        // Metadata is not valid JSON - log the specific error
        console.error("[GET /api/fuzz/results] Failed to parse metadata JSON:", parseError);
        results = null;
      }
    }

    return NextResponse.json({
      run: {
        id: run.id,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
      },
      results,
    });
  } catch (error) {
    console.error("[GET /api/fuzz/results] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch fuzz test results" } },
      { status: 500 }
    );
  }
}
