/**
 * Model Manager Component
 *
 * Client component for managing available models (enable/disable predefined, add custom models)
 */

"use client";

import { useState } from "react";
import { Plus, Trash2, Cpu } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
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
  type Model,
  type CustomModel,
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

interface AddModelForm {
  name: string;
  displayName: string;
  provider: SettingsProvider;
  apiEndpoint: string;
  description: string;
}

interface ModelManagerProps {
  models: Model[];
  onToggleModel: (modelId: string, enabled: boolean) => void;
  onAddModel: (model: Omit<CustomModel, "id">) => void;
  onDeleteModel: (id: string) => void;
}

export function ModelManager({
  models,
  onToggleModel,
  onAddModel,
  onDeleteModel,
}: ModelManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddModelForm>({
    name: "",
    displayName: "",
    provider: "OPENROUTER",
    apiEndpoint: "",
    description: "",
  });

  const handleAddModel = () => {
    if (!addForm.name.trim() || !addForm.displayName.trim()) {
      return;
    }

    onAddModel({
      name: addForm.name,
      displayName: addForm.displayName,
      provider: addForm.provider,
      description: addForm.description || undefined,
      isEnabled: true,
      isCustom: true,
      apiEndpoint: addForm.apiEndpoint || undefined,
    });

    // Reset form
    setAddForm({
      name: "",
      displayName: "",
      provider: "OPENROUTER",
      apiEndpoint: "",
      description: "",
    });
    setIsAddDialogOpen(false);
  };

  const handleDeleteModel = (id: string, name: string) => {
    if (confirm(`Delete custom model "${name}"?`)) {
      onDeleteModel(id);
    }
  };

  // Separate predefined and custom models
  const predefinedModels = models.filter((m) => !m.isCustom);
  const customModels = models.filter((m) => m.isCustom) as CustomModel[];

  return (
    <div className="space-y-6">
      {/* Add Custom Model Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Model
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Model</DialogTitle>
            <DialogDescription>
              Add a custom model from OpenRouter or your own API endpoint.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Provider */}
            <div className="space-y-2">
              <Label htmlFor="model-provider">Provider</Label>
              <Select
                value={addForm.provider}
                onValueChange={(value) =>
                  setAddForm({ ...addForm, provider: value as SettingsProvider })
                }
              >
                <SelectTrigger id="model-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SettingsProviderEnum.options.filter(p => p === "OPENROUTER" || p === "CUSTOM").map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider === "CUSTOM" ? "Custom Endpoint" : "OpenRouter"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                placeholder="e.g., Llama 3 70B"
                value={addForm.displayName}
                onChange={(e) =>
                  setAddForm({ ...addForm, displayName: e.target.value })
                }
              />
            </div>

            {/* Model ID */}
            <div className="space-y-2">
              <Label htmlFor="model-name">Model ID</Label>
              <Input
                id="model-name"
                placeholder={
                  addForm.provider === "OPENROUTER"
                    ? "e.g., meta-llama/llama-3-70b"
                    : "e.g., llama-3-70b"
                }
                value={addForm.name}
                onChange={(e) =>
                  setAddForm({ ...addForm, name: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                {addForm.provider === "OPENROUTER"
                  ? "Use the OpenRouter model ID format"
                  : "The model ID for your API endpoint"}
              </p>
            </div>

            {/* API Endpoint (for custom provider) */}
            {addForm.provider === "CUSTOM" && (
              <div className="space-y-2">
                <Label htmlFor="api-endpoint">API Endpoint</Label>
                <Input
                  id="api-endpoint"
                  placeholder="https://api.example.com/v1/chat/completions"
                  value={addForm.apiEndpoint}
                  onChange={(e) =>
                    setAddForm({ ...addForm, apiEndpoint: e.target.value })
                  }
                />
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="model-description">Description (optional)</Label>
              <Input
                id="model-description"
                placeholder="e.g., Fast open-source model"
                value={addForm.description}
                onChange={(e) =>
                  setAddForm({ ...addForm, description: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddModel}>Add Model</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Predefined Models */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Predefined Models
        </h3>
        {predefinedModels.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No predefined models available.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {predefinedModels.map((model) => (
              <Card key={model.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground">{model.name}</h4>
                        <Badge
                          variant="outline"
                          className={providerColors[model.provider]}
                        >
                          {providerNames[model.provider]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {model.id}
                      </p>
                    </div>
                    <Switch
                      checked={model.isEnabled}
                      onCheckedChange={(checked) =>
                        onToggleModel(model.id, checked)
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Custom Models */}
      {customModels.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Custom Models
          </h3>
          <div className="space-y-2">
            {customModels.map((model) => (
              <Card key={model.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground truncate">
                          {model.displayName}
                        </h4>
                        <Badge
                          variant="outline"
                          className={providerColors[model.provider]}
                        >
                          {providerNames[model.provider]}
                        </Badge>
                        {model.isEnabled ? (
                          <Badge
                            variant="outline"
                            className="bg-success/10 text-success border-success/20"
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-muted/50 text-muted-foreground"
                          >
                            Disabled
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                        {model.name}
                      </p>
                      {model.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {model.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={model.isEnabled}
                        onCheckedChange={(checked) => {
                          // Update the custom model's enabled state
                          onToggleModel(model.id, checked);
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteModel(model.id, model.displayName)}
                      >
                        <Trash2 className="h-4 w-4 text-error" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State for Custom Models */}
      {customModels.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Cpu className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No custom models configured.</p>
            <p className="text-sm mt-2">
              Add models from OpenRouter or your own API endpoints.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
