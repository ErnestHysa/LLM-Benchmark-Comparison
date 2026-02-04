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
  exportFormat: ExportFormatEnum.default("csv"),
  includeMetrics: z.boolean().default(true),
  includeExplanations: z.boolean().default(true),
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
    exportFormat: "csv",
    includeMetrics: true,
    includeExplanations: true,
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
    exportFormat: "csv",
    includeMetrics: true,
    includeExplanations: true,
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

export function decodeApiKey(encoded: string): string {
  try {
    return atob(encoded);
  } catch {
    return "";
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
}
