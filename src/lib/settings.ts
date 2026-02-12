/**
 * Settings Types & Utilities
 *
 * LocalStorage-based settings for API keys, models, evaluator, and preferences
 */

import { z } from "zod";

/**
 * Provider enum matching the database schema
 */
export const SettingsProviderEnum = z.enum([
  "OPENAI",
  "ANTHROPIC",
  "OPENROUTER",
  "CUSTOM",
]);

export type SettingsProvider = z.infer<typeof SettingsProviderEnum>;

/**
 * API Key Schema
 */
export const ApiKeySchema = z.object({
  id: z.string(),
  provider: SettingsProviderEnum,
  label: z.string().min(1).max(100),
  key: z.string(), // Base64 encoded
  isActive: z.boolean().default(true),
  lastTested: z.string().nullable(), // ISO timestamp
  lastTestSuccess: z.boolean().nullable(),
});

export type ApiKey = z.infer<typeof ApiKeySchema>;

/**
 * Custom Model Schema (user-added)
 */
export const CustomModelSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  displayName: z.string().min(1).max(100),
  provider: SettingsProviderEnum,
  description: z.string().max(500).optional(),
  isEnabled: z.boolean().default(true),
  isCustom: z.boolean().default(true),
  apiEndpoint: z.string().url().optional(),
});

export type CustomModel = z.infer<typeof CustomModelSchema>;

/**
 * Predefined model (from seed, read-only)
 */
export interface PredefinedModel {
  id: string;
  name: string;
  provider: SettingsProvider;
  isEnabled: boolean;
  isCustom: false;
}

export type Model = PredefinedModel | CustomModel;

/**
 * Evaluator Configuration Schema
 */
export const EvaluatorConfigSchema = z.object({
  model: z.string().min(1).default("gpt-4o"),
  provider: SettingsProviderEnum.default("OPENAI"),
  apiKeyId: z.string().nullable(), // Reference to API key
  lastTested: z.string().nullable(),
  lastTestSuccess: z.boolean().nullable(),
});

export type EvaluatorConfig = z.infer<typeof EvaluatorConfigSchema>;

/**
 * Theme Options
 */
export const ThemeEnum = z.enum(["dark", "light", "system"]);
export type Theme = z.infer<typeof ThemeEnum>;

/**
 * Export Format Options
 */
export const ExportFormatEnum = z.enum(["csv", "json", "pdf"]);
export type ExportFormat = z.infer<typeof ExportFormatEnum>;

/**
 * Preferences Schema
 */
export const PreferencesSchema = z.object({
  theme: ThemeEnum.default("dark"),
  concurrency: z.number().min(1).max(10).default(5),
  timeoutEnabled: z.boolean().default(true),
  timeoutSec: z.number().min(60).max(3600).default(600),
  maxTokens: z.number().min(256).max(32000).default(8192),
  exportFormat: ExportFormatEnum.default("csv"),
  includeMetrics: z.boolean().default(true),
  includeExplanations: z.boolean().default(true),
  autoSync: z.boolean().default(false), // Auto-sync settings to database
});

export type Preferences = z.infer<typeof PreferencesSchema>;

/**
 * Complete Settings Schema
 */
export const SettingsSchema = z.object({
  apiKeys: z.array(ApiKeySchema).default([]),
  models: z.array(CustomModelSchema).default([]),
  disabledPredefinedModels: z.array(z.string()).default([]), // IDs of disabled predefined models
  evaluator: EvaluatorConfigSchema.default({
    model: "gpt-4o",
    provider: "OPENAI",
    apiKeyId: null,
    lastTested: null,
    lastTestSuccess: null,
  }),
  preferences: PreferencesSchema.default({
    theme: "dark",
    concurrency: 5,
    timeoutEnabled: true,
    timeoutSec: 600,
    maxTokens: 8192,
    exportFormat: "csv",
    includeMetrics: true,
    includeExplanations: true,
    autoSync: false,
  }),
});

