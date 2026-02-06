/**
 * GET /api/benchmarks/export - Export benchmarks as JSON
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get("collectionId");
    const ids = searchParams.get("ids");

    const where: any = {
      isSystem: false, // Only export user-created benchmarks
    };

    if (collectionId) {
      where.collectionId = collectionId;
    }

    if (ids) {
      where.id = { in: ids.split(",") };
    }

    const benchmarks = await prisma.benchmark.findMany({
      where,
      orderBy: { name: "asc" },
    });

    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      benchmarks: benchmarks.map((b) => ({
        name: b.name,
        description: b.description,
        prompt: b.prompt,
        primaryCategory: b.primaryCategory,
        isPublic: b.isPublic,
        difficulty: b.difficulty,
        estimatedTokens: b.estimatedTokens,
        tags: b.tags,
      })),
    };

    return NextResponse.json(exportData, {
      headers: {
        "Content-Disposition": `attachment; filename="benchmarks-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/benchmarks/export] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to export benchmarks" } },
      { status: 500 }
    );
  }
}
