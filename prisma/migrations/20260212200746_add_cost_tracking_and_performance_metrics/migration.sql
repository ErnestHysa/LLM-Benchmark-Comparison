-- CreateTable
CREATE TABLE "Benchmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "primaryCategory" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "collectionId" TEXT,
    "difficulty" TEXT,
    "estimatedTokens" INTEGER,
    "tags" TEXT,
    "templateId" TEXT,
    CONSTRAINT "Benchmark_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "BenchmarkCollection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Benchmark_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "BenchmarkTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BenchmarkCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CategoryMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "categoryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CategoryMetric_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BenchmarkCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BenchmarkRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "benchmarkId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "timeoutSec" INTEGER,
    "metadata" TEXT,
    "evaluator" TEXT NOT NULL,
    "concurrency" INTEGER NOT NULL DEFAULT 5,
    "progressId" TEXT,
    CONSTRAINT "BenchmarkRun_benchmarkId_fkey" FOREIGN KEY ("benchmarkId") REFERENCES "Benchmark" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModelRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "benchmarkRunId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "output" TEXT NOT NULL DEFAULT '',
    "tokensUsed" INTEGER,
    "cost" REAL,
    CONSTRAINT "ModelRun_benchmarkRunId_fkey" FOREIGN KEY ("benchmarkRunId") REFERENCES "BenchmarkRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelRunId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "metricId" TEXT,
    "value" REAL NOT NULL,
    "aiConfidence" REAL,
    "humanOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Score_modelRunId_fkey" FOREIGN KEY ("modelRunId") REFERENCES "ModelRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Score_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BenchmarkCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Score_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "CategoryMetric" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CategoryScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelRunId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "totalScore" REAL NOT NULL,
    CONSTRAINT "CategoryScore_modelRunId_fkey" FOREIGN KEY ("modelRunId") REFERENCES "ModelRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CategoryScore_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BenchmarkCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetricScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scoreId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "explanation" TEXT,
    CONSTRAINT "MetricScore_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "Score" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MetricScore_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "CategoryMetric" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HumanRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelRunId" TEXT NOT NULL,
    "categoryId" TEXT,
    "rating" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HumanRating_modelRunId_fkey" FOREIGN KEY ("modelRunId") REFERENCES "ModelRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BenchmarkProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "benchmarkRunId" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "totalSteps" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "percentage" REAL NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BenchmarkProgress_benchmarkRunId_fkey" FOREIGN KEY ("benchmarkRunId") REFERENCES "BenchmarkRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BenchmarkLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "benchmarkRunId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BenchmarkLog_benchmarkRunId_fkey" FOREIGN KEY ("benchmarkRunId") REFERENCES "BenchmarkRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "keyValue" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsed" DATETIME
);

