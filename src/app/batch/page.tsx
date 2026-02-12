/**
 * Batch Page
 *
 * Main page for batch benchmark operations with real-time progress
 */

import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { BatchRunner, BatchHistory, BatchProgress } from '@/components/batch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

async function getBatchData() {
  const benchmarks = await prisma.benchmark.findMany({
    where: {},
    select: {
      id: true,
      name: true,
      description: true,
      primaryCategory: true,
    },
    orderBy: { name: 'asc' },
  });

  // Predefined models
  const models = [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic' },
  ];

  const evaluatorModels = [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  ];

  return { benchmarks, models, evaluatorModels };
}

export default async function BatchPage() {
  const { benchmarks, models, evaluatorModels } = await getBatchData();

  return (
    <div className="container mx-auto py-8">
      <Tabs defaultValue="run" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="run">Run Batch</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Run Batch Tab */}
        <TabsContent value="run" className="mt-6">
          <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
            <BatchRunner
              benchmarks={benchmarks}
              models={models}
              evaluatorModels={evaluatorModels}
            />
          </Suspense>
        </TabsContent>

        {/* Real-Time Progress Tab */}
        <TabsContent value="progress" className="mt-6">
          <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
            <ActiveBatchProgress />
          </Suspense>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
            <BatchHistory />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Get active (running) batches for the progress tab
 */
async function ActiveBatchProgress() {
  // Get currently running batches
  const runningBatches = await prisma.benchmarkBatch.findMany({
    where: { status: 'RUNNING' },
    orderBy: { startedAt: 'desc' },
    take: 5,
  });

  if (runningBatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>No batches are currently running.</p>
        <p className="text-sm">Start a batch from the Run Batch tab to see progress here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {runningBatches.map((batch) => (
        <BatchProgress key={batch.id} batchId={batch.id} />
      ))}
    </div>
  );
}