export type Settings = z.infer<typeof SettingsSchema>;

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: Settings = {
  apiKeys: [],
  models: [],
  disabledPredefinedModels: [],
  evaluator: {
    model: "gpt-4o",
    provider: "OPENAI",
    apiKeyId: null,
    lastTested: null,
    lastTestSuccess: null,
  },
  preferences: {
    theme: "dark",
    concurrency: 5,
    timeoutEnabled: true,
    timeoutSec: 600,
    maxTokens: 8192,
    exportFormat: "csv",
    includeMetrics: true,
    includeExplanations: true,
    autoSync: false,
  },
};

/**
 * Predefined models that users can enable/disable
 */
export const PREDEFINED_MODELS = [
  // OpenAI
  { id: "gpt-4o", name: "GPT-4o", provider: "OPENAI" as const },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OPENAI" as const },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OPENAI" as const },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "OPENAI" as const },
  // Anthropic
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "ANTHROPIC" as const },
  { id: "claude-3-opus", name: "Claude 3 Opus", provider: "ANTHROPIC" as const },
  { id: "claude-3-sonnet", name: "Claude 3 Sonnet", provider: "ANTHROPIC" as const },
  { id: "claude-3-haiku", name: "Claude 3 Haiku", provider: "ANTHROPIC" as const },
];

/**
 * LocalStorage keys
 */
const SETTINGS_KEY = "llm-benchmark-settings";
const API_KEYS_KEY = "llm-benchmark-api-keys";
const MODELS_KEY = "llm-benchmark-models";
const EVALUATOR_KEY = "llm-benchmark-evaluator";
const PREFERENCES_KEY = "llm-benchmark-preferences";

/**
 * Simple encryption (base64 encoding) - NOT secure for production
 * In production, use proper encryption like crypto.subtle.encrypt()
 */
export function encodeApiKey(key: string): string {
  return btoa(key);
}