-- CreateTable
CREATE TABLE "RegressionBaseline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "benchmarkId" TEXT NOT NULL,
    "modelIds" TEXT NOT NULL,
    "evaluator" TEXT NOT NULL,
    "evaluatorProvider" TEXT NOT NULL,
    "thresholdMin" REAL,
    "thresholdMax" REAL,
    "regressionDelta" REAL,
    "scheduleType" TEXT NOT NULL DEFAULT 'manual',
    "scheduleConfig" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" DATETIME,
    "lastStatus" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RegressionBaseline_benchmarkId_fkey" FOREIGN KEY ("benchmarkId") REFERENCES "Benchmark" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegressionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "baselineId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalScore" REAL,
    "previousScore" REAL,
    "scoreDiff" REAL,
    "isRegression" BOOLEAN NOT NULL DEFAULT false,
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "triggerMetadata" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegressionRun_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "RegressionBaseline" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegressionModelRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "regressionRunId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "totalScore" REAL NOT NULL,
    "previousScore" REAL,
    "scoreDiff" REAL,
    "categoryScores" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegressionModelRun_regressionRunId_fkey" FOREIGN KEY ("regressionRunId") REFERENCES "RegressionRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegressionAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "regressionRunId" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "sentEmail" BOOLEAN NOT NULL DEFAULT false,
    "sentWebhook" BOOLEAN NOT NULL DEFAULT false,
    "sentSlack" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegressionAlert_regressionRunId_fkey" FOREIGN KEY ("regressionRunId") REFERENCES "RegressionRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BenchmarkCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BenchmarkTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "estimatedTokens" INTEGER,
    "tags" TEXT,
    "examples" TEXT,
    "variables" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "collectionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BenchmarkTemplate_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "BenchmarkCollection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BenchmarkBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "benchmarkIds" TEXT NOT NULL,
    "modelIds" TEXT NOT NULL,
    "evaluatorModel" TEXT NOT NULL,
    "evaluatorProvider" TEXT NOT NULL,
    "concurrency" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL,
    "totalRuns" INTEGER NOT NULL DEFAULT 0,
    "completedRuns" INTEGER NOT NULL DEFAULT 0,
    "failedRuns" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BenchmarkBatchRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "benchmarkRunId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "score" REAL,
    "tokensUsed" INTEGER,
    "cost" REAL,
    "duration" INTEGER,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "errorMessage" TEXT,
    CONSTRAINT "BenchmarkBatchRun_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BenchmarkBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BatchRunResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "benchmarkRunId" TEXT NOT NULL,
    "benchmarkId" TEXT NOT NULL,
    "benchmarkName" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "score" REAL,
    "tokensUsed" INTEGER,
    "cost" REAL,
    "duration" INTEGER,
    "errorMessage" TEXT,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "rank" INTEGER,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BatchConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "benchmarkIds" TEXT NOT NULL,
    "modelIds" TEXT NOT NULL,
    "evaluatorModel" TEXT NOT NULL,
    "evaluatorProvider" TEXT NOT NULL,
    "concurrency" INTEGER NOT NULL DEFAULT 5,
    "scheduleConfig" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CostTracking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period" TEXT NOT NULL DEFAULT 'month',
    "totalCost" REAL NOT NULL DEFAULT 0,
    "openaiCost" REAL NOT NULL DEFAULT 0,
    "anthropicCost" REAL NOT NULL DEFAULT 0,
    "openrouterCost" REAL NOT NULL DEFAULT 0,
    "customCost" REAL NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalRuns" INTEGER NOT NULL DEFAULT 0,
    "successfulRuns" INTEGER NOT NULL DEFAULT 0,
    "failedRuns" INTEGER NOT NULL DEFAULT 0,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PerformanceMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "benchmarkRunId" TEXT NOT NULL,
    "totalDuration" INTEGER NOT NULL,
    "avgModelDuration" INTEGER NOT NULL,
    "minModelDuration" INTEGER NOT NULL,
    "maxModelDuration" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT DEFAULT 'default',
    "apiKeys" TEXT NOT NULL,
    "customModels" TEXT NOT NULL,
    "disabledPredefinedModels" TEXT NOT NULL,
    "evaluatorModel" TEXT NOT NULL,
    "evaluatorProvider" TEXT NOT NULL,
    "evaluatorApiKeyId" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "concurrency" INTEGER NOT NULL DEFAULT 5,
    "timeoutEnabled" BOOLEAN NOT NULL DEFAULT true,
    "timeoutSec" INTEGER NOT NULL DEFAULT 600,
    "maxTokens" INTEGER NOT NULL DEFAULT 8192,
    "exportFormat" TEXT NOT NULL DEFAULT 'csv',
    "includeMetrics" BOOLEAN NOT NULL DEFAULT true,
    "includeExplanations" BOOLEAN NOT NULL DEFAULT true,
    "autoSync" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ModelPricing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "inputPrice" REAL NOT NULL,
    "outputPrice" REAL NOT NULL,
    "contextPrice" REAL,
    "maxTokens" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "BenchmarkStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "benchmarkId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "avgScore" REAL NOT NULL,
    "minScore" REAL NOT NULL,
    "maxScore" REAL NOT NULL,
    "runCount" INTEGER NOT NULL,
    "successRate" REAL NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_BenchmarkToBenchmarkCategory" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_BenchmarkToBenchmarkCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "Benchmark" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_BenchmarkToBenchmarkCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "BenchmarkCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Benchmark_collectionId_idx" ON "Benchmark"("collectionId");

-- CreateIndex
CREATE INDEX "Benchmark_isPublic_idx" ON "Benchmark"("isPublic");

