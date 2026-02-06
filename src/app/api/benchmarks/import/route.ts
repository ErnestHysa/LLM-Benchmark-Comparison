/**
 * POST /api/benchmarks/import - Import benchmarks from JSON
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.benchmarks || !Array.isArray(body.benchmarks)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "benchmarks array is required" } },
        { status: 400 }
      );
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as Array<{ name: string; error: string }>,
    };

    for (const benchmarkData of body.benchmarks) {
      try {
        // Check if benchmark with same name already exists
        const existing = await prisma.benchmark.findFirst({
          where: { name: benchmarkData.name },
        });

        if (existing) {
          if (body.skipExisting) {
            results.skipped++;
            continue;
          }
          // Update existing
          await prisma.benchmark.update({
            where: { id: existing.id },
            data: {
              description: benchmarkData.description,
              prompt: benchmarkData.prompt,
              primaryCategory: benchmarkData.primaryCategory,
              isPublic: benchmarkData.isPublic ?? false,
              difficulty: benchmarkData.difficulty || null,
              estimatedTokens: benchmarkData.estimatedTokens || null,
              tags: benchmarkData.tags || null,
            },
          });
        } else {
          // Create new
          await prisma.benchmark.create({
            data: {
              name: benchmarkData.name,
              description: benchmarkData.description || "",
              prompt: benchmarkData.prompt,
              primaryCategory: benchmarkData.primaryCategory,
              isPublic: benchmarkData.isPublic ?? false,
              isSystem: false,
              difficulty: benchmarkData.difficulty || null,
              estimatedTokens: benchmarkData.estimatedTokens || null,
              tags: benchmarkData.tags || null,
            },
          });
        }
        results.imported++;
      } catch (error) {
        results.errors.push({
          name: benchmarkData.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.info(`[POST /api/benchmarks/import] Imported ${results.imported} benchmarks`);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[POST /api/benchmarks/import] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to import benchmarks" } },
      { status: 500 }
    );
  }
}
