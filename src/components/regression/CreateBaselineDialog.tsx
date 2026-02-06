/**
 * CreateBaselineDialog Component
 *
 * Dialog for creating a new regression baseline
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

interface Benchmark {
  id: string;
  name: string;
  primaryCategory: string;
}

interface CreateBaselineDialogProps {
  trigger?: React.ReactNode;
}

export function CreateBaselineDialog({ trigger }: CreateBaselineDialogProps) {
  const [open, setOpen] = useState(false);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    benchmarkId: "",
    modelIds: "gpt-4o, claude-3-5-sonnet",
    evaluator: "gpt-4o",
    thresholdMin: "",
    thresholdMax: "",
    regressionDelta: "",
  });

  const fetchBenchmarks = async () => {
    try {
      const response = await fetch("/api/benchmarks?limit=100");
      const data = await response.json();
      setBenchmarks(data.benchmarks || []);
    } catch (error) {
      console.error("Failed to fetch benchmarks:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/baselines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          modelIds: formData.modelIds.split(",").map((m) => m.trim()),
          thresholdMin: formData.thresholdMin ? parseFloat(formData.thresholdMin) : null,
          thresholdMax: formData.thresholdMax ? parseFloat(formData.thresholdMax) : null,
          regressionDelta: formData.regressionDelta ? parseFloat(formData.regressionDelta) : null,
        }),
      });

      if (response.ok) {
        setOpen(false);
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error?.message || "Failed to create baseline");
      }
    } catch (error) {
      console.error("Failed to create baseline:", error);
      alert("Failed to create baseline");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger || (
        <Button onClick={() => {
          fetchBenchmarks();
          setOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          New Baseline
        </Button>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Regression Baseline</DialogTitle>
          <DialogDescription>
            Set up automated testing to track model performance over time and detect regressions
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Baseline Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Production Models Weekly Test"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What this baseline tests and why it matters..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          {/* Benchmark */}
          <div className="space-y-2">
            <Label htmlFor="benchmark">Benchmark *</Label>
            <select
              id="benchmark"
              className="w-full px-3 py-2 bg-background border border-input rounded-md"
              value={formData.benchmarkId}
              onChange={(e) => setFormData({ ...formData, benchmarkId: e.target.value })}
              required
            >
              <option value="">Select a benchmark...</option>
              {benchmarks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.primaryCategory})
                </option>
              ))}
            </select>
          </div>

          {/* Models */}
          <div className="space-y-2">
            <Label htmlFor="models">Models to Test * (comma-separated)</Label>
            <Input
              id="models"
              placeholder="gpt-4o, claude-3-5-sonnet"
              value={formData.modelIds}
              onChange={(e) => setFormData({ ...formData, modelIds: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              Enter model IDs separated by commas
            </p>
          </div>

          {/* Evaluator */}
          <div className="space-y-2">
            <Label htmlFor="evaluator">Evaluator Model</Label>
            <Input
              id="evaluator"
              value={formData.evaluator}
              onChange={(e) => setFormData({ ...formData, evaluator: e.target.value })}
            />
          </div>

          {/* Thresholds */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="thresholdMin">Min Score (optional)</Label>
              <Input
                id="thresholdMin"
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="70"
                value={formData.thresholdMin}
                onChange={(e) => setFormData({ ...formData, thresholdMin: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="thresholdMax">Max Score (optional)</Label>
              <Input
                id="thresholdMax"
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="100"
                value={formData.thresholdMax}
                onChange={(e) => setFormData({ ...formData, thresholdMax: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="regressionDelta">Regression Alert %</Label>
              <Input
                id="regressionDelta"
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="5"
                value={formData.regressionDelta}
                onChange={(e) => setFormData({ ...formData, regressionDelta: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Alert if score drops by this %
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Baseline"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