-- CreateIndex
CREATE INDEX "Benchmark_isSystem_idx" ON "Benchmark"("isSystem");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkCategory_name_key" ON "BenchmarkCategory"("name");

-- CreateIndex
CREATE INDEX "CategoryMetric_categoryId_idx" ON "CategoryMetric"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryMetric_name_categoryId_key" ON "CategoryMetric"("name", "categoryId");

-- CreateIndex
CREATE INDEX "BenchmarkRun_benchmarkId_idx" ON "BenchmarkRun"("benchmarkId");

-- CreateIndex
CREATE INDEX "BenchmarkRun_status_idx" ON "BenchmarkRun"("status");

-- CreateIndex
CREATE INDEX "BenchmarkRun_startedAt_idx" ON "BenchmarkRun"("startedAt");

-- CreateIndex
CREATE INDEX "ModelRun_benchmarkRunId_modelId_idx" ON "ModelRun"("benchmarkRunId", "modelId");

-- CreateIndex
CREATE INDEX "ModelRun_status_idx" ON "ModelRun"("status");

-- CreateIndex
CREATE INDEX "Score_modelRunId_categoryId_idx" ON "Score"("modelRunId", "categoryId");

-- CreateIndex
CREATE INDEX "Score_metricId_idx" ON "Score"("metricId");

