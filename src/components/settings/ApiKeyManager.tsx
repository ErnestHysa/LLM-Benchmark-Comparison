/**
 * API Key Manager Component
 *
 * Client component for managing API keys stored in localStorage
 */

"use client";

import { useState } from "react";
import { z } from "zod";
import {
  Key,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Loader2,
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  SettingsProviderEnum,
  type SettingsProvider,
  type ApiKey,
  encodeApiKey,
  maskApiKey,
} from "@/lib/settings";

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

interface AddKeyForm {
  provider: SettingsProvider;
  label: string;
  apiKey: string;
}

const testResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  models: z.array(z.string()).optional(),
});

interface TestResult {
  success: boolean;
  message: string;
  models?: string[];
}

interface ApiKeyManagerProps {
  apiKeys: ApiKey[];
  onAddKey: (key: Omit<ApiKey, "id">) => void;
  onDeleteKey: (id: string) => void;
  onUpdateKey: (id: string, updates: Partial<ApiKey>) => void;
}

export function ApiKeyManager({
  apiKeys,
  onAddKey,
  onDeleteKey,
  onUpdateKey,
}: ApiKeyManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddKeyForm>({
    provider: "OPENAI",
    label: "",
    apiKey: "",
  });
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);

  const handleTestKey = async (provider: SettingsProvider, key: string, keyId?: string) => {
    if (keyId) {
      setTestingKeyId(keyId);
    } else {
      setIsTesting(true);
    }
    setTestResult(null);

    try {
      const response = await fetch("/api/settings/test-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: key }),
      });

      const result = testResultSchema.parse(await response.json());
      setTestResult(result);

      if (result.success && keyId) {
        // Update lastTested and lastTestSuccess
        onUpdateKey(keyId, {
          lastTested: new Date().toISOString(),
          lastTestSuccess: true,
        });
      } else if (keyId) {
        onUpdateKey(keyId, {
          lastTested: new Date().toISOString(),
          lastTestSuccess: false,
        });
      }
    } catch {
      setTestResult({ success: false, message: "Failed to test connection" });
    } finally {
      setIsTesting(false);
      setTestingKeyId(null);
    }
  };

  const handleAddKey = () => {
    if (!addForm.label.trim() || !addForm.apiKey.trim()) {
      setTestResult({ success: false, message: "Please fill in all fields" });
      return;
    }

    // Test the key first
    handleTestKey(addForm.provider, addForm.apiKey).then(() => {
      // Add key regardless of test result (user may want to add anyway)
      onAddKey({
        provider: addForm.provider,
        label: addForm.label,
        key: encodeApiKey(addForm.apiKey),
        isActive: true,
        lastTested: null,
        lastTestSuccess: null,
      });

      // Reset form
      setAddForm({ provider: "OPENAI", label: "", apiKey: "" });
      setShowKey(false);
      setTestResult(null);
      setIsAddDialogOpen(false);
    });
  };

  const handleDeleteKey = (id: string) => {
    if (confirm("Are you sure you want to delete this API key?")) {
      onDeleteKey(id);
    }
  };

  const getLastTested = (key: ApiKey) => {
    if (!key.lastTested) return null;
    const date = new Date(key.lastTested);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-4">
      {/* Add Key Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add API Key
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add API Key</DialogTitle>
            <DialogDescription>
              Add a new API key for making requests to the provider.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Provider */}
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={addForm.provider}
                onValueChange={(value) =>
                  setAddForm({ ...addForm, provider: value as SettingsProvider })
                }
              >
                <SelectTrigger id="provider">
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

            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                placeholder="e.g., My OpenAI Key"
                value={addForm.label}
                onChange={(e) =>
                  setAddForm({ ...addForm, label: e.target.value })
                }
              />
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showKey ? "text" : "password"}
                  placeholder="sk-..."
                  value={addForm.apiKey}
                  onChange={(e) =>
                    setAddForm({ ...addForm, apiKey: e.target.value })
                  }
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Test Result */}
            {testResult && (
              <div
                className={`flex items-center gap-2 text-sm p-2 rounded ${
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

            {/* Loading State */}
            {isTesting && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Testing connection...</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setTestResult(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddKey} disabled={isTesting}>
              {isTesting ? "Testing..." : "Add Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Keys List */}
      {apiKeys.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No API keys configured yet.</p>
            <p className="text-sm mt-2">
              Add your API keys to start running benchmarks.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {apiKeys.map((key) => (
            <Card key={key.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-foreground truncate">
                        {key.label}
                      </h4>
                      <Badge
                        variant="outline"
                        className={providerColors[key.provider]}
                      >
                        {providerNames[key.provider]}
                      </Badge>
                      {!key.isActive && (
                        <Badge variant="outline" className="bg-muted/50">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <code className="font-mono text-xs bg-surface px-2 py-0.5 rounded">
                        {maskApiKey(key.key)}
                      </code>
                      {key.lastTested && (
                        <span className="text-xs">
                          Tested {getLastTested(key)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {testingKeyId === key.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const decodedKey = atob(key.key);
                          handleTestKey(key.provider, decodedKey, key.id);
                        }}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteKey(key.id)}
                    >
                      <Trash2 className="h-4 w-4 text-error" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
