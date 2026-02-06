/**
 * GET /api/benchmarks/collections - List benchmark collections
 * POST /api/benchmarks/collections - Create a new collection
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/benchmarks/collections - List collections
export async function GET(_request: NextRequest) {
  try {
    const collections = await prisma.benchmarkCollection.findMany({
      orderBy: [{ isSystem: "desc" }, { order: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            benchmarks: true,
          },
        },
      },
    });

    return NextResponse.json({
      collections: collections.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        icon: c.icon,
        color: c.color,
        isPublic: c.isPublic,
        isSystem: c.isSystem,
        order: c.order,
        benchmarkCount: c._count.benchmarks,
      })),
    });
  } catch (error) {
    console.error("[GET /api/benchmarks/collections] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch collections" } },
      { status: 500 }
    );
  }
}

// POST /api/benchmarks/collections - Create a new collection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Name is required" } },
        { status: 400 }
      );
    }

    // Get the highest order value
    const maxOrder = await prisma.benchmarkCollection.findFirst({
      where: { isSystem: false },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const collection = await prisma.benchmarkCollection.create({
      data: {
        name: body.name,
        description: body.description || null,
        icon: body.icon || null,
        color: body.color || null,
        isPublic: body.isPublic ?? false,
        isSystem: false,
        order: (maxOrder?.order ?? 0) + 1,
      },
    });

    console.info(`[POST /api/benchmarks/collections] Created collection: ${collection.id}`);

    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/benchmarks/collections] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create collection" } },
      { status: 500 }
    );
  }
}
