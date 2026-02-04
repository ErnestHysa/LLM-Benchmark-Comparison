/**
 * Benchmark Run Page
 *
 * Allows users to select models and run a benchmark
 */

"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Play, ChevronLeft, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout";
import { type Model, type SettingsProvider } from "@/lib/settings";
import { saveBenchmarkRun, type BenchmarkRunSummary } from "@/lib/storage/benchmark-history";

interface Benchmark {
  id: string;
  name: string;
  description: string;
  prompt: string;
  primaryCategory: string;
}

type ModelWithProvider = Model & {
  provider: SettingsProvider;
};

// Provider colors
const providerColors: Record<SettingsProvider, string> = {
  OPENAI: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  ANTHROPIC: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  OPENROUTER: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  CUSTOM: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

const providerNames: Record<SettingsProvider, string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
  OPENROUTER: "OpenRouter",
  CUSTOM: "Custom",
};

export default function BenchmarkRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelWithProvider[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [evaluator, setEvaluator] = useState({
    model: "gpt-4o",
    provider: "OPENAI" as SettingsProvider,
  });
  const [evaluatorModelFromSettings, setEvaluatorModelFromSettings] = useState<{
    model: string;
    provider: SettingsProvider;
  } | null>(null);
  const [concurrency, setConcurrency] = useState(3);
  const [timeoutSec, setTimeoutSec] = useState(600);

  // Run state
  const [isRunning, setIsRunning] = useState(false);
  const [runResults, setRunResults] = useState<any[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Settings
  const [apiKeys, setApiKeys] = useState<any[]>([]);

  // Fetch benchmark and settings
  useEffect(() => {
    async function fetchData() {
      try {
        console.info("[Benchmark Run] Fetching benchmark:", id);

        // Fetch benchmark
        const benchmarkRes = await fetch(`/api/benchmarks/${id}`);
        if (!benchmarkRes.ok) {
          console.error("[Benchmark Run] Benchmark not found:", id);
          setRunError("Benchmark not found");
          setLoading(false);
          return;
        }
        const benchmarkResponse = await benchmarkRes.json();
        const benchmarkData = benchmarkResponse.benchmark || benchmarkResponse;
        setBenchmark(benchmarkData);

        console.info("[Benchmark Run] Benchmark loaded:", benchmarkData);

        // Get settings from localStorage
        const settingsStr = localStorage.getItem("llm-benchmark-settings");
        if (settingsStr) {
          const settings = JSON.parse(settingsStr);
          console.info("[Benchmark Run] Settings loaded:", {
            hasApiKeys: settings.apiKeys?.length || 0,
            hasCustomModels: settings.models?.length || 0,
            disabledPredefinedModels: settings.disabledPredefinedModels || [],
          });

          // Set API keys
          setApiKeys(settings.apiKeys || []);

          // Set evaluator from settings
          if (settings.evaluator) {
            const evaluatorFromSettings = {
              model: settings.evaluator.model || "gpt-4o",
              provider: settings.evaluator.provider || "OPENAI",
            };
            setEvaluator(evaluatorFromSettings);
            setEvaluatorModelFromSettings(evaluatorFromSettings);
            console.info("[Benchmark Run] Evaluator from settings:", evaluatorFromSettings);
          }

          // Set preferences
          if (settings.preferences) {
            setConcurrency(settings.preferences.concurrency || 3);
            setTimeoutSec(settings.preferences.timeoutSec || 600);
          }

          // Build models list (predefined + custom)
          const PREDEFINED_MODELS = [
            { id: "gpt-4o", name: "GPT-4o", provider: "OPENAI" as SettingsProvider },
            { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OPENAI" as SettingsProvider },
            { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OPENAI" as SettingsProvider },
            { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "OPENAI" as SettingsProvider },
            {
              id: "claude-3-5-sonnet",
              name: "Claude 3.5 Sonnet",
              provider: "ANTHROPIC" as SettingsProvider,
            },
            {
              id: "claude-3-opus",
              name: "Claude 3 Opus",
              provider: "ANTHROPIC" as SettingsProvider,
            },
            {
              id: "claude-3-sonnet",
              name: "Claude 3 Sonnet",
              provider: "ANTHROPIC" as SettingsProvider,
            },
            {
              id: "claude-3-haiku",
              name: "Claude 3 Haiku",
              provider: "ANTHROPIC" as SettingsProvider,
            },
          ];

          const disabledSet = new Set(settings.disabledPredefinedModels || []);

          const enabledPredefined = PREDEFINED_MODELS.filter((m) => !disabledSet.has(m.id)).map(
            (m) => ({ ...m, isEnabled: true, isCustom: false as const })
          );

          const customModels = (settings.models || []).map((m: any) => ({
            ...m,
            isEnabled: m.isEnabled ?? true,
            isCustom: true as const,
          }));

          // Filter to only enabled models
          const allModels = [...enabledPredefined, ...customModels].filter((m) => m.isEnabled);

          console.info("[Benchmark Run] Available models:", {
            total: allModels.length,
            predefined: enabledPredefined.length,
            custom: customModels.length,
            modelIds: allModels.map((m) => ({
              id: m.id,
              name: m.name,
              provider: m.provider,
            })),
          });

          setModels(allModels);

          // Set default categories (with fallback)
          const primaryCat = benchmarkData.primaryCategory || "CODING";
          setSelectedCategories([primaryCat]);
        }
      } catch (error) {
        console.error("[Benchmark Run] Error fetching data:", error);
        setRunError("Failed to load benchmark");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  // Handle model selection
  const toggleModel = (modelId: string) => {
    if (selectedModelIds.includes(modelId)) {
      setSelectedModelIds(selectedModelIds.filter((id) => id !== modelId));
    } else {
      setSelectedModelIds([...selectedModelIds, modelId]);
    }
  };

  const selectAll = () => {
    setSelectedModelIds(models.map((m) => m.id));
  };

  const clearAll = () => {
    setSelectedModelIds([]);
  };

  // Handle run benchmark
  const handleRun = async () => {
    if (selectedModelIds.length === 0) {
      setRunError("Please select at least one model");
      setShowResults(true);
      return;
    }

    // Validate evaluator model
    if (!evaluator.model || evaluator.model === "custom") {
      setRunError(
        "Invalid evaluator model. Please go to Settings → Evaluator and select a valid model (not 'Custom model...')."
      );
      setShowResults(true);
      return;
    }

    setIsRunning(true);
    setRunError(null);
    setRunResults([]);

    const startTime = Date.now();

    try {
      const modelIdentifiers = selectedModelIds.map((modelId) => {
        const model = models.find((m) => m.id === modelId);
        return model?.isCustom ? (model as any).name : modelId;
      });

      console.info("[Benchmark Run] Starting benchmark run:", {
        benchmarkId: id,
        modelIds: selectedModelIds,
        modelIdentifiers,
        categories: selectedCategories,
        evaluator: `${evaluator.provider}:${evaluator.model}`,
        concurrency,
        timeoutSec,
      });

      const apiKeysMap: Record<string, string> = {};
      for (const apiKey of apiKeys) {
        if (apiKey.isActive) {
          const decoded = atob(apiKey.key);
          apiKeysMap[apiKey.provider.toLowerCase()] = decoded;
          console.info("[Benchmark Run] Using API key for provider:", {
            provider: apiKey.provider,
            hasKey: !!decoded,
            keyPrefix: decoded.slice(0, 10) + "...",
          });
        }
      }

      const response = await fetch("/api/benchmarks/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          benchmarkId: id,
          modelIds: modelIdentifiers,
          categories: selectedCategories,
          evaluator: evaluator.model,
          evaluatorProvider: evaluator.provider,
          concurrency,
          timeoutSec,
          apiKeys: apiKeysMap,
        }),
      });

      console.info("[Benchmark Run] Run API response status:", response.status);

      const data = await response.json();
      console.info("[Benchmark Run] Run API response data:", data);

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to run benchmark");
      }

      setRunResults(data.models || []);
      setShowResults(true);

      // Save to local benchmark history
      const modelResults = (data.models || []).map((m: any) => ({
        modelId: m.modelId,
        status: m.status as "COMPLETED" | "FAILED",
        totalScore: m.totalScore ?? 0,
        error: m.error,
      }));
      const completedModels = modelResults.filter((m: any) => m.status === "COMPLETED");
      const topModel = completedModels.sort((a: any, b: any) => b.totalScore - a.totalScore)[0];

      const runSummary: BenchmarkRunSummary = {
        id: data.runId || crypto.randomUUID(),
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        benchmarkName: benchmark?.name || "Unknown",
        benchmarkId: id,
        modelsCount: modelResults.length,
        completedCount: completedModels.length,
        failedCount: modelResults.filter((m: any) => m.status === "FAILED").length,
        topModel: topModel?.modelId,
        topScore: topModel?.totalScore,
        results: modelResults,
      };
      saveBenchmarkRun(runSummary);

      // If successful, redirect to results page
      if (data.runId) {
        setTimeout(() => {
          router.push(`/results/${data.runId}`);
        }, 2000);
      }
    } catch (error) {
      console.error("[Benchmark Run] Error running benchmark:", error);
      setRunError(error instanceof Error ? error.message : "Unknown error");
      setShowResults(true);
    } finally {
      setIsRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!benchmark) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-error" />
            <h2 className="mb-2 text-xl font-bold">Benchmark Not Found</h2>
            <p className="mb-4 text-muted-foreground">
              The requested benchmark could not be found.
            </p>
            <Link href="/benchmarks">
              <Button>Back to Benchmarks</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Benchmarks", href: "/benchmarks" },
    { label: benchmark.name, href: `/benchmarks/${id}` },
    { label: "Run" },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="animate-fade-in">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Header */}
      <div className="animate-fade-in-up">
        <Link href={`/benchmarks/${id}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Benchmark
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Run Benchmark</h1>
        <p className="mt-1 text-muted-foreground">{benchmark.name}</p>
      </div>

      <div className="animate-fade-in-up grid grid-cols-1 gap-6 delay-100 lg:grid-cols-3">
        {/* Model Selection */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Select Models</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearAll}>
                    Clear All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {models.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No models available. Add models in Settings.
                </p>
              ) : (
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {models.map((model) => (
                    <div
                      key={model.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-surface-hover"
                    >
                      <Checkbox
                        id={`model-${model.id}`}
                        checked={selectedModelIds.includes(model.id)}
                        onCheckedChange={() => toggleModel(model.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <Label
                          htmlFor={`model-${model.id}`}
                          className="cursor-pointer truncate font-medium"
                        >
                          {model.isCustom ? (model as any).displayName || model.name : model.name}
                        </Label>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {model.id}
                        </p>
                      </div>
                      <Badge variant="outline" className={providerColors[model.provider]}>
                        {providerNames[model.provider]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected Models Summary */}
          {selectedModelIds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Selected Models ({selectedModelIds.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {selectedModelIds.map((modelId) => {
                    const model = models.find((m) => m.id === modelId);
                    return (
                      <Badge key={modelId} variant="secondary">
                        {model?.isCustom
                          ? (model as any).displayName || model.name
                          : model?.name || modelId}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Run Configuration */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Categories */}
              <div className="space-y-2">
                <Label>Categories</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={
                      selectedCategories.includes(benchmark?.primaryCategory || "")
                        ? "default"
                        : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() => setSelectedCategories([benchmark?.primaryCategory || "CODING"])}
                  >
                    {(benchmark?.primaryCategory || "CODING").replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>

              {/* Evaluator */}
              <div className="space-y-2">
                <Label>Evaluator Model</Label>
                <Select
                  value={`${evaluator.provider}:${evaluator.model}`}
                  onValueChange={(value) => {
                    const parts = value.split(":");
                    const provider = parts[0] ?? "OPENAI";
                    const model = parts.slice(1).join(":") ?? "gpt-4o";
                    setEvaluator({ model, provider: provider as SettingsProvider });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Configured evaluator from settings */}
                    {evaluatorModelFromSettings && (
                      <SelectItem
                        value={`${evaluatorModelFromSettings.provider}:${evaluatorModelFromSettings.model}`}
                      >
                        {evaluatorModelFromSettings.model} (
                        {providerNames[evaluatorModelFromSettings.provider]})
                        {evaluatorModelFromSettings.provider === "OPENROUTER" && " ✓ Configured"}
                      </SelectItem>
                    )}
                    {/* Common predefined evaluators */}
                    <SelectItem value="OPENAI:gpt-4o">GPT-4o (OpenAI)</SelectItem>
                    <SelectItem value="OPENAI:gpt-4o-mini">GPT-4o Mini (OpenAI)</SelectItem>
                    <SelectItem value="ANTHROPIC:claude-3-5-sonnet">
                      Claude 3.5 Sonnet (Anthropic)
                    </SelectItem>
                    <SelectItem value="OPENROUTER:anthropic/claude-3.5-sonnet">
                      Claude 3.5 Sonnet (OpenRouter)
                    </SelectItem>
                    {/* Custom models that can be used as evaluators */}
                    {models
                      .filter((m) => m.provider === "OPENROUTER" || m.provider === "CUSTOM")
                      .map((model) => (
                        <SelectItem key={model.id} value={`${model.provider}:${model.name}`}>
                          {model.isCustom ? (model as any).displayName || model.name : model.name} (
                          {providerNames[model.provider]})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {evaluatorModelFromSettings &&
                  evaluator.provider === evaluatorModelFromSettings.provider &&
                  evaluator.model === evaluatorModelFromSettings.model && (
                    <p className="text-xs text-muted-foreground">
                      ✓ Using your configured evaluator from Settings
                    </p>
                  )}
              </div>

              {/* Concurrency */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Concurrency</Label>
                  <span className="text-sm text-muted-foreground">{concurrency}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Timeout */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Timeout (seconds)</Label>
                  <span className="text-sm text-muted-foreground">{timeoutSec}s</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="3600"
                  step="60"
                  value={timeoutSec}
                  onChange={(e) => setTimeoutSec(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Run Button */}
              <Button
                className="w-full"
                size="lg"
                onClick={handleRun}
                disabled={isRunning || selectedModelIds.length === 0}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Benchmark
                  </>
                )}
              </Button>

              {selectedModelIds.length === 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  Select at least one model to run
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Results Dialog */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{runError ? "Run Failed" : "Run Complete"}</DialogTitle>
            <DialogDescription>
              {runError ? "There was an error running the benchmark" : "Redirecting to results..."}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-60 overflow-y-auto">
            {runError ? (
              <div className="flex items-start gap-3 rounded-lg bg-error/10 p-4">
                <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-error" />
                <div>
                  <p className="font-medium text-error">Error</p>
                  <p className="text-sm text-muted-foreground">{runError}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {runResults.map((result) => (
                  <div
                    key={result.modelId}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{result.modelId}</p>
                      {result.error && (
                        <p className="mt-1 truncate text-xs text-error" title={result.error}>
                          {result.error}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {result.status === "COMPLETED" ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          <span className="text-sm text-success">
                            {result.totalScore?.toFixed(1)}%
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-error" />
                          <span className="text-sm text-error">Failed</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResults(false)}>
              {runError ? "Close" : "Stay Here"}
            </Button>
            {!runError && (
              <Button onClick={() => router.push(`/results/${runResults[0]?.runId}`)}>
                View Results
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