export function decodeApiKey(encoded: string): string | null {
  if (!encoded) return null;
  try {
    const decoded = atob(encoded);
    // Basic validation: decoded string should be non-empty and reasonable length
    if (!decoded || decoded.length < 10) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Mask API key for display (e.g., sk-...abcd)
 */
export function maskApiKey(key: string, visibleChars = 4): string {
  if (key.length <= visibleChars + 10) {
    return "•".repeat(Math.min(key.length, 20));
  }
  const prefix = key.split("-")[0] || key.slice(0, 3);
  const suffix = key.slice(-visibleChars);
  return `${prefix}...${suffix}`;
}

/**
 * Settings API class for localStorage management
 */
export class SettingsManager {
  /**
   * Get all settings
   */
  static getSettings(): Settings {
    if (typeof window === "undefined") {
      return DEFAULT_SETTINGS;
    }

    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return SettingsSchema.parse({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }

    return DEFAULT_SETTINGS;
  }

  /**
   * Save all settings
   */
  static saveSettings(settings: Settings): void {
    if (typeof window === "undefined") return;

    try {
      const validated = SettingsSchema.parse(settings);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(validated));
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }

  /**
   * Get API keys
   */
  static getApiKeys(): ApiKey[] {
    const settings = this.getSettings();
    return settings.apiKeys;
  }

  /**
   * Add API key
   */
  static addApiKey(apiKey: Omit<ApiKey, "id">): ApiKey {
    const settings = this.getSettings();
    const newKey: ApiKey = {
      ...apiKey,
      id: `key-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    settings.apiKeys.push(newKey);
    this.saveSettings(settings);
    return newKey;
  }

  /**
   * Update API key
   */
  static updateApiKey(id: string, updates: Partial<ApiKey>): boolean {
    const settings = this.getSettings();
    const index = settings.apiKeys.findIndex((k) => k.id === id);
    if (index === -1) return false;

    settings.apiKeys[index] = { ...settings.apiKeys[index], ...updates } as ApiKey;
    this.saveSettings(settings);
    return true;
  }

  /**
   * Delete API key
   */
  static deleteApiKey(id: string): boolean {
    const settings = this.getSettings();
    const initialLength = settings.apiKeys.length;
    settings.apiKeys = settings.apiKeys.filter((k) => k.id !== id);

    if (settings.apiKeys.length < initialLength) {
      this.saveSettings(settings);
      return true;
    }
    return false;
  }

  /**
   * Get API key for provider (first active one)
   */
  static getApiKeyForProvider(provider: SettingsProvider): string | null {
    const settings = this.getSettings();
    const apiKey = settings.apiKeys.find(
      (k) => k.provider === provider && k.isActive
    );
    return apiKey ? decodeApiKey(apiKey.key) : null;
  }

  /**
   * Get custom models
   */
  static getCustomModels(): CustomModel[] {
    const settings = this.getSettings();
    return settings.models;
  }

  /**
   * Add custom model
   */
  static addCustomModel(model: Omit<CustomModel, "id">): CustomModel {
    const settings = this.getSettings();
    const newModel: CustomModel = {
      ...model,
      id: `model-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    settings.models.push(newModel);
    this.saveSettings(settings);

    // Sync to database for persistence
    this.syncCustomModelsToDatabase().catch((err) => {
      console.error("[SettingsManager] Failed to sync new custom model to database:", err);
    });

    return newModel;
  }

  /**
   * Update custom model
   */
  static updateCustomModel(id: string, updates: Partial<CustomModel>): boolean {
    const settings = this.getSettings();
    const index = settings.models.findIndex((m) => m.id === id);
    if (index === -1) return false;

    settings.models[index] = { ...settings.models[index], ...updates } as CustomModel;
    this.saveSettings(settings);

    // Sync to database for persistence
    this.syncCustomModelsToDatabase().catch((err) => {
      console.error("[SettingsManager] Failed to sync updated custom model to database:", err);
    });

    return true;
  }

  /**
   * Delete custom model
   */
  static deleteCustomModel(id: string): boolean {
    const settings = this.getSettings();
    const initialLength = settings.models.length;
    settings.models = settings.models.filter((m) => m.id !== id);

    if (settings.models.length < initialLength) {
      this.saveSettings(settings);
      return true;
    }
    return false;
  }

  /**
   * Get all available models (predefined + custom)
   */
  static getAllModels(): Model[] {
    const settings = this.getSettings();
    const disabledIds = new Set(settings.disabledPredefinedModels);

    const predefined: PredefinedModel[] = PREDEFINED_MODELS.map((m) => ({
      ...m,
      isEnabled: !disabledIds.has(m.id),
      isCustom: false as const,
    }));

    return [...predefined, ...settings.models];
  }

  /**
   * Enable/disable predefined model
   */
  static setPredefinedModelEnabled(modelId: string, enabled: boolean): void {
    const settings = this.getSettings();
    const disabledSet = new Set(settings.disabledPredefinedModels);

    if (enabled) {
      disabledSet.delete(modelId);
    } else {
      disabledSet.add(modelId);
    }

    settings.disabledPredefinedModels = Array.from(disabledSet);
    this.saveSettings(settings);
  }

  /**
   * Get evaluator config
   */
  static getEvaluator(): EvaluatorConfig {
    const settings = this.getSettings();
    return settings.evaluator;
  }

  /**
   * Update evaluator config
   */
  static updateEvaluator(updates: Partial<EvaluatorConfig>): void {
    const settings = this.getSettings();
    settings.evaluator = { ...settings.evaluator, ...updates };
    this.saveSettings(settings);
  }

  /**
   * Get preferences
   */
  static getPreferences(): Preferences {
    const settings = this.getSettings();
    return settings.preferences;
  }

  /**
   * Update preferences
   */
  static updatePreferences(updates: Partial<Preferences>): void {
    const settings = this.getSettings();
    settings.preferences = { ...settings.preferences, ...updates };
    this.saveSettings(settings);
  }

  /**
   * Clear all settings (for logout/reset)
   */
  static clearAll(): void {
    if (typeof window === "undefined") return;

    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(API_KEYS_KEY);
    localStorage.removeItem(MODELS_KEY);
    localStorage.removeItem(EVALUATOR_KEY);
    localStorage.removeItem(PREFERENCES_KEY);
  }

  /**
   * Sync custom models to database for persistence
   * Call this when adding/updating custom models to ensure they're saved
   */
  static async syncCustomModelsToDatabase(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    try {
      const settings = this.getSettings();
      const customModels = settings.models.filter((m) => m.isCustom);

      if (customModels.length === 0) {
        console.info("[SettingsManager] No custom models to sync");
        return true;
      }

      const response = await fetch("/api/custom-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ models: customModels }),
      });

      if (response.ok) {
        const data = await response.json();
        console.info("[SettingsManager] Synced custom models to database:", data);
        return true;
      } else {
        console.error("[SettingsManager] Failed to sync custom models:", await response.text());
        return false;
      }
    } catch (error) {
      console.error("[SettingsManager] Error syncing custom models:", error);
      return false;
    }
  }

  /**
   * Load custom models from database
   * Useful for restoring models after clearing localStorage
   */
  static async loadCustomModelsFromDatabase(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    try {
      const response = await fetch("/api/custom-models");
      if (!response.ok) return false;

      const data = await response.json();
      const dbModels = data.models || [];

      if (dbModels.length === 0) {
        console.info("[SettingsManager] No custom models in database");
        return true;
      }

    // Merge with existing settings
        const settings = this.getSettings();
        const existingIds = new Set(settings.models.map((m) => m.id));
        const existingNames = new Set(settings.models.map((m) => m.name));

        let addedCount = 0;
        for (const dbModel of dbModels) {
          // Only add if not already in localStorage (check both id and name to avoid duplicates)
          const modelName = dbModel.providerId || dbModel.name;
          if (!existingIds.has(dbModel.id) && !existingNames.has(modelName)) {
            settings.models.push({
              id: dbModel.id,
              name: modelName, // For custom models, name = providerId
              displayName: dbModel.displayName || dbModel.name,
              provider: dbModel.provider,
              description: dbModel.description,
              isEnabled: dbModel.isEnabled ?? true,
              isCustom: true,
            });
            addedCount++;
          }
        }

      if (addedCount > 0) {
        this.saveSettings(settings);
        console.info(`[SettingsManager] Loaded ${addedCount} custom models from database`);
      }

      return true;
    } catch (error) {
      console.error("[SettingsManager] Error loading custom models:", error);
      return false;
    }
  }

  /**
   * Sync all settings to database
   * Call this to save all settings (API keys, models, preferences) to the database
   */
  static async syncSettingsToDatabase(): Promise<{ success: boolean; message: string; error?: string }> {
    if (typeof window === "undefined") return { success: false, message: "Not in browser environment" };

    try {
      const settings = this.getSettings();

      const payload = {
        apiKeys: settings.apiKeys,
        customModels: settings.models,
        disabledPredefinedModels: settings.disabledPredefinedModels,
        evaluatorModel: settings.evaluator.model,
        evaluatorProvider: settings.evaluator.provider,
        evaluatorApiKeyId: settings.evaluator.apiKeyId,
        theme: settings.preferences.theme,
        concurrency: settings.preferences.concurrency,
        timeoutEnabled: settings.preferences.timeoutEnabled,
        timeoutSec: settings.preferences.timeoutSec,
        maxTokens: settings.preferences.maxTokens,
        exportFormat: settings.preferences.exportFormat,
        includeMetrics: settings.preferences.includeMetrics,
        includeExplanations: settings.preferences.includeExplanations,
        autoSync: true, // Enable auto-sync after manual sync
      };

      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          message: errorData.error?.message || "Failed to sync settings",
          error: errorData.error?.code,
        };
      }

      const data = await response.json();
      console.info("[SettingsManager] Settings synced to database:", data);

      // Update local auto-sync preference
      settings.preferences = { ...settings.preferences, autoSync: true };
      this.saveSettings(settings);

      return {
        success: true,
        message: data.message || "Settings saved to database successfully",
      };
    } catch (error) {
      console.error("[SettingsManager] Error syncing settings to database:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to sync settings",
        error: "NETWORK_ERROR",
      };
    }
  }

  /**
   * Load all settings from database
   * Call this to restore settings from database to localStorage
   */
  static async loadSettingsFromDatabase(): Promise<{ success: boolean; message: string; loaded?: boolean; error?: string }> {
    if (typeof window === "undefined") return { success: false, message: "Not in browser environment" };

    try {
      const response = await fetch("/api/settings");

      if (!response.ok) {
        return {
          success: false,
          message: "Failed to load settings from database",
          error: "NETWORK_ERROR",
        };
      }

      const data = await response.json();

      if (!data.exists) {
        return {
          success: true,
          message: "No saved settings found in database",
          loaded: false,
        };
      }

      const dbSettings = data.settings;

      // Merge database settings with current settings
      const currentSettings = this.getSettings();
      const mergedSettings: Settings = {
        ...currentSettings,
        apiKeys: dbSettings.apiKeys || [],
        models: dbSettings.customModels || [],
        disabledPredefinedModels: dbSettings.disabledPredefinedModels || [],
        evaluator: {
          ...currentSettings.evaluator,
          model: dbSettings.evaluator?.model || currentSettings.evaluator.model,
          provider: dbSettings.evaluator?.provider || currentSettings.evaluator.provider,
          apiKeyId: dbSettings.evaluator?.apiKeyId || currentSettings.evaluator.apiKeyId,
        },
        preferences: {
          ...currentSettings.preferences,
          theme: dbSettings.preferences?.theme || currentSettings.preferences.theme,
          concurrency: dbSettings.preferences?.concurrency ?? currentSettings.preferences.concurrency,
          timeoutEnabled: dbSettings.preferences?.timeoutEnabled ?? currentSettings.preferences.timeoutEnabled,
          timeoutSec: dbSettings.preferences?.timeoutSec ?? currentSettings.preferences.timeoutSec,
          maxTokens: dbSettings.preferences?.maxTokens ?? currentSettings.preferences.maxTokens,
          exportFormat: dbSettings.preferences?.exportFormat || currentSettings.preferences.exportFormat,
          includeMetrics: dbSettings.preferences?.includeMetrics ?? currentSettings.preferences.includeMetrics,
          includeExplanations: dbSettings.preferences?.includeExplanations ?? currentSettings.preferences.includeExplanations,
          autoSync: dbSettings.autoSync ?? true,
        },
      };

      this.saveSettings(mergedSettings);
      console.info("[SettingsManager] Settings loaded from database");

      return {
        success: true,
        message: "Settings loaded from database successfully",
        loaded: true,
      };
    } catch (error) {
      console.error("[SettingsManager] Error loading settings from database:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load settings",
        error: "NETWORK_ERROR",
      };
    }
  }

  /**
   * Check if settings exist in database
   */
  static async checkDatabaseSettings(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    try {
      const response = await fetch("/api/settings");
      if (!response.ok) return false;

      const data = await response.json();
      return data.exists || false;
    } catch {
      return false;
    }
  }

  /**
   * Clear settings from database
   */
  static async clearDatabaseSettings(): Promise<{ success: boolean; message: string }> {
    if (typeof window === "undefined") return { success: false, message: "Not in browser environment" };

    try {
      const response = await fetch("/api/settings", { method: "DELETE" });

      if (!response.ok) {
        return {
          success: false,
          message: "Failed to clear database settings",
        };
      }

      // Also update local auto-sync preference
      const settings = this.getSettings();
      settings.preferences = { ...settings.preferences, autoSync: false };
      this.saveSettings(settings);

      return {
        success: true,
        message: "Database settings cleared",
      };
    } catch (error) {
      console.error("[SettingsManager] Error clearing database settings:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to clear settings",
      };
    }
  }

  /**
   * Auto-sync settings to database (if enabled)
   * Call this after any settings change
   */
  static async autoSyncIfNeeded(): Promise<void> {
    const settings = this.getSettings();
    if ((settings.preferences as any).autoSync) {
      await this.syncSettingsToDatabase();
    }
  }
}
