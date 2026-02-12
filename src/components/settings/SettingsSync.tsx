/**
 * Settings Sync Component
 *
 * Provides buttons to sync settings to/from database for persistence
 */

"use client";

import React, { useState, useEffect } from "react";
import { Cloud, CloudOff, Download, Upload, Trash2, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { SettingsManager, type Preferences } from "@/lib/settings";

type SyncStatus = "idle" | "syncing" | "success" | "error";

interface SyncResult {
  status: SyncStatus;
  message: string;
}

export function SettingsSync() {
  const [autoSync, setAutoSync] = useState(false);

  // Load auto-sync preference from settings
  useEffect(() => {
    const settings = SettingsManager.getSettings();
    const prefs = settings.preferences as Preferences & { autoSync?: boolean };
    setAutoSync(prefs.autoSync || false);
  }, []);
  const [syncResult, setSyncResult] = useState<SyncResult>({ status: "idle", message: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [hasDatabaseSettings, setHasDatabaseSettings] = useState<boolean | null>(null);

  const handleSyncToDatabase = async () => {
    setIsLoading(true);
    setSyncResult({ status: "syncing", message: "Saving settings to database..." });

    const result = await SettingsManager.syncSettingsToDatabase();

    if (result.success) {
      setSyncResult({ status: "success", message: result.message });
      setHasDatabaseSettings(true);
      setAutoSync(true);
    } else {
      setSyncResult({ status: "error", message: result.message });
    }

    setIsLoading(false);
    setTimeout(() => setSyncResult({ status: "idle", message: "" }), 5000);
  };

  const handleLoadFromDatabase = async () => {
    setIsLoading(true);
    setSyncResult({ status: "syncing", message: "Loading settings from database..." });

    const result = await SettingsManager.loadSettingsFromDatabase();

    if (result.success) {
      if (result.loaded) {
        setSyncResult({ status: "success", message: result.message });
        setHasDatabaseSettings(true);
        // Refresh to apply loaded settings
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setSyncResult({ status: "error", message: "No saved settings found in database" });
      }
    } else {
      setSyncResult({ status: "error", message: result.message });
    }

    setIsLoading(false);
    setTimeout(() => setSyncResult({ status: "idle", message: "" }), 5000);
  };

  const handleClearDatabase = async () => {
    if (!confirm("Are you sure you want to delete all saved settings from the database? This cannot be undone.")) {
      return;
    }

    setIsLoading(true);
    setSyncResult({ status: "syncing", message: "Clearing database settings..." });

    const result = await SettingsManager.clearDatabaseSettings();

    if (result.success) {
      setSyncResult({ status: "success", message: result.message });
      setHasDatabaseSettings(false);
      setAutoSync(false);
    } else {
      setSyncResult({ status: "error", message: result.message });
    }

    setIsLoading(false);
    setTimeout(() => setSyncResult({ status: "idle", message: "" }), 5000);
  };

  const handleAutoSyncChange = async (enabled: boolean) => {
    setAutoSync(enabled);
    const settings = SettingsManager.getSettings();
    const prefs = { ...settings.preferences, autoSync: enabled };
    SettingsManager.updatePreferences(prefs);

    if (enabled) {
      // Automatically sync when enabling auto-sync
      await handleSyncToDatabase();
    }
  };

  // Check database settings on mount
  useEffect(() => {
    if (hasDatabaseSettings === null) {
      SettingsManager.checkDatabaseSettings().then(setHasDatabaseSettings);
    }
  }, [hasDatabaseSettings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Settings Sync
        </CardTitle>
        <CardDescription>
          Save your settings to the database for persistence across sessions and devices
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-sync toggle */}
        <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="auto-sync" className="flex items-center gap-2">
              {autoSync ? (
                <Cloud className="h-4 w-4 text-primary" />
              ) : (
                <CloudOff className="h-4 w-4 text-muted-foreground" />
              )}
              Auto-sync to Database
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically save settings to database when changed
            </p>
          </div>
          <Switch
            id="auto-sync"
            checked={autoSync}
            onCheckedChange={handleAutoSyncChange}
            disabled={isLoading}
          />
        </div>

        {/* Database status */}
        {hasDatabaseSettings !== null && (
          <div className={`p-3 rounded-lg border ${
            hasDatabaseSettings
              ? "bg-success/10 border-success/20"
              : "bg-muted/50 border-border"
          }`}>
            <p className="text-sm flex items-center gap-2">
              {hasDatabaseSettings ? (
                <>
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Settings saved in database</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span>No saved settings in database</span>
                </>
              )}
            </p>
          </div>
        )}

        {/* Sync result alert */}
        {syncResult.status !== "idle" && (
          <Alert
            variant={
              syncResult.status === "error" ? "destructive" :
              syncResult.status === "success" ? "success" : "default"
            }
          >
            {syncResult.status === "syncing" && <Loader2 className="h-4 w-4 animate-spin" />}
            {syncResult.status === "success" && <CheckCircle className="h-4 w-4" />}
            {syncResult.status === "error" && <AlertCircle className="h-4 w-4" />}
            <AlertDescription>{syncResult.message}</AlertDescription>
          </Alert>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            onClick={handleSyncToDatabase}
            disabled={isLoading}
            variant="default"
            className="w-full"
          >
            {isLoading && syncResult.status === "syncing" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Save to Database
          </Button>

          <Button
            onClick={handleLoadFromDatabase}
            disabled={isLoading || !hasDatabaseSettings}
            variant="outline"
            className="w-full"
          >
            {isLoading && syncResult.status === "syncing" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Load from Database
          </Button>

          <Button
            onClick={handleClearDatabase}
            disabled={isLoading || !hasDatabaseSettings}
            variant="destructive"
            className="w-full"
          >
            {isLoading && syncResult.status === "syncing" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Clear Database
          </Button>
        </div>

        {/* Info text */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Note:</strong> Settings are always saved to your browser&apos;s localStorage.
            Use the database sync to persist settings across devices, browsers, or when clearing
            browser data.
          </p>
          <p className="text-warning">
            <strong>Security:</strong> API keys are stored in the database. Only use this on
            trusted devices.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
