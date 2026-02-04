# AI Model Benchmark App - Improvement Plan

**Date:** 2026-02-19
**Status:** Ready for implementation via Claude Code CLI
**Base Score:** 8.5/10

---

## Overview

This plan addresses the high and medium priority improvements identified in the final evaluation. Focus: error handling, better UX, and production-ready features.

---

## 🎯 High Priority Tasks

### Task 1: Add Retry Logic for Failed API Calls

**Problem:** Models occasionally return errors during benchmarks, causing incomplete results.

**Solution:** Implement retry logic with exponential backoff for all API calls.

**Files to modify:**
- `lib/api/openrouter.ts` (or wherever API calls are made)
- `lib/benchmark/runner.ts` (or wherever benchmark execution logic is)

**Implementation:**

```typescript
// Create new file: lib/utils/retry.ts
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 2000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

```typescript
// Modify API call to use retry:
import { retryWithBackoff } from '@/lib/utils/retry';

const response = await retryWithBackoff(
  () => fetch(`${OPENROUTER_API_URL}/chat/completions`, options),
  3, // max retries
  2000 // 2s, 4s, 8s delays
);
```

**Testing:**
- Run benchmark with intentionally invalid model to verify retry behavior
- Monitor console logs for retry attempts
- Verify exponential backoff timing

---

### Task 2: Add API Key Validation in Settings

**Problem:** No way to validate API key before running expensive benchmarks.

**Solution:** Add "Test API Key" button in Settings that makes a lightweight validation call.

**Files to modify:**
- `app/settings/page.tsx`
- `lib/api/openrouter.ts`

**Implementation:**

```typescript
// Add to lib/api/openrouter.ts:
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${OPENROUTER_API_URL}/auth/key`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.href,
        'X-Title': 'AI Model Benchmark'
      }
    });

    return response.ok;
  } catch {
    return false;
  }
}
```

```typescript
// Add to Settings page UI:
const [validatingKey, setValidatingKey] = useState(false);
const [keyValid, setKeyValid] = useState<boolean | null>(null);

async function testApiKey() {
  setValidatingKey(true);
  const isValid = await validateApiKey(apiKey);
  setKeyValid(isValid);
  setValidatingKey(false);
}

// Add button:
<button
  onClick={testApiKey}
  disabled={validatingKey || !apiKey}
  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
>
  {validatingKey ? 'Testing...' : 'Test API Key'}
</button>

// Show validation result:
{keyValid === true && (
  <p className="text-green-500 text-sm">✓ API key is valid</p>
)}
{keyValid === false && (
  <p className="text-red-500 text-sm">✗ API key is invalid</p>
)}
```

---

### Task 3: Add Benchmark History

**Problem:** No way to see past benchmark runs or track progress over time.

**Solution:** Store benchmark history locally with timestamps and enable view/hide.

**Files to create:**
- `components/BenchmarkHistory.tsx`
- `lib/storage/benchmark-history.ts`

**Files to modify:**
- `app/benchmarks/page.tsx`
- `lib/benchmark/runner.ts`

**Implementation:**

```typescript
// Create lib/storage/benchmark-history.ts:
export interface BenchmarkRun {
  id: string;
  timestamp: number;
  duration: number;
  results: BenchmarkResult[];
  totalScore: number;
  modelsCount: number;
}

const STORAGE_KEY = 'benchmark_history';

export function saveBenchmarkRun(run: BenchmarkRun) {
  const history = getBenchmarkHistory();
  history.unshift(run);
  // Keep only last 50 runs
  if (history.length > 50) history.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function getBenchmarkHistory(): BenchmarkRun[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function clearBenchmarkHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
```

```typescript
// After benchmark completes in runner.ts:
const benchmarkRun: BenchmarkRun = {
  id: crypto.randomUUID(),
  timestamp: Date.now(),
  duration: Date.now() - startTime,
  results: finalResults,
  totalScore: results.reduce((sum, r) => sum + r.score, 0),
  modelsCount: results.length
};

saveBenchmarkRun(benchmarkRun);
```

```typescript
// Add history tab or section in Benchmarks page:
import { getBenchmarkHistory } from '@/lib/storage/benchmark-history';

function BenchmarkHistory() {
  const [history, setHistory] = useState<BenchmarkRun[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (showHistory) {
      setHistory(getBenchmarkHistory());
    }
  }, [showHistory]);

  if (!showHistory) return null;

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-3">Benchmark History</h3>
      <button
        onClick={() => {
          clearBenchmarkHistory();
          setHistory([]);
        }}
        className="text-red-500 text-sm hover:underline"
      >
        Clear History
      </button>
      {/* Render history list */}
    </div>
  );
}
```

