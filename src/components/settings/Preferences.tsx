/**
 * Preferences Component
 *
 * Client component for user preferences (theme, concurrency, timeout, export)
 */

"use client";

import { useState, useEffect } from "react";
import { Moon, Sun, Monitor, Save, CheckCircle } from "lucide-react";
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  PreferencesSchema,
  ThemeEnum,
  ExportFormatEnum,
  type Theme,
  type ExportFormat,
  type Preferences,
} from "@/lib/settings";

interface PreferencesProps {
  preferences: Preferences;
  onUpdate: (preferences: Partial<Preferences>) => void;
}

export function Preferences({ preferences, onUpdate }: PreferencesProps) {
  const [localPrefs, setLocalPrefs] = useState<Preferences>(preferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  const handleSave = () => {
    // Validate with Zod
    const validated = PreferencesSchema.parse(localPrefs);
    onUpdate(validated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const themeIcons: Record<Theme, React.ReactNode> = {
    dark: <Moon className="h-4 w-4" />,
    light: <Sun className="h-4 w-4" />,
    system: <Monitor className="h-4 w-4" />,
  };

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Appearance</CardTitle>
          <CardDescription>Customize the look and feel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Theme */}
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={localPrefs.theme}
              onValueChange={(value) =>
                setLocalPrefs({ ...localPrefs, theme: value as Theme })
              }
            >
              <SelectTrigger id="theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ThemeEnum.options.map((theme) => (
                  <SelectItem key={theme} value={theme}>
                    <div className="flex items-center gap-2">
                      {themeIcons[theme]}
                      <span className="capitalize">{theme}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select your preferred color theme. System follows your OS setting.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Benchmark Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Benchmark Settings</CardTitle>
          <CardDescription>Default settings for running benchmarks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Concurrency */}
          <div className="space-y-2">
            <Label htmlFor="concurrency">
              Parallel Model Runs: {localPrefs.concurrency}
            </Label>
            <Input
              id="concurrency"
              type="range"
              min="1"
              max="10"
              value={localPrefs.concurrency}
              onChange={(e) =>
                setLocalPrefs({
                  ...localPrefs,
                  concurrency: parseInt(e.target.value),
                })
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 (sequential)</span>
              <span>10 (max parallel)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              How many models to run in parallel. Higher values may hit rate limits.
            </p>
          </div>

          {/* Timeout */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="timeout-enabled">Enable Timeout</Label>
                <p className="text-xs text-muted-foreground">
                  Limit how long a model can run
                </p>
              </div>
              <Switch
                id="timeout-enabled"
                checked={localPrefs.timeoutEnabled}
                onCheckedChange={(checked) =>
                  setLocalPrefs({ ...localPrefs, timeoutEnabled: checked })
                }
              />
            </div>

            {localPrefs.timeoutEnabled && (
              <div className="space-y-2 pl-4 border-l-2 border-border">
                <Label htmlFor="timeout">
                  Timeout: {localPrefs.timeoutSec} seconds
                </Label>
                <Input
                  id="timeout"
                  type="number"
                  min="60"
                  max="3600"
                  step="30"
                  value={localPrefs.timeoutSec}
                  onChange={(e) =>
                    setLocalPrefs({
                      ...localPrefs,
                      timeoutSec: parseInt(e.target.value) || 600,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Maximum time to wait for a model response (1-60 minutes).
                </p>
              </div>
            )}

            {!localPrefs.timeoutEnabled && (
              <div className="p-3 bg-warning/10 border border-warning/20 rounded-md">
                <p className="text-sm text-warning">
                  <strong>Warning:</strong> Disabling timeout may cause long wait
                  times and high costs if a model hangs.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Export Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Export Settings</CardTitle>
          <CardDescription>Default format and options for exporting results</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Default Format */}
          <div className="space-y-2">
            <Label htmlFor="export-format">Default Format</Label>
            <Select
              value={localPrefs.exportFormat}
              onValueChange={(value) =>
                setLocalPrefs({ ...localPrefs, exportFormat: value as ExportFormat })
              }
            >
              <SelectTrigger id="export-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ExportFormatEnum.options.map((format) => (
                  <SelectItem key={format} value={format}>
                    {format.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Default file format when exporting benchmark results.
            </p>
          </div>

          {/* Include Metrics */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="include-metrics">Include Detailed Metrics</Label>
              <p className="text-xs text-muted-foreground">
                Add metric breakdowns to exports
              </p>
            </div>
            <Switch
              id="include-metrics"
              checked={localPrefs.includeMetrics}
              onCheckedChange={(checked) =>
                setLocalPrefs({ ...localPrefs, includeMetrics: checked })
              }
            />
          </div>

          {/* Include Explanations */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="include-explanations">Include Explanations</Label>
              <p className="text-xs text-muted-foreground">
                Add AI explanations for scores
              </p>
            </div>
            <Switch
              id="include-explanations"
              checked={localPrefs.includeExplanations}
              onCheckedChange={(checked) =>
                setLocalPrefs({ ...localPrefs, includeExplanations: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-2">
        {saved && (
          <span className="text-sm text-success flex items-center gap-1">
            <CheckCircle className="h-4 w-4" />
            Settings saved
          </span>
        )}
        <Button onClick={handleSave} className="min-w-[100px]">
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
    </div>
  );
}
