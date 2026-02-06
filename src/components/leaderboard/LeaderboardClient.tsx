/**
 * Leaderboard Client Component
 *
 * Client-side features for leaderboard including model registration
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { addToast } from "@/components/ui/toaster";
import type { ModelProvider } from "@prisma/client";

interface RegisterModelDialogProps {
  onModelRegistered?: () => void;
}

export function RegisterModelDialog({ onModelRegistered }: RegisterModelDialogProps) {
  const [open, setOpen] = useState(false);
  const [modelId, setModelId] = useState("");
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<ModelProvider | "">("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!modelId.trim()) {
      addToast({
        title: "Validation Error",
        description: "Model ID is required",
        variant: "error",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: modelId.trim(),
          name: name.trim() || undefined,
          provider: provider || undefined,
          description: description.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to register model");
      }

      const data = await response.json();

      if (isMountedRef.current) {
        addToast({
          title: "Model Registered",
          description: `${data.model.name} has been registered successfully`,
          variant: "success",
        });

        // Reset form
        setModelId("");
        setName("");
        setProvider("");
        setDescription("");
        setOpen(false);

        // Refresh leaderboard
        onModelRegistered?.();
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error("Register model error:", error);
        addToast({
          title: "Registration Failed",
          description: error instanceof Error ? error.message : "Could not register model",
          variant: "error",
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  // Common model suggestions
  const modelSuggestions = [
    { id: "gpt-4o", name: "GPT-4o", provider: "OPENAI" as const },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OPENAI" as const },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", provider: "ANTHROPIC" as const },
    { id: "claude-3-opus", name: "Claude 3 Opus", provider: "ANTHROPIC" as const },
    { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet (OpenRouter)", provider: "OPENROUTER" as const },
    { id: "openai/gpt-4o", name: "GPT-4o (OpenRouter)", provider: "OPENROUTER" as const },
  ];

  const handleSelectSuggestion = (suggestion: typeof modelSuggestions[0]) => {
    setModelId(suggestion.id);
    setName(suggestion.name);
    setProvider(suggestion.provider);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Register Model
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Register a Model</DialogTitle>
          <DialogDescription>
            Add a model to the leaderboard. The model will appear in rankings
            once benchmarks are run with it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Common suggestions */}
          <div>
            <Label className="text-sm text-muted-foreground">Quick Add</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {modelSuggestions.map((suggestion) => (
                <Button
                  key={suggestion.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="text-xs"
                >
                  {suggestion.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="modelId">Model ID *</Label>
            <Input
              id="modelId"
              placeholder="e.g., gpt-4o, claude-3-5-sonnet, anthropic/claude-3.5-sonnet"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              The exact model identifier used by the provider
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              placeholder="e.g., GPT-4o, Claude 3.5 Sonnet"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Defaults to Model ID if not provided
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select value={provider} onValueChange={(value) => setProvider(value as ModelProvider)}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Auto-detect from Model ID" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPENAI">OpenAI</SelectItem>
                <SelectItem value="ANTHROPIC">Anthropic</SelectItem>
                <SelectItem value="OPENROUTER">OpenRouter</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Auto-detected if not specified (OpenRouter models contain &quot;/&quot;, etc.)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Optional notes about this model"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registering...
                </>
              ) : (
                "Register Model"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
