# LLM Benchmark Comparison - Multi-Phase Implementation Plan

**Context:** Single-user, locally-hosted application. User clones the repo and runs it locally. No authentication, no multi-tenancy, no cloud hosting.

**Current Tech Stack:**
- Next.js 15.1.3 with App Router
- React 19.0.0
- TypeScript 5.7.2
- Prisma 6.1.0 with SQLite
- Radix UI + Tailwind CSS
- Vitest for testing

**Current State:**
- Single-user application with userId: "default"
- Settings stored in database with localStorage sync
- API keys stored in database (base64 encoded)
- No session management needed

---

## Phase 1: Real-time Benchmark Progress

**Status:** [x] COMPLETED

### Overview
Implement real-time progress updates for benchmark runs, providing live feedback during long-running operations using Server-Sent Events (SSE) - simpler than WebSockets and works great for single-user local apps.

### 1.1 Database Schema Changes

```prisma
// Add to existing BenchmarkRun model
model BenchmarkRun {
  // ... existing fields ...
  progressId     String?  // For SSE targeting
}

// Add progress tracking model
model BenchmarkProgress {
  id              String   @id @default(cuid())
  benchmarkRunId  String
  stepName        String
  stepNumber      Int
  totalSteps      Int
  status          String   // pending, running, completed, failed
  message         String?
  percentage      Float    @default(0)
  metadata        String?  // JSON for additional data
  createdAt       DateTime @default(now())

  benchmarkRun    BenchmarkRun @relation(fields: [benchmarkRunId], references: [id], onDelete: Cascade)

  @@index([benchmarkRunId])
  @@index([createdAt])
}

// Add log entries model
model BenchmarkLog {
  id              String   @id @default(cuid())
  benchmarkRunId  String
  level           String   // info, warning, error, debug
  message         String
  metadata        String?  // JSON context
  timestamp       DateTime @default(now())

  benchmarkRun    BenchmarkRun @relation(fields: [benchmarkRunId], references: [id], onDelete: Cascade)

  @@index([benchmarkRunId])
  @@index([timestamp])
}
```

### 1.2 File Structure

```
src/lib/realtime/
├── index.ts                    # Exports
├── progress.ts                # Progress tracking utilities
├── sse.ts                    # Server-Sent Events implementation
└── handlers/
    └── benchmark.ts           # Benchmark progress handlers

src/app/api/benchmarks/[id]/
└── progress/
    └── route.ts              # SSE endpoint for progress

src/components/realtime/
├── ProgressBar.tsx           # Real-time progress bar
├── LogStream.tsx             # Live log streaming
└── useBenchmarkProgress.ts  # Hook for benchmark progress
```

### 1.3 SSE Implementation

```typescript
// src/lib/realtime/sse.ts
export interface SSEMessage {
  event?: string;
  data: unknown;
}

export class SSEEmitter {
  private controller: ReadableStreamDefaultController | null = null;

  getStream(): ReadableStream {
    return new ReadableStream({
      start: (controller) => {
        this.controller = controller;
      },
      cancel: () => {
        this.controller = null;
      },
    });
  }

  emit(event: string, data: unknown): void {
    if (!this.controller) return;

    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    this.controller.enqueue(new TextEncoder().encode(message));
  }

  progress(data: ProgressData): void {
    this.emit('progress', data);
  }

  log(data: LogData): void {
    this.emit('log', data);
  }

  complete(data: unknown): void {
    this.emit('complete', data);
  }

  error(message: string): void {
    this.emit('error', { message });
  }

  close(): void {
    if (this.controller) {
      this.controller.close();
      this.controller = null;
    }
  }
}

// Store active emitters by run ID
const activeEmitters = new Map<string, SSEEmitter>();

export function getEmitter(runId: string): SSEEmitter {
  if (!activeEmitters.has(runId)) {
    activeEmitters.set(runId, new SSEEmitter());
  }
  return activeEmitters.get(runId)!;
}

export function closeEmitter(runId: string): void {
  const emitter = activeEmitters.get(runId);
  if (emitter) {
    emitter.close();
    activeEmitters.delete(runId);
  }
}
```

### 1.4 Progress Broadcasting

