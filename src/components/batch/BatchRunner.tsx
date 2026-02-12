/**
 * Batch Runner Component
 *
 * UI for creating and executing batch benchmark runs
 */

'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Play, AlertTriangle, Clock, DollarSign, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Benchmark {
  id: string;
  name: string;
  description: string;
  primaryCategory: string;
}

interface Model {
  id: string;
  name: string;
  provider: string;
}

interface BatchRunnerProps {
  benchmarks: Benchmark[];
  models: Model[];
  evaluatorModels: Model[];
  onBatchCreated?: (batchId: string) => void;
}

interface BatchEstimates {
  time: {
    estimatedMinutes: number;
    estimatedRunsPerMinute: number;
    totalRuns: number;
  };
  cost: {
    estimatedCost: number;
    estimatedTokens: number;
    totalRuns: number;
  };
}

export function BatchRunner({
  benchmarks,
  models,
  evaluatorModels,
  onBatchCreated,
}: BatchRunnerProps) {
  const { toast } = useToast();

  // Form state
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [evaluatorModel, setEvaluatorModel] = useState('');
  const [evaluatorProvider, setEvaluatorProvider] = useState('openai');
  const [concurrency, setConcurrency] = useState([5]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);

  // Calculate estimates
  const calculateEstimates = useCallback((): BatchEstimates | null => {
    if (selectedBenchmarks.length === 0 || selectedModels.length === 0) {
      return null;
    }

    const totalRuns = selectedBenchmarks.length * selectedModels.length;
    const avgTimePerRun = 2; // minutes
    const runsPerMinute = concurrency[0] / avgTimePerRun;
    const estimatedMinutes = Math.ceil(totalRuns / runsPerMinute);

    const avgTokensPerRun = 5000;
    const estimatedTokens = totalRuns * avgTokensPerRun;
    const inputCostPerMillion = 0.005;
    const outputCostPerMillion = 0.015;
    const evaluatorCostPerMillion = 0.003;
    const estimatedCost =
      (estimatedTokens * inputCostPerMillion) / 1_000_000 +
      (estimatedTokens * outputCostPerMillion) / 1_000_000 +
      (estimatedTokens * evaluatorCostPerMillion) / 1_000_000;

    return {
      time: {
        estimatedMinutes,
        estimatedRunsPerMinute: Math.floor(runsPerMinute),
        totalRuns,
      },
      cost: {
        estimatedCost,
        estimatedTokens,
        totalRuns,
      },
    };
  }, [selectedBenchmarks.length, selectedModels.length, concurrency]);

  const estimates = calculateEstimates();

  // Toggle benchmark selection
  const toggleBenchmark = (benchmarkId: string) => {
    setSelectedBenchmarks((prev) =>
      prev.includes(benchmarkId)
        ? prev.filter((id) => id !== benchmarkId)
        : [...prev, benchmarkId]
    );
  };

  // Toggle model selection
  const toggleModel = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId]
    );
  };

  // Select all benchmarks
  const selectAllBenchmarks = () => {
    setSelectedBenchmarks(benchmarks.map((b) => b.id));
  };

  // Select all models
  const selectAllModels = () => {
    setSelectedModels(models.map((m) => m.id));
  };

  // Clear selections
  const clearSelections = () => {
    setSelectedBenchmarks([]);
    setSelectedModels([]);
  };

  // Start batch execution
  const startBatch = async () => {
    if (selectedBenchmarks.length === 0) {
      toast({
        title: 'No benchmarks selected',
        description: 'Please select at least one benchmark to run.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedModels.length === 0) {
      toast({
        title: 'No models selected',
        description: 'Please select at least one model to test.',
        variant: 'destructive',
      });
      return;
    }

    if (!evaluatorModel) {
      toast({
        title: 'No evaluator selected',
        description: 'Please select an evaluator model.',
        variant: 'destructive',
      });
      return;
    }

    setIsRunning(true);

    try {
      const response = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || `Batch-${new Date().toLocaleString()}`,
          description,
          benchmarkIds: selectedBenchmarks,
          modelIds: selectedModels,
          evaluatorModel,
          evaluatorProvider,
          concurrency: concurrency[0],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to start batch');
      }

      const data = await response.json();
      setBatchId(data.batchId);
      setIsRunning(false);

      toast({
        title: 'Batch started',
        description: `Running ${data.estimates?.time?.totalRuns || 0} benchmark evaluations.`,
      });

      onBatchCreated?.(data.batchId);
      // Navigate to progress tab to show real-time updates
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      window.location.hash = 'progress';
    } catch (error) {
      setIsRunning(false);
      toast({
        title: 'Failed to start batch',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  // Group benchmarks by category
  const benchmarksByCategory = benchmarks.reduce((acc, benchmark) => {
    const category = benchmark.primaryCategory || 'OTHER';
    if (!acc[category]) acc[category] = [];
    acc[category].push(benchmark);
    return acc;
  }, {} as Record<string, Benchmark[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Batch Benchmark Runner</h2>
          <p className="text-muted-foreground">
            Run multiple benchmarks against multiple models in bulk
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={clearSelections}>
            Clear All
          </Button>
          <Button variant="outline" onClick={selectAllBenchmarks}>
            Select All Benchmarks
          </Button>
          <Button variant="outline" onClick={selectAllModels}>
            Select All Models
          </Button>
        </div>
      </div>

      {/* Batch Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Configuration</CardTitle>
          <CardDescription>
            Configure your batch run settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="batch-name">Batch Name</Label>
              <Input
                id="batch-name"
                placeholder="My Batch Run"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="concurrency">Concurrency: {concurrency}</Label>
              <Slider
                id="concurrency"
                min={1}
                max={10}
                step={1}
                value={concurrency}
                onValueChange={setConcurrency}
              />
              <p className="text-xs text-muted-foreground">
                Number of parallel benchmark runs
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe the purpose of this batch run..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="evaluator-provider">Evaluator Provider</Label>
              <Select
                value={evaluatorProvider}
                onValueChange={setEvaluatorProvider}
              >
                <SelectTrigger id="evaluator-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="evaluator-model">Evaluator Model</Label>
              <Select value={evaluatorModel} onValueChange={setEvaluatorModel}>
                <SelectTrigger id="evaluator-model">
                  <SelectValue placeholder="Select evaluator model" />
                </SelectTrigger>
                <SelectContent>
                  {evaluatorModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Benchmark Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Select Benchmarks</CardTitle>
              <CardDescription>
                {selectedBenchmarks.length} of {benchmarks.length} selected
              </CardDescription>
            </div>
            <Badge variant={selectedBenchmarks.length > 0 ? 'default' : 'secondary'}>
              {selectedBenchmarks.length} selected
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {Object.entries(benchmarksByCategory).map(([category, categoryBenchmarks]) => (
              <div key={category}>
                <h4 className="text-sm font-medium mb-2">{category}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {categoryBenchmarks.map((benchmark) => (
                    <div
                      key={benchmark.id}
                      className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleBenchmark(benchmark.id)}
                    >
                      <Checkbox
                        id={`benchmark-${benchmark.id}`}
                        checked={selectedBenchmarks.includes(benchmark.id)}
                        onCheckedChange={() => toggleBenchmark(benchmark.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <Label
                          htmlFor={`benchmark-${benchmark.id}`}
                          className="font-medium truncate cursor-pointer"
                        >
                          {benchmark.name}
                        </Label>
                        <p className="text-xs text-muted-foreground truncate">
                          {benchmark.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Model Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Select Models</CardTitle>
              <CardDescription>
                {selectedModels.length} of {models.length} selected
              </CardDescription>
            </div>
            <Badge variant={selectedModels.length > 0 ? 'default' : 'secondary'}>
              {selectedModels.length} selected
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {models.map((model) => (
              <div
                key={model.id}
                className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => toggleModel(model.id)}
              >
                <Checkbox
                  id={`model-${model.id}`}
                  checked={selectedModels.includes(model.id)}
                  onCheckedChange={() => toggleModel(model.id)}
                />
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={`model-${model.id}`}
                    className="font-medium truncate cursor-pointer"
                  >
                    {model.name}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {model.provider}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Estimates */}
      {estimates && (
        <Card>
          <CardHeader>
            <CardTitle>Run Estimates</CardTitle>
            <CardDescription>
              Estimated time and cost for this batch run
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {estimates.time.estimatedMinutes}m
                  </p>
                  <p className="text-xs text-muted-foreground">Est. time</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    ${estimates.cost.estimatedCost.toFixed(4)}
                  </p>
                  <p className="text-xs text-muted-foreground">Est. cost</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {estimates.time.totalRuns} runs
                  </p>
                  <p className="text-xs text-muted-foreground">Total runs</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Loader2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {estimates.time.estimatedRunsPerMinute}/min
                  </p>
                  <p className="text-xs text-muted-foreground">Throughput</p>
                </div>
              </div>
            </div>

            {/* Warning for large batches */}
            {estimates.time.estimatedMinutes > 30 && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This batch run will take approximately{' '}
                  {Math.floor(estimates.time.estimatedMinutes / 60)} hour(s) and{' '}
                  {estimates.time.estimatedMinutes % 60} minutes. Consider reducing
                  the number of benchmarks or models for faster results.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Start Button */}
      <div className="flex justify-end">
        <Dialog open={!!batchId} onOpenChange={() => setBatchId(null)}>
          <DialogTrigger asChild>
            <Button
              size="lg"
              onClick={startBatch}
              disabled={
                isRunning ||
                selectedBenchmarks.length === 0 ||
                selectedModels.length === 0 ||
                !evaluatorModel
              }
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Batch Run
                </>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Batch Started</DialogTitle>
              <DialogDescription>
                Your batch run has been started. You can monitor its progress in the
                Batch History section.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setBatchId(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