-- CreateIndex
CREATE INDEX "CategoryScore_modelRunId_idx" ON "CategoryScore"("modelRunId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryScore_modelRunId_categoryId_key" ON "CategoryScore"("modelRunId", "categoryId");

-- CreateIndex
CREATE INDEX "MetricScore_scoreId_idx" ON "MetricScore"("scoreId");

-- CreateIndex
CREATE INDEX "MetricScore_metricId_idx" ON "MetricScore"("metricId");

-- CreateIndex
CREATE UNIQUE INDEX "MetricScore_scoreId_metricId_key" ON "MetricScore"("scoreId", "metricId");

-- CreateIndex
CREATE INDEX "HumanRating_modelRunId_idx" ON "HumanRating"("modelRunId");

-- CreateIndex
CREATE INDEX "BenchmarkProgress_benchmarkRunId_idx" ON "BenchmarkProgress"("benchmarkRunId");

-- CreateIndex
CREATE INDEX "BenchmarkProgress_createdAt_idx" ON "BenchmarkProgress"("createdAt");

-- CreateIndex
CREATE INDEX "BenchmarkLog_benchmarkRunId_idx" ON "BenchmarkLog"("benchmarkRunId");

-- CreateIndex
CREATE INDEX "BenchmarkLog_timestamp_idx" ON "BenchmarkLog"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Model_name_key" ON "Model"("name");

-- CreateIndex
CREATE INDEX "Model_provider_idx" ON "Model"("provider");

-- CreateIndex
CREATE INDEX "Model_isActive_idx" ON "Model"("isActive");

-- CreateIndex
CREATE INDEX "ApiKey_provider_idx" ON "ApiKey"("provider");

-- CreateIndex
CREATE INDEX "ApiKey_isActive_idx" ON "ApiKey"("isActive");

-- CreateIndex
CREATE INDEX "RegressionBaseline_benchmarkId_idx" ON "RegressionBaseline"("benchmarkId");

-- CreateIndex
CREATE INDEX "RegressionBaseline_isActive_idx" ON "RegressionBaseline"("isActive");

-- CreateIndex
CREATE INDEX "RegressionBaseline_scheduleType_idx" ON "RegressionBaseline"("scheduleType");

-- CreateIndex
CREATE INDEX "RegressionRun_baselineId_idx" ON "RegressionRun"("baselineId");

-- CreateIndex
CREATE INDEX "RegressionRun_status_idx" ON "RegressionRun"("status");

-- CreateIndex
CREATE INDEX "RegressionRun_startedAt_idx" ON "RegressionRun"("startedAt");

-- CreateIndex
CREATE INDEX "RegressionRun_isRegression_idx" ON "RegressionRun"("isRegression");

-- CreateIndex
CREATE INDEX "RegressionModelRun_regressionRunId_idx" ON "RegressionModelRun"("regressionRunId");

-- CreateIndex
CREATE INDEX "RegressionModelRun_modelId_idx" ON "RegressionModelRun"("modelId");

-- CreateIndex
CREATE INDEX "RegressionAlert_regressionRunId_idx" ON "RegressionAlert"("regressionRunId");

-- CreateIndex
CREATE INDEX "RegressionAlert_baselineId_idx" ON "RegressionAlert"("baselineId");

-- CreateIndex
CREATE INDEX "RegressionAlert_acknowledged_idx" ON "RegressionAlert"("acknowledged");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkCollection_name_key" ON "BenchmarkCollection"("name");

-- CreateIndex
CREATE INDEX "BenchmarkCollection_createdAt_idx" ON "BenchmarkCollection"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkTemplate_name_key" ON "BenchmarkTemplate"("name");

-- CreateIndex
CREATE INDEX "BenchmarkTemplate_category_idx" ON "BenchmarkTemplate"("category");

-- CreateIndex
CREATE INDEX "BenchmarkTemplate_isActive_idx" ON "BenchmarkTemplate"("isActive");

-- CreateIndex
CREATE INDEX "BenchmarkTemplate_isSystem_idx" ON "BenchmarkTemplate"("isSystem");

-- CreateIndex
CREATE INDEX "BenchmarkTemplate_collectionId_idx" ON "BenchmarkTemplate"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkBatch_name_key" ON "BenchmarkBatch"("name");

-- CreateIndex
CREATE INDEX "BenchmarkBatch_createdAt_idx" ON "BenchmarkBatch"("createdAt");

-- CreateIndex
CREATE INDEX "BenchmarkBatch_status_idx" ON "BenchmarkBatch"("status");

-- CreateIndex
CREATE INDEX "BenchmarkBatchRun_batchId_idx" ON "BenchmarkBatchRun"("batchId");

-- CreateIndex
CREATE INDEX "BenchmarkBatchRun_status_idx" ON "BenchmarkBatchRun"("status");

-- CreateIndex
CREATE INDEX "BenchmarkBatchRun_benchmarkRunId_idx" ON "BenchmarkBatchRun"("benchmarkRunId");

-- CreateIndex
CREATE INDEX "BatchRunResult_benchmarkRunId_modelId_idx" ON "BatchRunResult"("benchmarkRunId", "modelId");

-- CreateIndex
CREATE INDEX "BatchRunResult_status_rank_idx" ON "BatchRunResult"("status", "rank");

-- CreateIndex
CREATE INDEX "BatchConfig_createdAt_idx" ON "BatchConfig"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BatchConfig_name_key" ON "BatchConfig"("name");

-- CreateIndex
CREATE INDEX "CostTracking_periodStart_idx" ON "CostTracking"("periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "CostTracking_period_periodStart_key" ON "CostTracking"("period", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceMetric_benchmarkRunId_key" ON "PerformanceMetric"("benchmarkRunId");

-- CreateIndex
CREATE INDEX "PerformanceMetric_benchmarkRunId_idx" ON "PerformanceMetric"("benchmarkRunId");

-- CreateIndex
CREATE INDEX "UserSettings_userId_idx" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "ModelPricing_provider_idx" ON "ModelPricing"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "ModelPricing_provider_modelId_key" ON "ModelPricing"("provider", "modelId");

-- CreateIndex
CREATE INDEX "BenchmarkStats_benchmarkId_idx" ON "BenchmarkStats"("benchmarkId");

-- CreateIndex
CREATE INDEX "BenchmarkStats_modelId_idx" ON "BenchmarkStats"("modelId");

-- CreateIndex
CREATE INDEX "BenchmarkStats_periodStart_idx" ON "BenchmarkStats"("periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkStats_benchmarkId_modelId_period_periodStart_key" ON "BenchmarkStats"("benchmarkId", "modelId", "period", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "_BenchmarkToBenchmarkCategory_AB_unique" ON "_BenchmarkToBenchmarkCategory"("A", "B");

-- CreateIndex
CREATE INDEX "_BenchmarkToBenchmarkCategory_B_index" ON "_BenchmarkToBenchmarkCategory"("B");