```typescript
// src/lib/realtime/progress.ts
import { getEmitter } from './sse';

export interface ProgressData {
  benchmarkRunId: string;
  stepName: string;
  stepNumber: number;
  totalSteps: number;
  percentage: number;
  status: string;
  message?: string;
}

export interface LogData {
  benchmarkRunId: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  metadata?: unknown;
  timestamp: string;
}

export function broadcastProgress(data: ProgressData): void {
  const emitter = getEmitter(data.benchmarkRunId);
  emitter.progress(data);
}

export function broadcastLog(data: LogData): void {
  const emitter = getEmitter(data.benchmarkRunId);
  emitter.log(data);
}

export function broadcastComplete(benchmarkRunId: string, results: unknown): void {
  const emitter = getEmitter(benchmarkRunId);
  emitter.complete(results);
}

export function broadcastError(benchmarkRunId: string, error: string): void {
  const emitter = getEmitter(benchmarkRunId);
  emitter.error(error);
}
```

### 1.5 API Route

```typescript
// src/app/api/benchmarks/[id]/progress/route.ts
import { getEmitter } from '@/lib/realtime/sse';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const emitter = getEmitter(params.id);
  const stream = emitter.getStream();

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### 1.6 UI Components

#### 1.6.1 Progress Bar Component

```typescript
// src/components/realtime/ProgressBar.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface ProgressData {
  stepName: string;
  stepNumber: number;
  totalSteps: number;
  percentage: number;
  status: string;
  message?: string;
}

interface ProgressBarProps {
  benchmarkRunId: string;
  onComplete?: (results: unknown) => void;
  onError?: (error: string) => void;
}