---

### Task 4: Add Export Results Feature

**Problem:** No way to download benchmark results for analysis or sharing.

**Solution:** Add CSV and JSON export buttons to the leaderboard and benchmark results.

**Files to create:**
- `lib/utils/export.ts`

**Files to modify:**
- `app/leaderboard/page.tsx`
- `app/benchmarks/page.tsx`

**Implementation:**

```typescript
// Create lib/utils/export.ts:
export function exportResultsToCSV(results: BenchmarkResult[], filename: string) {
  const headers = ['Rank', 'Model', 'Provider', 'Score', 'Latency (ms)', 'Success Rate'];
  const rows = results.map(r => [
    r.rank,
    r.model,
    r.provider,
    r.score.toFixed(2),
    r.latency,
    `${((r.successCount / r.totalCalls) * 100).toFixed(1)}%`
  ]);

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  downloadFile(csv, `${filename}.csv`, 'text/csv');
}

export function exportResultsToJSON(results: BenchmarkResult[], filename: string) {
  const json = JSON.stringify(results, null, 2);
  downloadFile(json, `${filename}.json`, 'application/json');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
```

```typescript
// Add export buttons to Leaderboard page:
import { exportResultsToCSV, exportResultsToJSON } from '@/lib/utils/export';

<div className="flex gap-2">
  <button
    onClick={() => exportResultsToCSV(results, `benchmark-${Date.now()}`)}
    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
  >
    Export CSV
  </button>
  <button
    onClick={() => exportResultsToJSON(results, `benchmark-${Date.now()}`)}
    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
  >
    Export JSON
  </button>
</div>
```

---

## 🎯 Medium Priority Tasks

### Task 5: Add Model Comparison View

**Problem:** Hard to compare performance between specific models side-by-side.

**Solution:** Add comparison modal allowing users to select 2-3 models and compare their metrics.

**Files to create:**
- `components/ModelComparison.tsx`

**Files to modify:**
- `app/leaderboard/page.tsx`

**Implementation:**

```typescript
// Create components/ModelComparison.tsx:
interface ModelComparisonProps {
  models: BenchmarkResult[];
  onClose: () => void;
}

export function ModelComparison({ models, onClose }: ModelComparisonProps) {
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  const toggleModel = (modelId: string) => {
    if (selectedModels.includes(modelId)) {
      setSelectedModels(prev => prev.filter(id => id !== modelId));
    } else if (selectedModels.length < 3) {
      setSelectedModels(prev => [...prev, modelId]);
    }
  };

  const comparisonData = selectedModels.map(id =>
    models.find(m => m.modelId === id)
  ).filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Compare Models</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {/* Model selection checkboxes */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-2">
          {models.map(model => (
            <label key={model.modelId} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedModels.includes(model.modelId)}
                onChange={() => toggleModel(model.modelId)}
                disabled={!selectedModels.includes(model.modelId) && selectedModels.length >= 3}
              />
              <span>{model.model}</span>
            </label>
          ))}
        </div>

        {/* Comparison table */}
        {comparisonData.length >= 2 && (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Metric</th>
                {comparisonData.map(m => (
                  <th key={m.modelId} className="text-left p-2">{m.model}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-2 font-medium">Score</td>
                {comparisonData.map(m => (
                  <td key={m.modelId} className="p-2">{m.score.toFixed(2)}</td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="p-2 font-medium">Latency</td>
                {comparisonData.map(m => (
                  <td key={m.modelId} className="p-2">{m.latency}ms</td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="p-2 font-medium">Success Rate</td>
                {comparisonData.map(m => (
                  <td key={m.modelId} className="p-2">
                    {((m.successCount / m.totalCalls) * 100).toFixed(1)}%
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

```typescript
// Add "Compare" button to Leaderboard page:
import { ModelComparison } from '@/components/ModelComparison';

const [showComparison, setShowComparison] = useState(false);

<button
  onClick={() => setShowComparison(true)}
  className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
>
  Compare Models
</button>

{showComparison && (
  <ModelComparison
    models={results}
    onClose={() => setShowComparison(false)}
  />
)}
```

---

### Task 6: Add Clear Results Button

**Problem:** No way to reset the leaderboard/benchmark results without page reload.

**Solution:** Add clear button that resets state and clears local storage.

**Files to modify:**
- `app/leaderboard/page.tsx`
- `app/benchmarks/page.tsx`

**Implementation:**

```typescript
// Add to both pages:
function clearResults() {
  if (confirm('Are you sure you want to clear all results?')) {
    setResults([]);
    localStorage.removeItem('benchmark_results');
  }
}

