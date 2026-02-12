/**
 * User Settings API
 *
 * GET /api/settings - Get user settings from database
 * POST /api/settings - Save user settings to database
 * DELETE /api/settings - Clear user settings from database
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, getStatusCode } from "@/lib/errors";
import { logError } from "@/lib/errors";
import { z } from "zod";

const SettingsSchema = z.object({
  apiKeys: z.array(z.object({
    id: z.string(),
    provider: z.enum(["OPENAI", "ANTHROPIC", "OPENROUTER", "CUSTOM"]),
    label: z.string(),
    key: z.string(), // Base64 encoded
    isActive: z.boolean().default(true),
    lastTested: z.string().nullable(),
    lastTestSuccess: z.boolean().nullable(),
  })),
  customModels: z.array(z.object({
    id: z.string(),
    name: z.string(),
    displayName: z.string(),
    provider: z.enum(["OPENAI", "ANTHROPIC", "OPENROUTER", "CUSTOM"]),
    description: z.string().optional(),
    isEnabled: z.boolean().default(true),
    isCustom: z.boolean().default(true),
    apiEndpoint: z.string().optional(),
  })),
  disabledPredefinedModels: z.array(z.string()),
  evaluatorModel: z.string(),
  evaluatorProvider: z.enum(["OPENAI", "ANTHROPIC", "OPENROUTER", "CUSTOM"]),
  evaluatorApiKeyId: z.string().nullable(),
  theme: z.enum(["dark", "light", "system"]).default("dark"),
  concurrency: z.number().min(1).max(10).default(5),
  timeoutEnabled: z.boolean().default(true),
  timeoutSec: z.number().min(60).max(3600).default(600),
  maxTokens: z.number().min(256).max(32000).default(8192),
  exportFormat: z.enum(["csv", "json", "pdf"]).default("csv"),
  includeMetrics: z.boolean().default(true),
  includeExplanations: z.boolean().default(true),
  autoSync: z.boolean().default(false),
});

const DEFAULT_USER_ID = "default";

/**
 * GET handler - Get user settings from database
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId") || DEFAULT_USER_ID;

    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return NextResponse.json({
        exists: false,
        message: "No settings found in database",
      });
    }

    // Parse and return the settings
    return NextResponse.json({
      exists: true,
      settings: {
        apiKeys: JSON.parse(settings.apiKeys),
        customModels: JSON.parse(settings.customModels),
        disabledPredefinedModels: JSON.parse(settings.disabledPredefinedModels),
        evaluator: {
          model: settings.evaluatorModel,
          provider: settings.evaluatorProvider,
          apiKeyId: settings.evaluatorApiKeyId,
        },
        preferences: {
          theme: settings.theme,
          concurrency: settings.concurrency,
          timeoutEnabled: settings.timeoutEnabled,
          timeoutSec: settings.timeoutSec,
          maxTokens: settings.maxTokens,
          exportFormat: settings.exportFormat,
          includeMetrics: settings.includeMetrics,
          includeExplanations: settings.includeExplanations,
        },
        autoSync: settings.autoSync,
        lastSync: settings.updatedAt,
      },
    });
  } catch (error) {
    logError(error, { context: "GET /api/settings" });
    const response = errorResponse(error);
    return NextResponse.json(response, {
      status: getStatusCode(error as any),
    });
  }
}

/**
 * POST handler - Save user settings to database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId || DEFAULT_USER_ID;

    const validationResult = SettingsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid settings data",
          details: validationResult.error.format(),
        },
      }, { status: 400 });
    }

    const data = validationResult.data;

    // Upsert user settings
    const settings = await prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        apiKeys: JSON.stringify(data.apiKeys),
        customModels: JSON.stringify(data.customModels),
        disabledPredefinedModels: JSON.stringify(data.disabledPredefinedModels),
        evaluatorModel: data.evaluatorModel,
        evaluatorProvider: data.evaluatorProvider,
        evaluatorApiKeyId: data.evaluatorApiKeyId,
        theme: data.theme,
        concurrency: data.concurrency,
        timeoutEnabled: data.timeoutEnabled,
        timeoutSec: data.timeoutSec,
        maxTokens: data.maxTokens,
        exportFormat: data.exportFormat,
        includeMetrics: data.includeMetrics,
        includeExplanations: data.includeExplanations,
        autoSync: data.autoSync,
      },
      update: {
        apiKeys: JSON.stringify(data.apiKeys),
        customModels: JSON.stringify(data.customModels),
        disabledPredefinedModels: JSON.stringify(data.disabledPredefinedModels),
        evaluatorModel: data.evaluatorModel,
        evaluatorProvider: data.evaluatorProvider,
        evaluatorApiKeyId: data.evaluatorApiKeyId,
        theme: data.theme,
        concurrency: data.concurrency,
        timeoutEnabled: data.timeoutEnabled,
        timeoutSec: data.timeoutSec,
        maxTokens: data.maxTokens,
        exportFormat: data.exportFormat,
        includeMetrics: data.includeMetrics,
        includeExplanations: data.includeExplanations,
        autoSync: data.autoSync,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Settings saved successfully",
      settings: {
        id: settings.id,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    logError(error, { context: "POST /api/settings" });
    const response = errorResponse(error);
    return NextResponse.json(response, {
      status: getStatusCode(error as any),
    });
  }
}

/**
 * DELETE handler - Clear user settings from database
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId") || DEFAULT_USER_ID;

    const deleted = await prisma.userSettings.deleteMany({
      where: { userId },
    });

    return NextResponse.json({
      success: true,
      message: deleted.count > 0 ? "Settings deleted" : "No settings found",
      deleted,
    });
  } catch (error) {
    logError(error, { context: "DELETE /api/settings" });
    const response = errorResponse(error);
    return NextResponse.json(response, {
      status: getStatusCode(error as any),
    });
  }
}
