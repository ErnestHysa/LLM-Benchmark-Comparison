/**
 * FuzzTestRunner Component
 *
 * Client component for running fuzz tests
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield,
  Bug,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  RefreshCw,
  Zap,
} from "lucide-react";
import { SettingsManager, decodeApiKey } from "@/lib/settings";

interface ModelCheckboxProps {
  models: string[];
  selected: string[];
  onChange: (models: string[]) => void;
}

function ModelSelector({ models, selected, onChange }: ModelCheckboxProps) {
  const toggleModel = (model: string) => {
    if (selected.includes(model)) {
      onChange(selected.filter((m) => m !== model));
    } else {
      onChange([...selected, model]);
    }
  };

  return (
    <div className="space-y-2">
      {models.map((model) => (
        <label
          key={model}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
            selected.includes(model)
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50"
          }`}
        >
          <input
            type="checkbox"
            checked={selected.includes(model)}
            onChange={() => toggleModel(model)}
            className="h-4 w-4"
          />
          <span className="flex-1 text-sm">{model}</span>
        </label>
      ))}
    </div>
  );
}

const CATEGORIES = [
  { value: "typo", label: "Typos", description: "Misspellings, repeated letters, leet speak" },
  { value: "injection", label: "Injections", description: "Prompt injection attempts" },
  { value: "jailbreak", label: "Jailbreaks", description: "DAN, developer mode, etc." },
  { value: "edge_case", label: "Edge Cases", description: "Empty, unicode, emojis" },
  {
    value: "format_violation",
    label: "Format Violations",
    description: "Markdown, JSON, XML injection",
  },
];
type FuzzCategory = (typeof CATEGORIES)[number]["value"];

interface FuzzTestRunnerProps {
  models: string[];
}

interface VulnerabilityResult {
  category: string;
  passed: boolean;
}

interface FuzzResultItem {
  modelId: string;
  overallScore: number;
  passed: number;
  failed: number;
  vulnerabilities: VulnerabilityResult[];
}

interface FuzzResultsState {
  runId: string;
  completed: boolean;
  data: {
    results?: {
      byModel?: Record<string, { total: number; passed: number; failed: number }>;
    };
  } | null;
  error?: string;
}

export function FuzzTestRunner({ models }: FuzzTestRunnerProps) {
  const [prompt, setPrompt] = useState(
    "Write a function to sort an array of integers in ascending order."
  );
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<FuzzCategory[]>([
    "typo",
    "injection",
  ]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<FuzzResultsState | null>(null);

  // Ref to track the current polling interval for cleanup
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup interval on component unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  const toggleCategory = (cat: FuzzCategory) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const runFuzzTest = async () => {
    if (selectedModels.length === 0) {
      alert("Please select at least one model");
      return;
    }

    if (selectedCategories.length === 0) {
      alert("Please select at least one test category");
      return;
    }

    // Validate API keys before starting the test
    const allApiKeys = SettingsManager.getApiKeys();
    const activeApiKeys = allApiKeys.filter((k) => k.isActive);

    if (activeApiKeys.length === 0) {
      alert(
        "No active API keys found. Please add and activate API keys in Settings before running fuzz tests."
      );
      return;
    }

    // Check if we have valid keys (not empty/placeholder values)
    const invalidKeys = activeApiKeys.filter((key) => {
      const decoded = decodeApiKey(key.key);
      return !decoded || decoded === "" || decoded.length < 10;
    });

    if (invalidKeys.length > 0) {
      const providers = invalidKeys.map((k) => k.provider).join(", ");
      alert(
        `Invalid or missing API keys for: ${providers}. Please check your Settings and ensure API keys are properly configured.`
      );
      return;
    }

    setRunning(true);
    setResults(null);

    // Gather API keys for providers
    const apiKeys = activeApiKeys.reduce(
      (acc, key) => {
        // Decode and add to apiKeys object
        const provider = key.provider.toLowerCase();
        acc[provider] = decodeApiKey(key.key);
        return acc;
      },
      {} as Record<string, string>
    );

    try {
      const response = await fetch("/api/fuzz/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          modelIds: selectedModels,
          categories: selectedCategories,
          apiKeys,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Poll for results
        pollForResults(data.fuzzRunId);
      } else {
        const error = await response.json();
        alert(error.error?.message || "Failed to start fuzz test");
        setRunning(false);
      }
    } catch (_error) {
      alert("Failed to run fuzz test");
      setRunning(false);
    }
  };

  const pollForResults = async (runId: string) => {
    // Maximum polling time: 30 minutes (1800 seconds)
    // Each poll is 3 seconds, so max 600 polls
    const MAX_POLL_TIME_MS = 30 * 60 * 1000; // 30 minutes
    const POLL_INTERVAL_MS = 3000; // 3 seconds
    const startTime = Date.now();
    let pollCount = 0;

    const poll = setInterval(async () => {
      pollCount++;

      // Check if we've exceeded the maximum polling time
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_POLL_TIME_MS) {
        clearInterval(poll);
        pollingIntervalRef.current = null;
        setRunning(false);
        alert("Fuzz test timed out after 30 minutes. Please check the results or try again.");
        return;
      }

      try {
        const response = await fetch(`/api/fuzz/run?runId=${runId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.run.status === "COMPLETED") {
            clearInterval(poll);
            pollingIntervalRef.current = null;
            setRunning(false);
            // Fetch full results
            const resultsResponse = await fetch(`/api/fuzz/results?runId=${runId}`);
            if (resultsResponse.ok) {
              const resultsData = await resultsResponse.json();
              setResults({
                runId,
                completed: true,
                data: resultsData,
              });
            } else {
              const errorData = await resultsResponse.json().catch(() => null);
              const message = errorData?.error?.message || "Failed to load detailed fuzz results.";
              setResults({
                runId,
                completed: true,
                data: null,
                error: message,
              });
            }
          } else if (data.run.status === "FAILED") {
            clearInterval(poll);
            pollingIntervalRef.current = null;
            setRunning(false);
            alert("Fuzz test failed: " + (data.run.error || "Unknown error"));
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
        // If polling fails repeatedly, don't keep polling forever
        if (pollCount % 10 === 0) {
          console.warn(
            `Fuzz test polling: ${pollCount} attempts, ${Math.round(elapsed / 1000)}s elapsed`
          );
        }
      }
    }, POLL_INTERVAL_MS); // Poll every 3 seconds

    // Store interval ref for cleanup
    pollingIntervalRef.current = poll;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-error";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-success/10";
    if (score >= 60) return "bg-warning/10";
    return "bg-error/10";
  };

  const displayResults: FuzzResultItem[] = results?.data?.results?.byModel
    ? Object.entries(results.data.results.byModel).map(([modelId, modelStats]) => {
        const total = modelStats.total || 0;
        const passed = modelStats.passed || 0;
        const failed = modelStats.failed || 0;
        const overallScore = total > 0 ? Math.round((passed / total) * 100) : 0;

        return {
          modelId,
          overallScore,
          passed,
          failed,
          vulnerabilities: [],
        };
      })
    : [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Configuration */}
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Prompt */}
            <div>
              <Label htmlFor="prompt">Test Prompt</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="mt-1 font-mono text-sm"
                placeholder="Enter the prompt to test against..."
              />
            </div>

            {/* Models */}
            <div>
              <Label>Models to Test ({selectedModels.length} selected)</Label>
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-muted p-3">
                <ModelSelector
                  models={models}
                  selected={selectedModels}
                  onChange={setSelectedModels}
                />
              </div>
            </div>

            {/* Categories */}
            <div>
              <Label>Test Categories</Label>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                {CATEGORIES.map((cat) => (
                  <label
                    key={cat.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      selectedCategories.includes(cat.value)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.value)}
                      onChange={() => toggleCategory(cat.value)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <div>
                      <span className="text-sm font-medium">{cat.label}</span>
                      <p className="text-xs text-muted-foreground">{cat.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Run Button */}
            <Button onClick={runFuzzTest} disabled={running} className="w-full" size="lg">
              {running ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Fuzz Tests
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {results && (
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.error && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                  {results.error}
                </div>
              )}
              {displayResults.length === 0 && !results.error && (
                <div className="text-sm text-muted-foreground">
                  No model-level result breakdown is available for this run.
                </div>
              )}
              {displayResults.map((result) => (
                <div
                  key={result.modelId}
                  className={`rounded-lg p-4 ${getScoreBg(result.overallScore)}`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-semibold">{result.modelId}</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getScoreColor(result.overallScore)}>
                        {result.overallScore}% Robustness
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {result.passed} passed / {result.failed} failed
                      </span>
                    </div>
                  </div>
                  {result.vulnerabilities.length > 0 && (
                    <div className="space-y-2">
                      {result.vulnerabilities.map((vuln) => (
                        <div
                          key={vuln.category}
                          className="flex items-center justify-between rounded bg-background p-2 text-sm"
                        >
                          <span className="capitalize">{vuln.category.replace("_", " ")}</span>
                          {vuln.passed ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <XCircle className="h-4 w-4 text-error" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Info Panel */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-500" />
              What is Fuzz Testing?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Fuzz testing systematically tests model robustness by sending adversarial or malformed
              inputs to see if the model behaves correctly.
            </p>
            <div className="space-y-2">
              <p className="font-medium text-foreground">Tests include:</p>
              <ul className="space-y-1">
                <li className="flex items-center gap-2">
                  <Bug className="h-3 w-3" />
                  Typos and misspellings
                </li>
                <li className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3" />
                  Prompt injection attempts
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="h-3 w-3" />
                  Jailbreak patterns
                </li>
                <li className="flex items-center gap-2">
                  <XCircle className="h-3 w-3" />
                  Edge cases and format violations
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Robustness Score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>90-100</span>
              <Badge className="bg-success/10 text-success">Excellent</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>70-89</span>
              <Badge className="bg-warning/10 text-warning">Good</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>50-69</span>
              <Badge className="bg-orange-500/10 text-orange-500">Fair</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>&lt;50</span>
              <Badge className="bg-error/10 text-error">Poor</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