<button
  onClick={clearResults}
  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
>
  Clear Results
</button>
```

---

### Task 7: Improve Error Messages

**Problem:** Generic error messages don't help users understand what went wrong.

**Solution:** Add specific error types and user-friendly messages.

**Files to create:**
- `lib/utils/errors.ts`

**Files to modify:**
- `lib/benchmark/runner.ts`
- `components/ErrorDisplay.tsx`

**Implementation:**

```typescript
// Create lib/utils/errors.ts:
export enum BenchmarkErrorType {
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  INVALID_MODEL = 'invalid_model',
  API_KEY_INVALID = 'api_key_invalid',
  NETWORK_ERROR = 'network_error',
  UNKNOWN = 'unknown'
}

export function getErrorMessage(errorType: BenchmarkErrorType, modelName: string): string {
  switch (errorType) {
    case BenchmarkErrorType.RATE_LIMIT:
      return `Rate limit exceeded for ${modelName}. Please wait before retrying.`;
    case BenchmarkErrorType.TIMEOUT:
      return `${modelName} did not respond in time. The model may be overloaded.`;
    case BenchmarkErrorType.INVALID_MODEL:
      return `Model ${modelName} is not available or does not exist.`;
    case BenchmarkErrorType.API_KEY_INVALID:
      return `API key is invalid. Please check your settings.`;
    case BenchmarkErrorType.NETWORK_ERROR:
      return `Network error. Please check your internet connection.`;
    default:
      return `An error occurred with ${modelName}. Please try again.`;
  }
}

export function classifyError(error: any): BenchmarkErrorType {
  if (error?.status === 429) return BenchmarkErrorType.RATE_LIMIT;
  if (error?.name === 'TimeoutError') return BenchmarkErrorType.TIMEOUT;
  if (error?.status === 401) return BenchmarkErrorType.API_KEY_INVALID;
  if (error?.status === 404) return BenchmarkErrorType.INVALID_MODEL;
  if (error?.code === 'NETWORK_ERROR') return BenchmarkErrorType.NETWORK_ERROR;
  return BenchmarkErrorType.UNKNOWN;
}
```

```typescript
// Use in benchmark runner:
import { classifyError, getErrorMessage } from '@/lib/utils/errors';

try {
  await runBenchmarkForModel(model);
} catch (error) {
  const errorType = classifyError(error);
  const userMessage = getErrorMessage(errorType, model.name);
  // Store error with model result
  modelResult.error = { type: errorType, message: userMessage };
}
```

```typescript
// Display error in UI:
{result.error && (
  <div className="text-red-500 text-sm">
    <span className="font-bold">Error:</span> {result.error.message}
  </div>
)}
```

---

## 🚀 Nice-to-Have Tasks (Future Iterations)

### Task 8: Dark Mode Toggle
- Add theme toggle to Settings
- Use CSS variables or Tailwind dark mode
- Persist preference in localStorage

### Task 9: Benchmark Scheduling
- Add cron-like scheduler UI
- "Run every X hours/days"
- Auto-run and save to history
- Webhook notifications on completion

### Task 10: Cost Tracking
- Track token usage per model
- Calculate cost based on OpenRouter pricing
- Display cost per benchmark
- Set budget limits

---

## 📋 Implementation Order

**Phase 1** (Quick wins, 1-2 hours):
1. ✅ Task 1: Retry Logic
2. ✅ Task 6: Clear Results Button

**Phase 2** (UX improvements, 2-3 hours):
3. ✅ Task 2: API Key Validation
4. ✅ Task 7: Better Error Messages

**Phase 3** (Core features, 3-4 hours):
5. ✅ Task 3: Benchmark History
6. ✅ Task 4: Export Results

**Phase 4** (Advanced features, 2-3 hours):
7. ✅ Task 5: Model Comparison

**Total Estimated Time:** 8-12 hours

---

## 🧪 Testing Checklist

After each task is implemented, verify:

- [ ] Feature works as expected
- [ ] No console errors
- [ ] UI looks correct
- [ ] Mobile responsive (if applicable)
- [ ] Error handling works
- [ ] Local storage persists correctly

---

## 📝 Notes for Claude Code CLI

1. **Check existing file structure first** - paths above are suggestions, actual files may differ
2. **TypeScript types** - ensure all new code is properly typed
3. **UI consistency** - match existing Tailwind classes and design patterns
4. **Error logging** - add console.error for debugging
5. **Accessibility** - use proper button labels and ARIA attributes

---

**End of Plan**