export function ProgressBar({ benchmarkRunId, onComplete, onError }: ProgressBarProps) {
  const [progress, setProgress] = useState<ProgressData>({
    stepName: 'Initializing...',
    stepNumber: 0,
    totalSteps: 1,
    percentage: 0,
    status: 'pending',
  });
  const [logs, setLogs] = useState<Array<{ level: string; message: string; timestamp: string }>>([]);

  useEffect(() => {
    const eventSource = new EventSource(`/api/benchmarks/${benchmarkRunId}/progress`);

    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      setProgress(data);
    });

    eventSource.addEventListener('log', (e) => {
      const data = JSON.parse(e.data);
      setLogs(prev => [...prev, data]);
    });

    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      onComplete?.(data);
      eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
      const data = JSON.parse(e.data);
      onError?.(data.message);
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, [benchmarkRunId, onComplete, onError]);

  const statusIcon = {
    pending: <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />,
    running: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
    completed: <CheckCircle2 className="h-5 w-5 text-green-500" />,
    failed: <XCircle className="h-5 w-5 text-red-500" />,
  }[progress.status] || <Loader2 className="h-5 w-5 animate-spin" />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {statusIcon}
            {progress.stepName}
          </CardTitle>
          <Badge variant={progress.status === 'failed' ? 'destructive' : 'secondary'}>
            {progress.percentage.toFixed(0)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progress.percentage} />

        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Step {progress.stepNumber} of {progress.totalSteps}</span>
          {progress.message && <span>{progress.message}</span>}
        </div>

        {logs.length > 0 && (
          <div className="mt-4 max-h-48 overflow-y-auto font-mono text-xs bg-muted p-2 rounded">
            {logs.slice(-10).map((log, i) => (
              <div
                key={i}
                className={cn(
                  'py-0.5',
                  log.level === 'error' && 'text-red-500',
                  log.level === 'warning' && 'text-yellow-500',
                  log.level === 'info' && 'text-blue-400'
                )}
              >
                [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 1.7 Integration with Benchmark Runner

Modify the benchmark runner to emit progress:

```typescript
// src/lib/benchmark/runner.ts
import { broadcastProgress, broadcastLog, broadcastComplete } from '@/lib/realtime/progress';

export async function runBenchmark(benchmarkRunId: string) {
  const run = await prisma.benchmarkRun.findUnique({
    where: { id: benchmarkRunId },
    include: { benchmark: true },
  });

  if (!run) throw new Error('Benchmark run not found');

  const models = await getSelectedModels();
  const totalSteps = models.length * 2; // run + evaluate per model

  try {
    broadcastProgress({
      benchmarkRunId,
      stepName: 'Initializing benchmark',
      stepNumber: 0,
      totalSteps,
      percentage: 0,
      status: 'running',
    });

    broadcastLog({
      benchmarkRunId,
      level: 'info',
      message: `Starting benchmark: ${run.benchmark.name}`,
      timestamp: new Date().toISOString(),
    });

    for (let i = 0; i < models.length; i++) {
      const model = models[i];

      // Model execution step
      const execStep = i * 2 + 1;
      broadcastProgress({
        benchmarkRunId,
        stepName: `Running ${model.name}`,
        stepNumber: execStep,
        totalSteps,
        percentage: (execStep / totalSteps) * 100,
        status: 'running',
      });

      broadcastLog({
        benchmarkRunId,
        level: 'info',
        message: `Executing model: ${model.name}`,
        timestamp: new Date().toISOString(),
      });

      const result = await executeModel(run, model);

      // Evaluation step
      const evalStep = i * 2 + 2;
      broadcastProgress({
        benchmarkRunId,
        stepName: `Evaluating ${model.name}`,
        stepNumber: evalStep,
        totalSteps,
        percentage: (evalStep / totalSteps) * 100,
        status: 'running',
      });

      await evaluateResult(result);
    }

    broadcastComplete(benchmarkRunId, { success: true });
  } catch (error) {
    broadcastLog({
      benchmarkRunId,
      level: 'error',
      message: `Benchmark failed: ${error.message}`,
      timestamp: new Date().toISOString(),
    });
    broadcastError(benchmarkRunId, error.message);
  }
}
```

### 1.8 Acceptance Criteria

1. [ ] Progress bar updates in real-time during benchmark runs
2. [ ] Current step name is displayed
3. [ ] Percentage indicator is accurate
4. [ ] Live log stream shows all output
5. [ ] Completed runs show final results
6. [ ] Failed runs show error information
7. [ ] SSE connection closes properly on completion
8. [ ] Progress persists on page refresh (reconnects)
9. [ ] Visual feedback for all status states

---

## Phase 2: Advanced Analytics Dashboard

**Status:** [ ] NOT STARTED

### Overview
Build comprehensive analytics dashboard with visualizations, trends, cost tracking, and performance insights for local benchmark runs.

### 2.1 Database Schema Changes

```prisma
// Add cost tracking to ModelRun
model ModelRun {
  // ... existing fields ...
  inputTokens     Int?
  outputTokens    Int?
  cacheReadTokens Int?
  cacheWriteTokens Int?

  // Cost breakdown
  promptCost      Float?
  completionCost  Float?
  cacheCost       Float?
  totalCost       Float?
}

// Add analytics aggregation tables
model BenchmarkStats {
  id              String   @id @default(cuid())
  benchmarkId     String
  modelId         String

  // Aggregated metrics
  avgScore        Float
  minScore        Float
  maxScore        Float
  runCount        Int
  successRate     Float

  // Cost metrics
  avgCost         Float?
  totalCost       Float?
  avgTokens       Int?

  // Time period
  period          String   // day, week, month, all
  periodStart     DateTime
  periodEnd       DateTime

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([benchmarkId, modelId, period, periodStart])
  @@index([benchmarkId])
  @@index([modelId])
  @@index([periodStart])
}

// Add cost tracking model
model CostTracking {
  id              String   @id @default(cuid())
  period          String   @default("month") // day, week, month, year

  // Cost totals
  totalCost       Float    @default(0)
  openaiCost      Float    @default(0)
  anthropicCost   Float    @default(0)
  openrouterCost  Float    @default(0)
  customCost      Float    @default(0)

  // Token totals
  totalTokens     Int      @default(0)
  inputTokens     Int      @default(0)
  outputTokens    Int      @default(0)

  // Run counts
  totalRuns       Int      @default(0)
  successfulRuns  Int      @default(0)
  failedRuns      Int      @default(0)

  periodStart     DateTime
  periodEnd       DateTime

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([period, periodStart])
  @@index([periodStart])
}

// Add performance tracking
model PerformanceMetric {
  id              String   @id @default(cuid())
  benchmarkRunId  String   @unique

  // Timing metrics
  totalDuration   Int      // milliseconds
  avgModelDuration Int
  minModelDuration Int
  maxModelDuration Int

  createdAt       DateTime @default(now())

  @@index([benchmarkRunId])
}
```

### 2.2 File Structure

```
src/app/analytics/
├── page.tsx                    # Main dashboard
└── components/
    ├── DashboardOverview.tsx   # Main overview cards
    ├── TrendChart.tsx         # Performance trends
    ├── CostChart.tsx          # Cost visualization
    ├── ComparisonChart.tsx    # Model comparison
    ├── Heatmap.tsx           # Performance heatmap
    └── TimeRangeSelector.tsx  # Period selection

src/lib/analytics/
├── index.ts
├── aggregators.ts             # Data aggregation
├── calculators.ts             # Metric calculations
└── queries.ts                 # Database queries

src/app/api/analytics/
├── route.ts                   # General stats
├── trends/route.ts           # Trend data
├── costs/route.ts            # Cost data
└── performance/route.ts      # Performance metrics
```

### 2.3 API Endpoints

#### 2.3.1 Overview Stats (`/api/analytics`)
```typescript
interface AnalyticsOverview {
  overview: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    successRate: number;
  };
  costs: {
    totalCost: number;
    avgCostPerRun: number;
    byProvider: Record<string, number>;
  };
  models: {
    tested: number;
    topPerformers: ModelRanking[];
  };
}
```

#### 2.3.2 Trends Data (`/api/analytics/trends?period=7d|30d|90d|all&benchmarkId=optional`)
```typescript
interface TrendData {
  scores: {
    dates: string[];
    models: {
      modelId: string;
      modelName: string;
      data: number[];
    }[];
  };
  costs: {
    dates: string[];
    cumulative: number[];
    daily: number[];
  };
}
```

#### 2.3.3 Cost Data (`/api/analytics/costs?period=7d|30d|90d|all`)
```typescript
interface CostData {
  total: number;
  byProvider: { provider: string; cost: number; percentage: number }[];
  byModel: { modelId: string; modelName: string; cost: number; runs: number }[];
  tokens: {
    total: number;
    input: number;
    output: number;
  };
}
```

### 2.4 UI Components

```typescript
// src/app/analytics/components/DashboardOverview.tsx
'use client';

import { useSWR } from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, CheckCircle, XCircle, DollarSign, TrendingUp } from 'lucide-react';

export function DashboardOverview() {
  const { data } = useSWR('/api/analytics');

  if (!data) return <div>Loading...</div>;

  const cards = [
    {
      title: 'Total Runs',
      value: data.overview.totalRuns,
      icon: Activity,
      color: 'text-blue-500',
    },
    {
      title: 'Success Rate',
      value: `${(data.overview.successRate * 100).toFixed(1)}%`,
      icon: CheckCircle,
      color: 'text-green-500',
    },
    {
      title: 'Total Cost',
      value: `$${data.costs.totalCost.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-yellow-500',
    },
    {
      title: 'Avg Cost/Run',
      value: `$${data.costs.avgCostPerRun.toFixed(4)}`,
      icon: TrendingUp,
      color: 'text-purple-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={cn('h-4 w-4', card.color)} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### 2.5 Acceptance Criteria

1. [ ] Overview cards show accurate statistics
2. [ ] Trend charts display historical data
3. [ ] Cost breakdown by provider is visible
4. [ ] Token usage is tracked and displayed
5. [ ] Heatmap shows model vs benchmark performance
6. [ ] Time range selector filters all charts
7. [ ] Charts render correctly on local data
8. [ ] Empty states show helpful messages
9. [ ] All charts have tooltips

---

## Phase 3: Bulk Benchmark Operations

**Status:** [x] COMPLETED

### Overview
Enable running multiple benchmarks at once with configurable concurrency and batch management.

### 3.1 Database Schema Changes

```prisma
// Added models:
// - BenchmarkBatch: Main batch configuration and tracking
// - BenchmarkBatchRun: Individual batch runs linked to BenchmarkBatch
// - BatchRunResult: Denormalized results for efficient queries
// - BatchConfig: Saved batch configurations for reuse
// - BenchmarkCollection: Enhanced for batch operations
// All models include proper indexes for performance
```

### 3.2 File Structure

```
src/lib/batch/
├── index.ts                  # Exports
├── executor.ts               # Batch execution logic
├── types.ts                 # Type definitions
└── config.ts                # Configuration management and validation

src/app/api/batch/
├── route.ts                 # List/create batches
├── [id]/
│   ├── route.ts             # Get/update/delete batch
│   └── export/route.ts    # Export batch results as CSV
└── configs/
    ├── route.ts             # List/create batch configurations
    └── [id]/route.ts      # Get/update/delete configuration

src/components/batch/
├── index.ts                 # Exports
├── BatchRunner.tsx          # Configure and start batch runs
├── BatchResults.tsx         # Display batch results with rankings
├── BatchHistory.tsx         # View and manage past batches
└── BatchConfigManager.tsx   # Manage saved configurations

src/app/batch/
└── page.tsx                # Batch operations page
```

### 3.3 Batch Execution Logic

```typescript
// src/lib/batch/executor.ts
export class BatchExecutor {
  private batchId: string;
  private config: BatchConfig;

  constructor(batchId: string, config: BatchConfig) {
    this.batchId = batchId;
    this.config = config;
  }

  async execute(): Promise<void> {
    await prisma.benchmarkBatch.update({
      where: { id: this.batchId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    const benchmarkIds = JSON.parse(this.config.benchmarkIds) as string[];
    const modelIds = JSON.parse(this.config.modelIds) as string[];
    const totalRuns = benchmarkIds.length * modelIds.length;

    let completedRuns = 0;
    let failedRuns = 0;

    for (const benchmarkId of benchmarkIds) {
      // Create benchmark run
      const benchmarkRun = await prisma.benchmarkRun.create({
        data: {
          benchmarkId,
          batchId: this.batchId,
          status: 'PENDING',
          concurrency: this.config.concurrency,
          evaluator: this.config.evaluatorModel,
        },
      });

      // Execute with progress
      try {
        await runBenchmark(benchmarkRun.id);
        completedRuns++;
      } catch {
        failedRuns++;
      }

      // Update progress
      await prisma.benchmarkBatch.update({
        where: { id: this.batchId },
        data: { completedRuns, failedRuns },
      });

      broadcastProgress(this.batchId, {
        stepName: `Completed ${benchmarkId}`,
        stepNumber: completedRuns + failedRuns,
        totalSteps: totalRuns,
        percentage: ((completedRuns + failedRuns) / totalRuns) * 100,
        status: 'running',
      });
    }

    await prisma.benchmarkBatch.update({
      where: { id: this.batchId },
      data: {
        status: failedRuns === 0 ? 'COMPLETED' : 'PARTIAL',
        completedAt: new Date(),
        completedRuns,
        failedRuns,
        totalRuns,
      },
    });
  }
}
```

### 3.4 UI Components

```typescript
// Implemented components:
// - BatchRunner.tsx: Configure and start batch runs
//   * Multi-select for benchmarks (grouped by category)
//   * Multi-select for models
//   * Concurrency slider
//   * Evaluator selection
//   * Real-time estimates (time, cost, runs)
//   * Warnings for large batches
//
// - BatchResults.tsx: Display batch results
//   * Overall summary cards
//   * Model rankings table with trophies for top 3
//   * Detailed results by benchmark
//   * Real-time progress for running batches
//   * Export functionality
//
// - BatchHistory.tsx: View and manage past batches
//   * Search and filter batches
//   * Status badges
//   * Delete with confirmation
//   * Click to view details
//
// - BatchConfigManager.tsx: Manage saved configurations
//   * Create, update, delete configs
//   * Toggle active status
//   * Load config into runner
```

### 3.5 Acceptance Criteria

1. [x] Users can select multiple benchmarks
2. [x] Users can select multiple models
3. [x] Users can configure concurrency
4. [x] Batch execution shows live progress
5. [x] Batch can be cancelled mid-execution
6. [x] Batch results are aggregated
7. [x] Failed runs don't stop batch execution (partial completion)
8. [x] Batch history is preserved
9. [x] Results include model rankings
10. [x] CSV export functionality
11. [x] Cost and time estimation before running
12. [x] Saved configurations support
13. [x] Page available at /batch route

---

## Phase 4: Export Enhancements

**Status:** [ ] NOT STARTED

### Overview
Enhance export capabilities with Excel format, PDF reports, and customizable templates.

### 4.1 Dependencies

```bash
npm install xlsx jspdf html2canvas
npm install -D @types/jspdf @types/html2canvas
```

### 4.2 File Structure

```
src/lib/export/
├── index.ts
├── formatters/
│   ├── csv.ts               # CSV export
│   ├── excel.ts            # Excel export
│   ├── pdf.ts              # PDF export
│   └── json.ts             # JSON export
└── templates/
    ├── default.ts           # Default template
    ├── detailed.ts          # Detailed template
    └── executive.ts         # Executive summary template

src/app/api/export/
├── route.ts                # Generic export endpoint
└── [id]/route.ts           # Export specific run

src/components/export/
├── ExportButton.tsx        # Enhanced export button
└── TemplateSelector.tsx    # Template selection
```

### 4.3 Excel Export Implementation

```typescript
// src/lib/export/formatters/excel.ts
import * as XLSX from 'xlsx';

export interface ExcelSheet {
  name: string;
  data: unknown[];
  columns: { header: string; key: string; width?: number }[];
}

export async function exportToExcel(sheets: ExcelSheet[]): Promise<Blob> {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const headers = sheet.columns.map(c => c.header);
    const rows = sheet.data.map(row =>
      sheet.columns.map(col => (row as Record<string, unknown>)[col.key])
    );

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = sheet.columns.map(col => ({ wch: col.width || 15 }));
    XLSX.utils.book_append_sheet(workbook, ws, sheet.name);
  }

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function createBenchmarkResultsSheet(results: BenchmarkResult[]): ExcelSheet {
  return {
    name: 'Results',
    data: results,
    columns: [
      { header: 'Model', key: 'modelName', width: 25 },
      { header: 'Score', key: 'score', width: 10 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Tokens', key: 'tokensUsed', width: 12 },
      { header: 'Cost ($)', key: 'cost', width: 12 },
      { header: 'Duration (ms)', key: 'duration', width: 15 },
    ],
  };
}
```

### 4.4 PDF Export Implementation

```typescript
// src/lib/export/formatters/pdf.ts
import jsPDF from 'jspdf';

export interface PdfOptions {
  title: string;
  sections: PdfSection[];
}

export async function exportToPdf(options: PdfOptions): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', format: 'A4' });

  let yPosition = 20;

  // Title
  doc.setFontSize(20);
  doc.text(options.title, 20, yPosition);
  yPosition += 20;

  // Sections
  for (const section of options.sections) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.text(section.title, 20, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    const lines = doc.splitTextToSize(section.content, 170);
    doc.text(lines, 20, yPosition);
    yPosition += lines.length * 6 + 10;
  }

  return doc.output('blob');
}
```

### 4.5 Export Button Component

```typescript
// src/components/export/ExportButton.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Code } from 'lucide-react';

interface ExportButtonProps {
  benchmarkRunId: string;
}

export function ExportButton({ benchmarkRunId }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf' | 'json') => {
    setExporting(true);
    try {
      const response = await fetch(`/api/export/${benchmarkRunId}?format=${format}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `benchmark-${benchmarkRunId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={exporting}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleExport('xlsx')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel (XLSX)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="h-4 w-4 mr-2" />
          PDF Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('json')}>
          <Code className="h-4 w-4 mr-2" />
          JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 4.6 Acceptance Criteria

1. [ ] Users can export results as Excel (XLSX)
2. [ ] Excel exports include multiple sheets
3. [ ] Users can export results as PDF reports
4. [ ] PDF reports include charts
5. [ ] CSV export is available
6. [ ] JSON export is available for data portability
7. [ ] Export includes metadata (date, benchmark name)
8. [ ] Export handles large datasets without timeout

---

## Phase 5: Improved Error Handling & Retry Logic

**Status:** [ ] NOT STARTED

### Overview
Implement comprehensive error handling with automatic retries, exponential backoff, and user-friendly error messages.

### 5.1 File Structure

```
src/lib/error-handling/
├── index.ts
├── retry.ts                    # Retry logic with exponential backoff
├── errors.ts                   # Custom error classes
└── handlers.ts                 # Error handlers

src/lib/api-client/
├── llm-client.ts              # LLM API client with retry
├── queue.ts                   # Request queue management
└── rate-limiter.ts           # Rate limiting

src/components/error/
├── ErrorDisplay.tsx           # User-friendly error display
└── RetryButton.tsx            # Retry action button
```

### 5.2 Retry Logic Implementation

```typescript
// src/lib/error-handling/retry.ts
export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;

      // Check if error is retryable
      const isRetryable = isRetryableError(error as Error);

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      onRetry?.(attempt, error as Error);

      // Wait with jitter
      await sleep(delay + Math.random() * 500);

      // Calculate next delay
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw new Error('Max retry attempts exceeded');
}

function isRetryableError(error: Error): boolean {
  const retryableCodes = ['RATE_LIMIT', 'TIMEOUT', 'CONNECTION_ERROR', '429', '500', '502', '503', '504'];
  return retryableCodes.some(code =>
    error.message.includes(code) || (error as any).code === code
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 5.3 LLM Client with Retry

```typescript
// src/lib/api-client/llm-client.ts
import { retryWithBackoff } from '@/lib/error-handling/retry';

export class LLMClient {
  private queue: RequestQueue;
  private rateLimiter: RateLimiter;

  constructor(private provider: string, private apiKey: string) {
    this.queue = new RequestQueue({ concurrency: 5 });
    this.rateLimiter = new RateLimiter({ maxRequests: 50, perMilliseconds: 60000 });
  }

  async call(prompt: string, options?: CallOptions): Promise<LLMResponse> {
    return this.queue.add(() => this.executeCall(prompt, options));
  }

  private async executeCall(prompt: string, options?: CallOptions): Promise<LLMResponse> {
    await this.rateLimiter.acquire();

    return retryWithBackoff(
      async () => {
        const response = await fetch(this.getEndpoint(), {
          method: 'POST',
          headers: this.getHeaders(options),
          body: JSON.stringify(this.buildBody(prompt, options)),
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new Error(`RATE_LIMIT: Retry after ${retryAfter || 'unknown'}s`);
        }

        if (!response.ok) {
          throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        return response.json();
      },
      {
        maxAttempts: 5,
        initialDelay: 2000,
        maxDelay: 60000,
      }
    );
  }
}
```

### 5.4 Error Display Component

```typescript
// src/components/error/ErrorDisplay.tsx
'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ErrorDisplayProps {
  error: Error;
  onRetry?: () => void;
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  const isRetryable = isRetryableError(error);

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        <p className="mb-2">{getUserFriendlyMessage(error)}</p>

        {isRetryable && onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4">
            <summary className="text-sm cursor-pointer">Technical details</summary>
            <pre className="mt-2 text-xs bg-background p-2 rounded overflow-auto max-h-32">
              {error.stack || error.message}
            </pre>
          </details>
        )}
      </AlertDescription>
    </Alert>
  );
}

function getUserFriendlyMessage(error: Error): string {
  if (error.message.includes('RATE_LIMIT')) {
    return 'Too many requests. Please wait a moment.';
  }
  if (error.message.includes('TIMEOUT')) {
    return 'The request took too long. Please try again.';
  }
  if (error.message.includes('CONNECTION_ERROR')) {
    return 'Could not connect to the service. Check your internet connection.';
  }
  return 'Something went wrong. Please try again.';
}

function isRetryableError(error: Error): boolean {
  const retryablePatterns = ['RATE_LIMIT', 'TIMEOUT', 'CONNECTION_ERROR', '500', '502', '503', '504'];
  return retryablePatterns.some(pattern => error.message.includes(pattern));
}
```

### 5.5 Acceptance Criteria

1. [ ] Failed API calls are automatically retried
2. [ ] Retry uses exponential backoff
3. [ ] Jitter prevents request spikes
4. [ ] Rate limits are detected and respected
5. [ ] User sees friendly error messages
6. [ ] Retry button appears when appropriate
7. [ ] Queue prevents overwhelming the API
8. [ ] Technical details shown in dev mode

---

## Phase 6: UI/UX Improvements

**Status:** [ ] NOT STARTED

### Overview
Polish the user interface with better loading states, mobile responsiveness, and overall UX improvements.

### 6.1 File Structure

```
src/components/ui/
├── skeleton.tsx               # Loading skeleton
├── loading.tsx                # Full-page loading
└── empty-state.tsx            # Empty state component

src/styles/
└── responsive.css             # Responsive utilities
```

### 6.2 Loading Skeletons

```typescript
// src/components/ui/skeleton.tsx
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

// Usage examples
export function BenchmarkCardSkeleton() {
  return (
    <div className="p-4 border rounded-lg space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
```

### 6.3 Empty State Component

```typescript
// src/components/ui/empty-state.tsx
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">{description}</p>
      {action && (
        <button onClick={action.onClick} className="btn-primary">
          {action.label}
        </button>
      )}
    </div>
  );
}
```

### 6.4 Mobile Responsiveness

Add responsive breakpoints to Tailwind config:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
  },
};
```

### 6.5 Acceptance Criteria

1. [ ] All pages work on mobile (320px+)
2. [ ] Touch targets are at least 44x44px
3. [ ] Skeleton screens shown during data loading
4. [ ] Empty states provide helpful guidance
5. [ ] Tables are horizontally scrollable on mobile
6. [ ] Navigation works without hover
7. [ ] Forms are easy to complete on mobile
8. [ ] Dark mode is consistent across all pages

---

## Phase 7: API Key Encryption

**Status:** [ ] NOT STARTED

### Overview
Encrypt API keys at rest using AES-256-GCM with a local encryption key.

### 7.1 File Structure

```
src/lib/encryption/
├── index.ts
├── crypto.ts                  # Encryption utilities
└── key-manager.ts            # Manage encryption keys
```

### 7.2 Encryption Implementation

```typescript
// src/lib/encryption/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;

// Get or create encryption key from environment
function getEncryptionKey(): Buffer {
  // In production, use a proper key management system
  // For local single-user, we can derive from a local secret
  const secret = process.env.ENCRYPTION_SECRET || 'default-local-secret';
  const salt = Buffer.from(secret.slice(0, SALT_LENGTH));
  return scryptSync(secret, salt, KEY_LENGTH);
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

export function decrypt(data: EncryptedData): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(data.iv, 'hex');
  const tag = Buffer.from(data.tag, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// For storing in database (JSON format)
export function encryptForStorage(value: string): string {
  const encrypted = encrypt(value);
  return JSON.stringify(encrypted);
}

export function decryptFromStorage(stored: string): string {
  const encrypted = JSON.parse(stored) as EncryptedData;
  return decrypt(encrypted);
}
```

### 7.3 Acceptance Criteria

1. [ ] API keys are encrypted before storing in database
2. [ ] Keys are decrypted only when needed for API calls
3. [ ] Encryption uses AES-256-GCM
4. [ ] IV is unique for each encryption
5. [ ] Authentication tag is verified on decryption
6. [ ] Existing keys can be migrated to encrypted format

---

## Phase 8: Performance Optimizations

**Status:** [ ] NOT STARTED

### Overview
Optimize database queries, add caching, and improve overall performance.

### 8.1 Database Indexes

```prisma
// Add to existing models
model Benchmark {
  // ... existing fields ...
  @@index([primaryCategory])
  @@index([isPublic])
  @@index([createdAt])
}

model BenchmarkRun {
  // ... existing fields ...
  @@index([status])
  @@index([startedAt])
  @@index([benchmarkId, status])
}

model ModelRun {
  // ... existing fields ...
  @@index([benchmarkRunId, modelId])
  @@index([status])
}
```

### 8.2 Query Optimization

```typescript
// src/lib/db/queries.ts
// Optimized queries with select and include

export async function getBenchmarkRunWithModels(id: string) {
  return prisma.benchmarkRun.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      benchmark: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      modelRuns: {
        select: {
          id: true,
          modelId: true,
          status: true,
          output: true,
          totalCost: true,
          tokensUsed: true,
          scores: {
            select: {
              value: true,
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

// Batch queries with select
export async function getRecentBenchmarks(limit = 20) {
  return prisma.benchmark.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      primaryCategory: true,
      isSystem: true,
      createdAt: true,
      _count: {
        select: { runs: true },
      },
    },
  });
}
```

### 8.3 Acceptance Criteria

1. [ ] Database indexes added for common queries
2. [ ] Queries use select to limit returned fields
3. [ ] N+1 queries eliminated
4. [ ] Page load time under 2 seconds
5. [ ] API response time under 500ms

---

## Phase 9: Testing & Quality

**Status:** [ ] NOT STARTED

### Overview
Add comprehensive tests for critical functionality.

### 9.1 Test Structure

```
src/lib/__tests__/
├── scoring.test.ts
├── encryption.test.ts
├── retry.test.ts
└── export.test.ts

src/app/api/__tests__/
├── benchmarks.test.ts
├── settings.test.ts
└── export.test.ts
```

### 9.2 Example Tests

```typescript
// src/lib/__tests__/retry.test.ts
import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff } from '../retry';

describe('retryWithBackoff', () => {
  it('should succeed on first try', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('CONNECTION_ERROR'))
      .mockResolvedValue('success');
    const result = await retryWithBackoff(fn, { maxAttempts: 3 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should give up after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('PERMANENT_ERROR'));
    await expect(retryWithBackoff(fn, { maxAttempts: 2 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
```

### 9.3 Acceptance Criteria

1. [ ] Unit tests for utilities (retry, encryption, scoring)
2. [ ] Integration tests for API routes
3. [ ] Tests run in CI/CD
4. [ ] Code coverage > 60%

---

## Phase 10: Documentation

**Status:** [ ] NOT STARTED

### Overview
Create comprehensive documentation for users and contributors.

### 10.1 Documentation Structure

```
docs/
├── README.md                  # Main README
├── GETTING_STARTED.md         # Setup guide
├── BENCHMARKS.md             # Benchmark guide
├── SETTINGS.md               # Settings configuration
├── API.md                    # API documentation
└── DEVELOPMENT.md            # Contributing guide
```

### 10.2 README Sections

1. Project overview
2. Features
3. Prerequisites
4. Installation
5. Configuration
6. Usage
7. Troubleshooting

### 10.3 Acceptance Criteria

1. [ ] README with setup instructions
2. [ ] Feature documentation
3. [ ] Configuration guide
4. [ ] Troubleshooting section
5. [ ] Screenshots of UI

---

## Implementation Tracking

| Phase | Status | Completed Date | Notes |
|-------|--------|----------------|-------|
| 1. Real-time Progress | [x] COMPLETED | | SSE-based live updates during runs |
| 2. Advanced Analytics | [x] COMPLETED | | Cost tracking, trends, performance metrics |
| 3. Bulk Operations | [x] COMPLETED | | Batch runs with configurable concurrency, rankings, export |
| 4. Export Enhancements | [ ] NOT STARTED | | |
| 5. Error Handling | [ ] NOT STARTED | | |
| 6. UI/UX Improvements | [ ] NOT STARTED | | |
| 7. API Key Encryption | [ ] NOT STARTED | | |
| 8. Performance Optimization | [ ] NOT STARTED | | |
| 9. Testing & Quality | [ ] NOT STARTED | | |
| 10. Documentation | [ ] NOT STARTED | | |

---

*Last Updated: 2025-02-11*
