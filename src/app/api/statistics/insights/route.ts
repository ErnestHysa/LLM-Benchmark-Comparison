/**
 * GET /api/statistics/insights - AI-generated insights about benchmark data
 *
 * Uses LLM to analyze performance trends and provide recommendations
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chat } from "@/lib/llm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const benchmarkId = searchParams.get("benchmarkId");
    const limitParam = searchParams.get("limit");

    // Validate and parse limit parameter with bounds checking to prevent DoS attacks
    const MIN_LIMIT = 1;
    const MAX_LIMIT = 1000; // Upper bound to prevent memory issues and DoS
    const DEFAULT_LIMIT = 100;

    let limit: number;
    if (limitParam === null || limitParam === "") {
      limit = DEFAULT_LIMIT;
    } else {
      const parsedLimit = parseInt(limitParam, 10);

      // Check if parsing failed
      if (isNaN(parsedLimit)) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_PARAMETER",
              message: `Invalid limit parameter: must be a number between ${MIN_LIMIT} and ${MAX_LIMIT}`,
            },
          },
          { status: 400 }
        );
      }

      // Bounds checking - enforce reasonable limits to prevent DoS
      if (parsedLimit < MIN_LIMIT) {
        limit = MIN_LIMIT;
      } else if (parsedLimit > MAX_LIMIT) {
        limit = MAX_LIMIT;
      } else {
        limit = parsedLimit;
      }
    }

    // Fetch recent benchmark runs
    const runs = await prisma.benchmarkRun.findMany({
      where: {
        status: "COMPLETED",
        ...(benchmarkId && { benchmarkId }),
      },
      include: {
        benchmark: {
          select: {
            name: true,
            primaryCategory: true,
          },
        },
        modelRuns: {
          include: {
            categoryScores: true,
          },
          take: 20,
        },
      },
      orderBy: {
        startedAt: "desc",
      },
      take: limit,
    });

    // Aggregate data for insights
    const modelPerformance = new Map<string, { scores: number[]; recentScores: number[]; totalCost: number }>();
    const categoryPerformance = new Map<string, { scores: number[]; modelScores: Map<string, number[]> }>();
    const recentRuns = runs.slice(0, 10);

    for (const run of runs) {
      for (const modelRun of run.modelRuns) {
        const avgScore = modelRun.categoryScores.length > 0
          ? modelRun.categoryScores.reduce((sum, cs) => sum + cs.totalScore, 0) / modelRun.categoryScores.length
          : 0;

        // Model-level stats
        if (!modelPerformance.has(modelRun.modelId)) {
          modelPerformance.set(modelRun.modelId, { scores: [], recentScores: [], totalCost: 0 });
        }
        const modelStats = modelPerformance.get(modelRun.modelId)!;
        modelStats.scores.push(avgScore);
        modelStats.totalCost += modelRun.cost || 0;

        // Category-level stats
        const category = run.benchmark.primaryCategory;
        if (!categoryPerformance.has(category)) {
          categoryPerformance.set(category, { scores: [], modelScores: new Map() });
        }
        const catStats = categoryPerformance.get(category)!;
        catStats.scores.push(avgScore);
        if (!catStats.modelScores.has(modelRun.modelId)) {
          catStats.modelScores.set(modelRun.modelId, []);
        }
        catStats.modelScores.get(modelRun.modelId)!.push(avgScore);
      }
    }

    // Get recent scores for each model (last 10 runs)
    for (const run of recentRuns) {
      for (const modelRun of run.modelRuns) {
        const avgScore = modelRun.categoryScores.length > 0
          ? modelRun.categoryScores.reduce((sum, cs) => sum + cs.totalScore, 0) / modelRun.categoryScores.length
          : 0;
        const modelStats = modelPerformance.get(modelRun.modelId);
        if (modelStats && modelStats.recentScores.length < 10) {
          modelStats.recentScores.push(avgScore);
        }
      }
    }

    // Prepare data summary for LLM
    const summary = {
      totalRuns: runs.length,
      modelsTested: Array.from(modelPerformance.entries()).map(([id, stats]) => ({
        modelId: id,
        avgScore: stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length,
        recentAvgScore: stats.recentScores.length > 0
          ? stats.recentScores.reduce((a, b) => a + b, 0) / stats.recentScores.length
          : null,
        totalRuns: stats.scores.length,
        totalCost: stats.totalCost,
        costPerPoint: stats.totalCost > 0
          ? stats.totalCost / stats.scores.reduce((a, b) => a + b, 0)
          : 0,
      })),
      categories: Array.from(categoryPerformance.entries()).map(([cat, stats]) => ({
        category: cat,
        avgScore: stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length,
        topModel: Array.from(stats.modelScores.entries())
          .sort((a, b) => {
            const avgA = a[1].reduce((x, y) => x + y, 0) / a[1].length;
            const avgB = b[1].reduce((x, y) => x + y, 0) / b[1].length;
            return avgB - avgA;
          })[0]?.[0],
      })),
    };

    // Generate insights using LLM
    const prompt = `Analyze the following LLM benchmark data and provide actionable insights:

SUMMARY:
${JSON.stringify(summary, null, 2)}

Please provide:
1. Top 3 key findings (be specific with numbers)
2. Performance trends (improving/declining models)
3. Cost efficiency analysis
4. Recommendations for optimization

Format your response as a JSON object with these keys: "findings", "trends", "costAnalysis", "recommendations". Each should be an array of strings.`;

    // Generate insights using LLM (with graceful fallback)
    let insights;
    try {
      const response = await chat(
        "gpt-4o",
        [{ role: "system", content: "You are an expert data analyst specializing in LLM benchmarking." }, { role: "user", content: prompt }],
        { temperature: 0.3, maxTokens: 2048 },
        undefined // No apiKeys - will use configured credentials
      );

      // Try to parse JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          insights = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.error("[Insights] Failed to parse insights JSON:", parseError);
          // Fallback: structure the text response
          insights = {
            findings: ["Unable to parse structured insights"],
            trends: [],
            costAnalysis: [],
            recommendations: [],
            rawResponse: response.content,
          };
        }
      } else {
        // Fallback: structure the text response
        insights = {
          findings: ["Unable to parse structured insights"],
          trends: [],
          costAnalysis: [],
          recommendations: [],
          rawResponse: response.content,
        };
      }
    } catch (llmError) {
      // LLM call failed (likely missing API keys) - generate basic insights from data
      console.warn("[Insights] LLM call failed, using fallback:", llmError);

      // Generate basic insights from the summary data
      const topModel = summary.modelsTested.sort((a, b) => b.avgScore - a.avgScore)[0];
      const bestCategory = summary.categories.sort((a, b) => b.avgScore - a.avgScore)[0];

      insights = {
        findings: [
          `Analyzed ${summary.totalRuns} benchmark runs`,
          `Top performing model: ${topModel?.modelId || 'N/A'} with ${topModel?.avgScore.toFixed(1) || 0}% average score`,
          `Best category: ${bestCategory?.category || 'N/A'} with ${bestCategory?.avgScore.toFixed(1) || 0}% average`,
        ],
        trends: summary.modelsTested
          .filter(m => m.recentAvgScore !== null)
          .map(m => `${m.modelId}: ${m.recentAvgScore! > m.avgScore ? '↑ Improving' : m.recentAvgScore! < m.avgScore ? '↓ Declining' : '→ Stable'} (${m.avgScore.toFixed(1)}% avg, ${m.recentAvgScore!.toFixed(1)}% recent)`),
        costAnalysis: summary.modelsTested.map(m => `${m.modelId}: $${m.totalCost.toFixed(4)} total, $${m.costPerPoint.toFixed(6)} per point`),
        recommendations: [
          "Configure API keys to enable AI-powered insights",
          "Run more benchmarks to get better trend analysis",
        ],
        fallback: true,
      };
    }

    return NextResponse.json({
      summary,
      insights,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[GET /api/statistics/insights] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to generate insights" } },
      { status: 500 }
    );
  }
}
