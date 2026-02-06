/**
 * GET /api/regression/alerts/[id] - Get a single alert
 * PUT /api/regression/alerts/[id]/acknowledge - Acknowledge an alert
 * DELETE /api/regression/alerts/[id] - Delete an alert
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface AlertContext {
  params: Promise<{ id: string }>;
}

// GET /api/regression/alerts/[id] - Get a single alert
export async function GET(_request: NextRequest, context: AlertContext) {
  try {
    const { id } = await context.params;

    const alert = await prisma.regressionAlert.findUnique({
      where: { id },
      include: {
        regressionRun: {
          include: {
            baseline: {
              select: {
                id: true,
                name: true,
              },
            },
            modelRuns: true,
          },
        },
      },
    });

    if (!alert) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Alert not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ alert });
  } catch (error) {
    const { id } = await context.params;
    console.error(`[GET /api/regression/alerts/${id}] Error:`, error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch alert" } },
      { status: 500 }
    );
  }
}

// PUT /api/regression/alerts/[id]/acknowledge - Acknowledge an alert
export async function PUT(_request: NextRequest, context: AlertContext) {
  try {
    const { id } = await context.params;

    const alert = await prisma.regressionAlert.update({
      where: { id },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
      },
    });

    return NextResponse.json({ alert });
  } catch (error) {
    const { id } = await context.params;
    console.error(`[PUT /api/regression/alerts/${id}] Error:`, error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to acknowledge alert" } },
      { status: 500 }
    );
  }
}

// DELETE /api/regression/alerts/[id] - Delete an alert
export async function DELETE(_request: NextRequest, context: AlertContext) {
  try {
    const { id } = await context.params;

    await prisma.regressionAlert.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const { id } = await context.params;
    console.error(`[DELETE /api/regression/alerts/${id}] Error:`, error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete alert" } },
      { status: 500 }
    );
  }
}
