/**
 * Settings Page
 *
 * Client component page for managing API keys, models, evaluator, and preferences
 */

"use client";

import { useState, useEffect } from "react";
import { Key, Cpu, Brain, Sliders } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumb } from "@/components/layout";
import {
  SettingsManager,
  type Settings as SettingsType,
  type ApiKey,
  type Model,
  type CustomModel,
  type EvaluatorConfig,
  type Preferences,
  PREDEFINED_MODELS,
} from "@/lib/settings";
import { ApiKeyManager } from "@/components/settings/ApiKeyManager";
import { ModelManager } from "@/components/settings/ModelManager";
import { EvaluatorSelector } from "@/components/settings/EvaluatorSelector";
import { Preferences as PreferencesComponent } from "@/components/settings/Preferences";

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsType>(SettingsManager.getSettings());
  const [mounted, setMounted] = useState(false);

  // Load settings on mount (client-side only)
  useEffect(() => {
    setSettings(SettingsManager.getSettings());
    setMounted(true);
  }, []);

  // Combine predefined models with custom models
  const allModels: Model[] = [
    ...PREDEFINED_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      isEnabled: !settings.disabledPredefinedModels.includes(m.id),
      isCustom: false as const,
    })),
    ...settings.models,
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Settings" },
  ];

  if (!mounted) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={breadcrumbItems} />
        <div className="animate-pulse">
          <div className="h-8 bg-surface rounded w-48 mb-4" />
          <div className="h-64 bg-surface rounded" />
        </div>
      </div>
    );
  }

  const handleAddApiKey = (key: Omit<ApiKey, "id">) => {
    SettingsManager.addApiKey(key);
    setSettings(SettingsManager.getSettings());
  };

  const handleDeleteApiKey = (id: string) => {
    SettingsManager.deleteApiKey(id);
    setSettings(SettingsManager.getSettings());
  };

  const handleUpdateApiKey = (id: string, updates: Partial<ApiKey>) => {
    SettingsManager.updateApiKey(id, updates);
    setSettings(SettingsManager.getSettings());
  };

  const handleToggleModel = (modelId: string, enabled: boolean) => {
    const model = settings.models.find((m) => m.id === modelId);
    if (model) {
      // Custom model
      SettingsManager.updateCustomModel(modelId, { isEnabled: enabled });
    } else {
      // Predefined model
      SettingsManager.setPredefinedModelEnabled(modelId, enabled);
    }
    setSettings(SettingsManager.getSettings());
  };

  const handleAddModel = (model: Omit<CustomModel, "id">) => {
    SettingsManager.addCustomModel(model);
    setSettings(SettingsManager.getSettings());
  };

  const handleDeleteModel = (id: string) => {
    SettingsManager.deleteCustomModel(id);
    setSettings(SettingsManager.getSettings());
  };

  const handleUpdateEvaluator = (config: Partial<EvaluatorConfig>) => {
    SettingsManager.updateEvaluator(config);
    setSettings(SettingsManager.getSettings());
  };

  const handleUpdatePreferences = (prefs: Partial<Preferences>) => {
    SettingsManager.updatePreferences(prefs);
    setSettings(SettingsManager.getSettings());
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="animate-fade-in">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your API keys, models, evaluator, and preferences
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="animate-fade-in-up delay-100">
        <Tabs defaultValue="api-keys" className="space-y-4">
          <TabsList className="bg-surface border border-border p-1 rounded-lg">
            <TabsTrigger value="api-keys" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="models" className="flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              Models
            </TabsTrigger>
            <TabsTrigger value="evaluator" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Evaluator
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Sliders className="h-4 w-4" />
              Preferences
            </TabsTrigger>
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Store your API keys securely. Keys are saved in your browser&apos;s
                  local storage and never sent to our servers.
                </p>
              </CardHeader>
              <CardContent>
                <ApiKeyManager
                  apiKeys={settings.apiKeys}
                  onAddKey={handleAddApiKey}
                  onDeleteKey={handleDeleteApiKey}
                  onUpdateKey={handleUpdateApiKey}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Model Configuration</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Enable or disable predefined models, or add custom models from
                  OpenRouter and other providers.
                </p>
              </CardHeader>
              <CardContent>
                <ModelManager
                  models={allModels}
                  onToggleModel={handleToggleModel}
                  onAddModel={handleAddModel}
                  onDeleteModel={handleDeleteModel}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Evaluator Tab */}
          <TabsContent value="evaluator" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Evaluator Configuration</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure the AI model that evaluates benchmark outputs.
                  GPT-4o or Claude 3.5 Sonnet are recommended for best results.
                </p>
              </CardHeader>
              <CardContent>
                <EvaluatorSelector
                  evaluator={settings.evaluator}
                  apiKeys={settings.apiKeys}
                  onUpdate={handleUpdateEvaluator}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="mt-4">
            <PreferencesComponent
              preferences={settings.preferences}
              onUpdate={handleUpdatePreferences}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
