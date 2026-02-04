/**
 * Evaluator Selector Component
 *
 * Client component for configuring the AI evaluator used for scoring benchmark outputs
 */

"use client";

import { useState, useEffect } from "react";
import { z } from "zod";
import {
  Brain,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  SettingsProviderEnum,
  type SettingsProvider,
  type EvaluatorConfig,
  type ApiKey,
  maskApiKey,
} from "@/lib/settings";

const providerNames: Record<SettingsProvider, string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
  OPENROUTER: "OpenRouter",
  CUSTOM: "Custom",
};

// Common evaluator models
const PRESET_EVALUATORS: Record<SettingsProvider, string[]> = {
  OPENAI: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  ANTHROPIC: [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet",
    "claude-3-opus",
    "claude-3-sonnet",
  ],
  OPENROUTER: [
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "google/gemini-pro-1.5",
  ],
  CUSTOM: [],
};

const testResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

interface TestResult {
  success: boolean;
  message: string;
}

interface EvaluatorSelectorProps {
  evaluator: EvaluatorConfig;
  apiKeys: ApiKey[];
  onUpdate: (config: Partial<EvaluatorConfig>) => void;
}

export function EvaluatorSelector({
  evaluator,
  apiKeys,
  onUpdate,
}: EvaluatorSelectorProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Get available API keys for the selected provider
  const availableKeys = apiKeys.filter((k) => k.provider === evaluator.provider);
  // Determine if custom model input should be shown (model is not a preset for the current provider)
  const showCustomInput = evaluator.provider !== "CUSTOM" && !PRESET_EVALUATORS[evaluator.provider]?.includes(evaluator.model);
  // Determine the value for the Select component: if custom input is shown, use "custom", otherwise use the model (or empty)
  const selectValue = showCustomInput ? "custom" : (evaluator.model || "preset");

  // When provider changes, update to a default model
  useEffect(() => {
    if (!evaluator.model) {
      const defaultModel = PRESET_EVALUATORS[evaluator.provider]?.[0];
      if (defaultModel) {
        onUpdate({ model: defaultModel });
      }
    }
  }, [evaluator.provider, evaluator.model, onUpdate]);

  const handleProviderChange = (provider: SettingsProvider) => {
    let defaultModel: string;
    if (provider === "CUSTOM") {
      defaultModel = "custom"; // Use placeholder to satisfy validation
    } else {
      defaultModel = PRESET_EVALUATORS[provider]?.[0] || "";
    }
    onUpdate({ provider, model: defaultModel, apiKeyId: null });
    setTestResult(null);
  };

  const handleTestEvaluator = async () => {
    // Find the API key for the selected provider (not just by apiKeyId)
    const apiKey = apiKeys.find((k) => k.id === evaluator.apiKeyId);
    const providerKey = apiKeys.find((k) => k.provider === evaluator.provider && k.isActive);

    if (!apiKey && !providerKey && evaluator.provider !== "CUSTOM") {
      setTestResult({
        success: false,
        message: `Please add an API key for ${providerNames[evaluator.provider]} first`,
      });
      return;
    }

    // Use the selected key if available, otherwise use any active key for the provider
    const keyToUse = apiKey || providerKey;
    if (!keyToUse) {
      setTestResult({
        success: false,
        message: "No API key available for this provider",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const decodedKey = atob(keyToUse.key);
      console.info("[EvaluatorSelector] Testing evaluator:", {
        model: evaluator.model,
        provider: evaluator.provider,
        hasKey: !!decodedKey,
        keyPrefix: decodedKey.slice(0, 10) + "...",
      });

      const params = new URLSearchParams({
        model: evaluator.model,
        provider: evaluator.provider,
        apiKey: decodedKey,
      });

      console.info("[EvaluatorSelector] Fetching:", `/api/settings/test-api?${params.toString().slice(0, 100)}...`);

      const response = await fetch(`/api/settings/test-api?${params}`);
      const data = await response.json();
      console.info("[EvaluatorSelector] Response:", data);

      const result = testResultSchema.parse(data);
      setTestResult(result);

      onUpdate({
        lastTested: new Date().toISOString(),
        lastTestSuccess: result.success,
      });
    } catch (error) {
      console.error("[EvaluatorSelector] Test failed:", error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to test evaluator",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const selectedKey = apiKeys.find((k) => k.id === evaluator.apiKeyId);

  return (
    <div className="space-y-6">
      {/* Current Evaluator Display */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Current Evaluator</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">
                {evaluator.model || "Not configured"}
              </p>
              <p className="text-sm text-muted-foreground">
                {providerNames[evaluator.provider]}
              </p>
            </div>
            {evaluator.lastTestSuccess !== null && (
              <Badge
                variant="outline"
                className={
                  evaluator.lastTestSuccess
                    ? "bg-success/10 text-success border-success/20"
                    : "bg-error/10 text-error border-error/20"
                }
              >
                {evaluator.lastTestSuccess ? "Working" : "Failed"}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Evaluator Configuration */}
      <div className="space-y-4">
        {/* Provider Selection */}
        <div className="space-y-2">
          <Label htmlFor="evaluator-provider">Provider</Label>
          <Select
            value={evaluator.provider}
            onValueChange={handleProviderChange}
          >
            <SelectTrigger id="evaluator-provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SettingsProviderEnum.options.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {providerNames[provider]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <Label htmlFor="evaluator-model">Evaluator Model</Label>
          {evaluator.provider === "CUSTOM" ? (
            <div className="space-y-2">
              <Input
                id="evaluator-model"
                placeholder="e.g., gpt-4-turbo, llama-3-70b"
                value={evaluator.model}
                onChange={(e) => onUpdate({ model: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Enter the model ID for your custom endpoint
              </p>
            </div>
          ) : (
            <>
              <Select
                value={selectValue}
                onValueChange={(value) => {
                  if (value === "custom") {
                    onUpdate({ model: "custom" });
                  } else {
                    onUpdate({ model: value });
                  }
                }}
              >
                <SelectTrigger id="evaluator-model">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_EVALUATORS[evaluator.provider]?.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">
                    <span className="text-muted-foreground">Custom model...</span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Custom Model Input - shown when model is not a preset */}
              {showCustomInput && (
                <div className="space-y-2 mt-2">
                  <Label htmlFor="custom-model">Custom Model ID</Label>
                  <Input
                    id="custom-model"
                    placeholder={
                      evaluator.provider === "OPENROUTER"
                        ? "e.g., anthropic/claude-3.5-sonnet"
                        : "e.g., gpt-4-turbo-preview"
                    }
                    value={evaluator.model === "custom" ? "" : evaluator.model}
                    onChange={(e) => onUpdate({ model: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {evaluator.provider === "OPENROUTER"
                      ? "Enter the OpenRouter model ID to use as evaluator"
                      : "Enter the model ID for a custom model"}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* API Key Selection */}
        {evaluator.provider !== "CUSTOM" && (
          <div className="space-y-2">
            <Label htmlFor="evaluator-apikey">API Key</Label>
            {availableKeys.length === 0 ? (
              <div className="p-3 bg-warning/10 border border-warning/20 rounded-md">
                <p className="text-sm text-warning">
                  No API keys configured for {providerNames[evaluator.provider]}.{" "}
                  Add one in the API Keys tab first.
                </p>
              </div>
            ) : (
              <Select
                value={evaluator.apiKeyId || ""}
                onValueChange={(value) =>
                  onUpdate({ apiKeyId: value || null })
                }
              >
                <SelectTrigger id="evaluator-apikey">
                  <SelectValue placeholder="Select an API key" />
                </SelectTrigger>
                <SelectContent>
                  {availableKeys.map((key) => (
                    <SelectItem key={key.id} value={key.id}>
                      <div className="flex items-center gap-2">
                        <span>{key.label}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {maskApiKey(key.key)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedKey && (
              <p className="text-xs text-muted-foreground">
                Using key: <span className="font-mono">{maskApiKey(selectedKey.key)}</span>
              </p>
            )}
          </div>
        )}

        {/* Test Evaluator Button */}
        <div className="space-y-3 pt-2">
          <Button
            onClick={handleTestEvaluator}
            disabled={isTesting || availableKeys.length === 0}
            className="w-full"
          >
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Test Evaluator
              </>
            )}
          </Button>

          {/* Test Result */}
          {testResult && (
            <div
              className={`flex items-center gap-2 text-sm p-3 rounded-md ${
                testResult.success
                  ? "bg-success/10 text-success"
                  : "bg-error/10 text-error"
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Info Card */}
        <Card className="bg-surface/50 border-border">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">About the evaluator:</strong>{" "}
              The AI evaluator scores benchmark outputs using the selected model.
              We recommend using <span className="text-primary">GPT-4o</span> or{" "}
              <span className="text-primary">Claude 3.5 Sonnet</span> for best results.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
