/**
 * Benchmark Run Page
 *
 * Allows users to select models and run a benchmark
 * Now uses shared RealTimeProgress component for consistent UI
 */

"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/layout";
import { RealTimeProgress } from "@/components/progress/RealTimeProgress";
import { Play, Loader2, AlertCircle, Activity } from "lucide-react";
import { type SettingsProvider } from "@/lib/settings";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { CardDescription } from "@/components/ui/card";

interface Benchmark {
  id: string;
  name: string;
  description: string;
  prompt: string;
  primaryCategory: string;
}

interface ModelWithProvider {
  id: string;
  name: string; // For custom models, this is the providerId (actual model ID like "z-ai/glm-4.5-air:free")
  displayName?: string;
  provider: SettingsProvider;
  isCustom?: boolean;
}

export default function BenchmarkRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelWithProvider[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [benchmarkRunId, setBenchmarkRunId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);

  // Fetch benchmark and models data
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch benchmark
        const benchmarkRes = await fetch(`/api/benchmarks/${id}`);
        if (!benchmarkRes.ok) {
          setRunError("Benchmark not found");
          setLoading(false);
          return;
        }
        const benchmarkData = await benchmarkRes.json();
        setBenchmark(benchmarkData.benchmark);

        // Fetch models (settings + predefined)
        const settingsRes = await fetch("/api/settings");
        if (!settingsRes.ok) {
          setRunError("Failed to load settings");
          return;
        }
        const settings = await settingsRes.json();

        // Build models list (predefined + custom)
        const PREDEFINED_MODELS: ModelWithProvider[] = [
          { id: "gpt-4o", name: "GPT-4o", provider: "OPENAI", isCustom: false },
          { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OPENAI", isCustom: false },
          {
            id: "claude-3-5-sonnet-20241022",
            name: "Claude 3.5 Sonnet",
            provider: "ANTHROPIC",
            isCustom: false,
          },
          {
            id: "claude-3-5-haiku-20241022",
            name: "Claude 3.5 Haiku",
            provider: "ANTHROPIC",
            isCustom: false,
          },
        ];

        // Get custom models from settings (they are inside settings.settings.customModels)
        const customModels = settings?.settings?.customModels || [];
        const allModels = [...PREDEFINED_MODELS, ...customModels];
        setModels(allModels);
        setSettings(settings);
        setLoading(false);
      } catch (error) {
        setRunError(error instanceof Error ? error.message : "Failed to load benchmark");
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  // Clear benchmark run ID when navigating away
  useEffect(() => {
    return () => {
      setBenchmarkRunId(null);
      setIsRunning(false);
    };
  }, []);

  // Toggle model selection
  const toggleModel = (modelId: string) => {
    setSelectedModelIds((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  };

  // Select all models
  const selectAllModels = () => {
    setSelectedModelIds(models.map((m) => m.id));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedModelIds([]);
  };

  // Run benchmark
  const handleRun = async () => {
    if (selectedModelIds.length === 0) {
      toast({
        title: "No models selected",
        description: "Please select at least one model to test.",
        variant: "error",
      });
      return;
    }

    if (!benchmark) {
      toast({
        title: "Benchmark not loaded",
        description: "Please wait for the benchmark to load.",
        variant: "error",
      });
      return;
    }

    setIsRunning(true);

    try {
      // Build model details for the request
      // For custom models, we need to pass the provider and actual model ID (providerId)
      const modelDetails = selectedModelIds.map((modelId) => {
        const model = models.find((m) => m.id === modelId);
        return {
          id: modelId,
          provider: model?.provider || "OPENAI",
          providerId: model?.isCustom ? model.name : modelId, // For custom models, name is the providerId
        };
      });

      // Extract API keys from settings - settings.apiKeys is an array of { provider, key, ... }
      const apiKeysArray = settings?.settings?.apiKeys || [];
      const apiKeys: Record<string, string> = {};
      for (const apiKey of apiKeysArray) {
        if (apiKey.provider && apiKey.key) {
          // Decode base64 key
          try {
            const decodedKey = atob(apiKey.key);
            apiKeys[apiKey.provider] = decodedKey;
          } catch {
            // If not base64, use as-is
            apiKeys[apiKey.provider] = apiKey.key;
          }
        }
      }

      console.log("[Benchmark Run] Sending request with:", {
        modelCount: selectedModelIds.length,
        evaluator: settings?.settings?.evaluator?.model,
        evaluatorProvider: settings?.settings?.evaluator?.provider,
        apiKeysProviders: Object.keys(apiKeys),
        hasApiKeys: Object.keys(apiKeys).length > 0,
      });

      const response = await fetch("/api/benchmarks/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          benchmarkId: id,
          modelIds: selectedModelIds,
          models: modelDetails,
          evaluator: settings?.settings?.evaluator?.model || "gpt-4o",
          evaluatorProvider: settings?.settings?.evaluator?.provider || "OPENAI",
          concurrency: settings?.settings?.concurrency || 3,
          apiKeys,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to start benchmark run");
      }

      const data = await response.json();
      setBenchmarkRunId(data.runId);
      toast({
        title: "Benchmark started",
        description: "Running benchmark against selected models.",
      });
    } catch (error) {
      setIsRunning(false);
      setRunError(error instanceof Error ? error.message : "Failed to start benchmark run");
    }
  };

  return (
    <div className="container mx-auto py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Benchmarks", href: "/benchmarks" },
            { label: benchmark?.name || "Loading...", href: `/benchmarks/${id}` },
            { label: "Run" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {loading ? (
            <div className="flex min-h-screen items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : runError ? (
            <Card className="mx-auto max-w-md">
              <CardContent className="p-8 text-center">
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
                <h2 className="mb-4 text-xl font-bold">Error</h2>
                <p className="text-muted-foreground">{runError}</p>
                <Link href="/benchmarks" className="mt-4 inline-block">
                  <Button>Back to Benchmarks</Button>
                </Link>
              </CardContent>
            </Card>
          ) : !benchmark ? (
            <div className="flex items-center justify-center">
              <Card className="max-w-md">
                <CardContent className="flex flex-col items-center p-8 text-center">
                  <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h2 className="mb-4 text-xl font-bold">Benchmark Not Found</h2>
                  <p className="text-muted-foreground">
                    The requested benchmark could not be found.
                  </p>
                  <Link href="/benchmarks" className="mt-4">
                    <Button>Back to Benchmarks</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              {/* Progress Card - Shows when running */}
              {isRunning && benchmarkRunId && (
                <Card className="lg:col-span-1">
                  <RealTimeProgress
                    benchmarkRunId={benchmarkRunId}
                    onComplete={() => {
                      // Navigate to results page after completion
                      router.push(`/results/${benchmarkRunId}`);
                    }}
                  />
                </Card>
              )}

              {/* Benchmark Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle>{benchmark.name}</CardTitle>
                  <CardDescription>{benchmark.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="mb-2 text-sm text-muted-foreground">
                    <strong>Category:</strong> {benchmark.primaryCategory}
                  </div>
                  <div className="mb-4 text-sm text-muted-foreground">
                    <strong>Prompt:</strong>
                  </div>
                  <p className="whitespace-pre-wrap break-all rounded bg-muted p-3 font-mono text-xs text-muted-foreground">
                    {benchmark.prompt}
                  </p>
                </CardContent>
              </Card>

              {/* Model Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Select Models</CardTitle>
                  <CardDescription>Choose which models to test against</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="mb-4 flex gap-2">
                    <Button variant="outline" onClick={selectAllModels}>
                      Select All ({models.length})
                    </Button>
                    <Button variant="outline" onClick={clearSelection}>
                      Clear All
                    </Button>
                  </div>

                  <div className="max-h-96 space-y-2 overflow-y-auto">
                    {models.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-surface hover:bg-surface"
                      >
                        <Checkbox
                          id={`model-${model.id}`}
                          checked={selectedModelIds.includes(model.id)}
                          onCheckedChange={() => toggleModel(model.id)}
                        />
                        <div className="min-w-0 flex-1 space-x-2">
                          <div>
                            <Label
                              htmlFor={`model-${model.id}`}
                              className="cursor-pointer font-medium"
                            >
                              {model.name}
                            </Label>
                            <Badge variant="outline">{model.provider}</Badge>
                          </div>
                          {model.isCustom && (
                            <span className="ml-2 text-xs text-muted-foreground">(Custom)</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Run Button */}
              <Button
                size="lg"
                className="w-full"
                disabled={!benchmark || selectedModelIds.length === 0 || isRunning}
                onClick={handleRun}
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

              {/* Link to Batch Progress */}
              {isRunning && benchmarkRunId && (
                <div className="mt-4">
                  <a
                    href="/batch?tab=progress"
                    className="flex items-center gap-2 text-sm text-blue-500 hover:underline"
                  >
                    <Activity className="h-4 w-4" />
                    View batch progress to see all running evaluations
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        {/* Settings */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Configure evaluator, concurrency, and timeout in Settings.
              </div>
              <Button variant="outline" onClick={() => router.push("/settings")}>
                Open Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
