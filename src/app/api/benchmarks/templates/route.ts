/**
 * GET /api/benchmarks/templates - List benchmark templates
 * POST /api/benchmarks/templates - Create a new template (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper function to safely parse JSON with error handling
function parseJsonSafely(jsonString: string | null | undefined): any[] | null {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString);
  } catch {
    console.error("Failed to parse JSON:", jsonString);
    return null;
  }
}

// GET /api/benchmarks/templates - List templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const difficulty = searchParams.get("difficulty");

    const where: any = {
      isActive: true,
    };

    if (category) {
      where.category = category;
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    const templates = await prisma.benchmarkTemplate.findMany({
      where,
      orderBy: [{ isSystem: "desc" }, { usesCount: "desc" }],
      take: 50,
    });

    // Increment uses count for tracking (async, non-blocking)
    templates.forEach(async (template) => {
      try {
        await prisma.benchmarkTemplate.update({
          where: { id: template.id },
          data: { usesCount: { increment: 1 } },
        });
      } catch {
        // Ignore errors in stats update
      }
    });

    return NextResponse.json({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        difficulty: t.difficulty,
        estimatedTokens: t.estimatedTokens,
        tags: parseJsonSafely(t.tags),
        prompt: t.prompt,
        examples: parseJsonSafely(t.examples),
        variables: parseJsonSafely(t.variables),
        isSystem: t.isSystem,
      })),
    });
  } catch (error) {
    console.error("[GET /api/benchmarks/templates] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch templates" } },
      { status: 500 }
    );
  }
}

// POST /api/benchmarks/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.description || !body.prompt || !body.category) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Missing required fields" } },
        { status: 400 }
      );
    }

    const template = await prisma.benchmarkTemplate.create({
      data: {
        name: body.name,
        description: body.description,
        category: body.category,
        prompt: body.prompt,
        difficulty: body.difficulty || "intermediate",
        estimatedTokens: body.estimatedTokens,
        tags: body.tags ? JSON.stringify(body.tags) : null,
        examples: body.examples ? JSON.stringify(body.examples) : null,
        variables: body.variables ? JSON.stringify(body.variables) : null,
        isSystem: false,
        isActive: true,
      },
    });

    console.info(`[POST /api/benchmarks/templates] Created template: ${template.id}`);

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/benchmarks/templates] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create template" } },
      { status: 500 }
    );
  }
}
