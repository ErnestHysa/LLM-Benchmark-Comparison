/**
 * History Page
 *
 * Table of all benchmark runs with filters and pagination
 */

import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout";
import { HistoryClient } from "@/components/history/HistoryClient";
import { HistoryFilters } from "@/components/history/HistoryFilters";

interface HistoryPageProps {
  searchParams: Promise<{
    page?: string;
    category?: string;
    model?: string;
    search?: string;
    status?: string;
  }>;
}

const RESULTS_PER_PAGE = 20;

async function getHistoryRuns(
  page: number,
  category?: string,
  model?: string,
  search?: string,
  status?: string
) {
  const skip = (page - 1) * RESULTS_PER_PAGE;

  const where: Record<string, unknown> = {};

  if (category) {
    where.benchmark = {
      primaryCategory: category,
    };
  }

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { benchmark: { name: { contains: search, mode: "insensitive" } } },
      { id: { contains: search, mode: "insensitive" } },
    ];
  }

  // If model filter is specified, only include runs that tested this model
  let runIds: string[] | undefined;
  if (model) {
    const modelRuns = await prisma.modelRun.findMany({
      where: { modelId: model },
      select: { benchmarkRunId: true },
      distinct: ["benchmarkRunId"],
    });
    runIds = modelRuns.map((mr) => mr.benchmarkRunId);
    if (runIds.length > 0) {
      where.id = { in: runIds };
    } else {
      // No runs for this model, return empty
      return { runs: [], total: 0, totalPages: 0 };
    }
  }

  const [runs, total] = await Promise.all([
    prisma.benchmarkRun.findMany({
      where,
      skip,
      take: RESULTS_PER_PAGE,
      orderBy: { startedAt: "desc" },
      include: {
        benchmark: {
          select: {
            id: true,
            name: true,
            primaryCategory: true,
          },
        },
        modelRuns: {
          select: {
            id: true,
            modelId: true,
            status: true,
          },
        },
      },
    }),
    prisma.benchmarkRun.count({ where }),
  ]);

  const totalPages = Math.ceil(total / RESULTS_PER_PAGE);

  return { runs, total, totalPages };
}

async function getFilterOptions() {
  const [categories, models] = await Promise.all([
    prisma.benchmarkCategory.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.modelRun.findMany({
      select: { modelId: true },
      distinct: ["modelId"],
      orderBy: { modelId: "asc" },
    }),
  ]);

  return { categories, models: models.map((m) => m.modelId) };
}

export default async function HistoryPage({
  searchParams,
}: HistoryPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const { category, model, search, status } = params;

  const [historyData, filterOptions] = await Promise.all([
    getHistoryRuns(page, category, model, search, status),
    getFilterOptions(),
  ]);

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "History" },
  ];

  // Build query string for pagination links
  const buildQueryString = (newPage: number) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (model) params.set("model", model);
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    params.set("page", newPage.toString());
    return params.toString();
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="animate-fade-in">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold text-foreground">Benchmark History</h1>
        <p className="text-muted-foreground">
          View all past benchmark runs with detailed results
        </p>
      </div>

      {/* Filters */}
      <div className="animate-fade-in-up delay-100">
        <Card className="p-4">
          <HistoryFilters
            categories={filterOptions.categories}
            models={filterOptions.models}
            initialSearch={search}
            initialCategory={category}
            initialModel={model}
            initialStatus={status}
          />
        </Card>
      </div>

      {/* Results Table */}
      <div className="animate-fade-in-up delay-200">
        <HistoryClient runs={historyData.runs as any} />

        {/* Pagination */}
        {historyData.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * RESULTS_PER_PAGE + 1} to{" "}
              {Math.min(page * RESULTS_PER_PAGE, historyData.total)} of{" "}
              {historyData.total} results
            </p>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link href={`/history?${buildQueryString(page - 1)}`}>
                  <Button variant="outline" size="sm">
                    Previous
                  </Button>
                </Link>
              )}
              <span className="text-sm text-muted-foreground">
                Page {page} of {historyData.totalPages}
              </span>
              {page < historyData.totalPages && (
                <Link href={`/history?${buildQueryString(page + 1)}`}>
                  <Button variant="outline" size="sm">
                    Next
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
