/**
 * ABComparisonTool Component
 *
 * Client component for A/B model comparison
 * Loads models from SettingsManager (localStorage)
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Scale,
  Swords,
  Eye,
  Trophy,
  Play,
  RefreshCw,
  Minus,
  X,
  Sparkles,
  Zap,
  Target,
  Layers,
  Crown,
  Loader2,
  XCircle,
} from "lucide-react";
import { SettingsManager, decodeApiKey } from "@/lib/settings";
import { cn } from "@/lib/utils";

interface ModelInfo {
  providerId: string;
  name: string;
  provider: string;
}

// interface ABComparisonToolProps {
//   No props - models are loaded from SettingsManager
// }

type ComparisonMode = "battle" | "blind" | "diff" | "tournament";

interface TournamentMatch {
  id: string;
  round: number;
  modelA: string;
  modelB: string;
  winner: string | null;
  scores?: { modelA: number; modelB: number };
}

interface TournamentBracket {
  rounds: TournamentMatch[][];
  champion: string | null;
}

// Mode configuration with icons and colors
const modeConfig = {
  battle: {
    icon: Swords,
    label: "Battle Mode",
    description: "Head-to-head with AI scoring",
    color: "from-red-500/20 to-orange-500/5",
    borderColor: "border-red-500/30",
    iconColor: "text-red-500",
    badgeColor: "bg-red-500/10 text-red-500 border-red-500/20",
  },
  blind: {
    icon: Eye,
    label: "Blind Test",
    description: "Compare without bias",
    color: "from-blue-500/20 to-cyan-500/5",
    borderColor: "border-blue-500/30",
    iconColor: "text-blue-500",
    badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  diff: {
    icon: Layers,
    label: "Diff Viewer",
    description: "Word-by-word analysis",
    color: "from-emerald-500/20 to-teal-500/5",
    borderColor: "border-emerald-500/30",
    iconColor: "text-emerald-500",
    badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
  tournament: {
    icon: Trophy,
    label: "Tournament",
    description: "Bracket competition",
    color: "from-amber-500/20 to-yellow-500/5",
    borderColor: "border-amber-500/30",
    iconColor: "text-amber-500",
    badgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
};

// Skeleton loader component
function ComparisonSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex gap-4">
        <div className="flex-1 h-48 bg-muted/30 rounded-xl border border-border/50" />
        <div className="flex-1 h-48 bg-muted/30 rounded-xl border border-border/50" />
      </div>
      <div className="h-32 bg-muted/30 rounded-xl border border-border/50" />
    </div>
  );
}

// Loading spinner component
function LoadingSpinner({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
        <Loader2 className="relative h-12 w-12 text-primary animate-spin" />
      </div>
      <p className="text-sm text-muted-foreground font-medium">{text}</p>
    </div>
  );
}

// Error alert component
function ErrorAlert({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-error/5 border border-error/20 rounded-xl animate-fade-in">
      <div className="p-1.5 rounded-lg bg-error/10">
        <XCircle className="h-4 w-4 text-error" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-error">Error</p>
        <p className="text-sm text-muted-foreground mt-0.5">{error}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDismiss}
        className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Model selector component with enhanced styling
function ModelSelector({
  label,
  value,
  onChange,
  models,
  excludeModel,
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  models: ModelInfo[];
  excludeModel?: string;
  placeholder: string;
  icon?: React.ReactNode;
}) {
  const availableModels = excludeModel
    ? models.filter((m) => m.providerId !== excludeModel)
    : models;

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground flex items-center gap-2">
        {icon}
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 bg-background/50 border-border/50 hover:border-border focus:border-primary transition-colors">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="border-border/50 bg-surface/95 backdrop-blur-xl">
          <SelectItem value="">None</SelectItem>
          {availableModels.map((model) => (
            <SelectItem key={model.providerId} value={model.providerId}>
              <div className="flex items-center gap-2">
                <span className="truncate max-w-[200px]">{model.name}</span>
                <Badge variant="outline" className="text-xs ml-auto">
                  {model.provider}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Tournament model selector
function TournamentModelSelector({
  models,
  selected,
  onToggle,
  maxDisplay = 16,
}: {
  models: ModelInfo[];
  selected: string[];
  onToggle: (id: string) => void;
  maxDisplay?: number;
}) {
  const displayModels = models.slice(0, maxDisplay);

  return (
    <ScrollArea className="h-48">
      <div className="grid grid-cols-2 gap-2 pr-4">
        {displayModels.map((model) => {
          const isSelected = selected.includes(model.providerId);
          return (
            <label
              key={model.providerId}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200",
                "hover:scale-[1.02] active:scale-[0.98]",
                isSelected
                  ? "bg-primary/10 border-primary/30 shadow-lg shadow-primary/5"
                  : "bg-background/30 border-border/50 hover:border-border hover:bg-background/50"
              )}
            >
              <Checkbox
                checked={isSelected}
                onChange={() => onToggle(model.providerId)}
                className="border-primary/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-sm truncate flex-1">{model.name}</span>
            </label>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// Battle score card component
function BattleScoreCard({
  results,
  modelA,
  modelB,
  getModelName,
}: {
  results: any;
  modelA: string;
  modelB: string;
  getModelName: (id: string) => string;
}) {
  const { battleScore } = results;
  const isWinnerA = battleScore.winner === "Model A";
  const winnerModel = isWinnerA ? modelA : modelB;
  const winnerName = getModelName(winnerModel);

  return (
    <Card
      className={cn(
        "border-2 overflow-hidden animate-fade-in-up",
        isWinnerA ? "border-blue-500/50" : "border-green-500/50"
      )}
    >
      <div
        className={cn(
          "px-6 py-4 bg-gradient-to-r",
          isWinnerA
            ? "from-blue-500/10 to-blue-500/5 border-b border-blue-500/20"
            : "from-green-500/10 to-green-500/5 border-b border-green-500/20"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-lg",
                isWinnerA ? "bg-blue-500/20" : "bg-green-500/20"
              )}
            >
              <Crown className={cn("h-5 w-5", isWinnerA ? "text-blue-500" : "text-green-500")} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Battle Results</h3>
              <p className="text-sm text-muted-foreground">
                Winner determined by AI evaluation
              </p>
            </div>
          </div>
          <Badge
            className={cn(
              "px-4 py-1.5 text-sm font-medium",
              isWinnerA
                ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                : "bg-green-500 text-white shadow-lg shadow-green-500/20"
            )}
          >
            {winnerName} wins by {battleScore.margin.toFixed(1)} pts
          </Badge>
        </div>
      </div>

      <CardContent className="p-6">
        {/* Score comparison */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Model A Score */}
          <div
            className={cn(
              "relative p-6 rounded-2xl border transition-all duration-300",
              isWinnerA
                ? "bg-blue-500/10 border-blue-500/30 shadow-lg shadow-blue-500/5 scale-[1.02]"
                : "bg-muted/30 border-border/50"
            )}
          >
            {isWinnerA && (
              <div className="absolute -top-2 -right-2 p-1.5 bg-blue-500 rounded-full">
                <Crown className="h-3 w-3 text-white" />
              </div>
            )}
            <p className="text-sm text-muted-foreground mb-3">{getModelName(modelA)}</p>
            <p
              className={cn(
                "text-5xl font-bold tracking-tight",
                isWinnerA ? "text-blue-500" : "text-muted-foreground"
              )}
            >
              {battleScore.scores.modelA.toFixed(0)}
            </p>
            <div className="mt-4">
              <Progress
                value={battleScore.scores.modelA}
                className="h-2"
              />
            </div>
          </div>

          {/* Model B Score */}
          <div
            className={cn(
              "relative p-6 rounded-2xl border transition-all duration-300",
              !isWinnerA
                ? "bg-green-500/10 border-green-500/30 shadow-lg shadow-green-500/5 scale-[1.02]"
                : "bg-muted/30 border-border/50"
            )}
          >
            {!isWinnerA && (
              <div className="absolute -top-2 -right-2 p-1.5 bg-green-500 rounded-full">
                <Crown className="h-3 w-3 text-white" />
              </div>
            )}
            <p className="text-sm text-muted-foreground mb-3">{getModelName(modelB)}</p>
            <p
              className={cn(
                "text-5xl font-bold tracking-tight",
                !isWinnerA ? "text-green-500" : "text-muted-foreground"
              )}
            >
              {battleScore.scores.modelB.toFixed(0)}
            </p>
            <div className="mt-4">
              <Progress
                value={battleScore.scores.modelB}
                className="h-2"
              />
            </div>
          </div>
        </div>

        {/* Criteria breakdown */}
        <div className="border-t border-border/50 pt-6">
          <p className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Criteria Breakdown
          </p>
          <div className="grid grid-cols-4 gap-4">
            {[
              { key: "accuracy", label: "Accuracy", icon: "bullseye" },
              { key: "completeness", label: "Completeness", icon: "check" },
              { key: "clarity", label: "Clarity", icon: "sparkles" },
              { key: "creativity", label: "Creativity", icon: "lightbulb" },
            ].map((criterion) => (
              <div
                key={criterion.key}
                className="p-4 rounded-xl bg-background/30 border border-border/50 text-center"
              >
                <p className="text-xs text-muted-foreground mb-1">{criterion.label}</p>
                <p className="text-2xl font-bold text-foreground">
                  {battleScore.criteria[criterion.key].toFixed(0)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Response comparison card
function ResponseComparisonCard({
  title,
  output,
  isSelected,
  onClick,
  winnerIndicator,
}: {
  title: string;
  output: string;
  isSelected?: boolean;
  onClick?: () => void;
  winnerIndicator?: "A" | "B" | "tie";
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-200",
        onClick && "cursor-pointer hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        winnerIndicator === "A" && "border-l-4 border-l-blue-500",
        winnerIndicator === "B" && "border-l-4 border-l-green-500"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          {winnerIndicator && (
            <Badge
              className={cn(
                "text-xs",
                winnerIndicator === "A"
                  ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                  : winnerIndicator === "B"
                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                    : "bg-muted"
              )}
            >
              {winnerIndicator === "tie" ? "Tie" : `Winner ${winnerIndicator}`}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-80">
          <pre className="p-4 text-sm bg-muted/30 font-mono whitespace-pre-wrap break-words">
            {output || "No response"}
          </pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Tournament bracket component
function TournamentBracket({
  tournament,
  getModelName,
}: {
  tournament: TournamentBracket;
  getModelName: (id: string) => string;
}) {
  return (
    <Card className="border-2 border-amber-500/20 overflow-hidden animate-fade-in-up">
      <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 to-yellow-500/5 border-b border-amber-500/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20">
            <Trophy className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <CardTitle className="text-lg">Tournament Results</CardTitle>
            <p className="text-sm text-muted-foreground">
              {tournament.rounds.length} rounds completed
            </p>
          </div>
        </div>
      </div>

      <CardContent className="p-6 space-y-6">
        {/* Champion banner */}
        {tournament.champion && (
          <div className="relative p-8 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border border-amber-500/30 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-yellow-500/5 animate-pulse" />
            <div className="relative flex flex-col items-center text-center">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 shadow-xl shadow-amber-500/20 mb-4">
                <Trophy className="h-10 w-10 text-white" />
              </div>
              <p className="text-sm text-amber-500/80 font-medium uppercase tracking-wider">
                Champion
              </p>
              <p className="text-2xl font-bold text-amber-500 mt-1">
                {getModelName(tournament.champion)}
              </p>
            </div>
          </div>
        )}

        {/* Rounds */}
        <div className="space-y-6">
          {tournament.rounds.map((round, roundIndex) => (
            <div key={roundIndex} className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                  Round {roundIndex + 1}
                </Badge>
                <div className="flex-1 h-px bg-border/50" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {round.map((match) => {
                  const isWinnerA = match.winner === match.modelA;
                  return (
                    <div
                      key={match.id}
                      className={cn(
                        "p-4 rounded-xl border transition-all duration-200",
                        isWinnerA
                          ? "bg-blue-500/5 border-blue-500/20 hover:border-blue-500/40"
                          : "bg-green-500/5 border-green-500/20 hover:border-green-500/40"
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span
                            className={cn(
                              "font-medium text-sm truncate",
                              isWinnerA ? "text-blue-400" : "text-muted-foreground"
                            )}
                          >
                            {getModelName(match.modelA)}
                          </span>
                          <span className="text-xs text-muted-foreground">vs</span>
                          <span
                            className={cn(
                              "font-medium text-sm truncate",
                              !isWinnerA ? "text-green-400" : "text-muted-foreground"
                            )}
                          >
                            {getModelName(match.modelB)}
                          </span>
                        </div>
                      </div>

                      {match.scores && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-sm">
                            <span
                              className={cn(
                                "font-semibold",
                                isWinnerA
                                  ? "text-blue-400"
                                  : "text-muted-foreground"
                              )}
                            >
                              {match.scores.modelA.toFixed(0)}
                            </span>
                            <span className="text-muted-foreground">:</span>
                            <span
                              className={cn(
                                "font-semibold",
                                !isWinnerA
                                  ? "text-green-400"
                                  : "text-muted-foreground"
                              )}
                            >
                              {match.scores.modelB.toFixed(0)}
                            </span>
                          </div>
                          <Badge
                            className={cn(
                              "text-xs",
                              isWinnerA
                                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                : "bg-green-500/20 text-green-400 border-green-500/30"
                            )}
                          >
                            <Crown className="h-3 w-3 mr-1" />
                            {getModelName(match.winner || "")}
                          </Badge>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Blind test voting card
function BlindTestVotingCard({
  responseA,
  responseB,
  onVote,
}: {
  responseA: string;
  responseB: string;
  onVote: (vote: "A" | "B" | "tie") => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-r from-blue-500/5 to-cyan-500/5">
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          Which response is better?
        </CardTitle>
        <p className="text-sm text-muted-foreground text-center mt-1">
          Vote based on quality alone - models are hidden
        </p>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ResponseComparisonCard
            title="Response A"
            output={responseA}
            onClick={() => onVote("A")}
          />
          <ResponseComparisonCard
            title="Response B"
            output={responseB}
            onClick={() => onVote("B")}
          />
        </div>

        <div className="flex justify-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => onVote("tie")}
            className="gap-2 border-dashed"
          >
            <Minus className="h-4 w-4" />
            Too Close to Call
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Blind test reveal card
function BlindTestRevealCard({
  winner,
  modelA,
  modelB,
  getModelName,
  onReset,
}: {
  winner: "A" | "B" | "tie";
  modelA: string;
  modelB: string;
  getModelName: (id: string) => string;
  onReset: () => void;
}) {
  return (
    <Card className="border-2 border-primary/30 overflow-hidden animate-fade-in-up">
      <div className="px-6 py-4 bg-gradient-to-r from-primary/10 to-violet-500/5 border-b border-primary/20">
        <div className="flex items-center justify-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Eye className="h-5 w-5 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Your Vote</p>
            <p className="text-xl font-bold text-primary">
              {winner === "A" ? "Response A" : winner === "B" ? "Response B" : "Tie"}
            </p>
          </div>
        </div>
      </div>

      <CardContent className="p-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div
            className={cn(
              "p-6 rounded-2xl border text-center transition-all duration-300",
              winner === "A"
                ? "bg-blue-500/10 border-blue-500/30 scale-[1.02]"
                : "bg-muted/20 border-border/50"
            )}
          >
            <p className="text-sm text-muted-foreground mb-2">Response A was:</p>
            <p className="font-semibold text-foreground text-lg">
              {getModelName(modelA)}
            </p>
            {winner === "A" && (
              <Badge className="mt-3 bg-blue-500 text-white">
                <Crown className="h-3 w-3 mr-1" />
                Your Choice
              </Badge>
            )}
          </div>

          <div
            className={cn(
              "p-6 rounded-2xl border text-center transition-all duration-300",
              winner === "B"
                ? "bg-green-500/10 border-green-500/30 scale-[1.02]"
                : "bg-muted/20 border-border/50"
            )}
          >
            <p className="text-sm text-muted-foreground mb-2">Response B was:</p>
            <p className="font-semibold text-foreground text-lg">
              {getModelName(modelB)}
            </p>
            {winner === "B" && (
              <Badge className="mt-3 bg-green-500 text-white">
                <Crown className="h-3 w-3 mr-1" />
                Your Choice
              </Badge>
            )}
          </div>
        </div>

        <Button onClick={onReset} className="w-full" size="lg">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Another Comparison
        </Button>
      </CardContent>
    </Card>
  );
}

// Diff results component
function DiffResults({
  results,
}: {
  results: { diff: Array<{ type: string; value: string }>; similarity: number };
}) {
  const getDiffClass = (type: string) => {
    switch (type) {
      case "addition":
        return "bg-emerald-500/20 text-emerald-300 px-1 rounded";
      case "deletion":
        return "bg-red-500/20 text-red-300 line-through px-1 rounded";
      case "change":
        return "bg-amber-500/20 text-amber-300 px-1 rounded";
      default:
        return "";
    }
  };

  return (
    <Card className="overflow-hidden animate-fade-in-up">
      <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Layers className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Diff Results</CardTitle>
              <p className="text-sm text-muted-foreground">
                Word-by-word comparison
              </p>
            </div>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            Similarity: {results.similarity.toFixed(1)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-96">
          <div className="p-4">
            <div className="font-mono text-sm bg-muted/30 p-4 rounded-xl whitespace-pre-wrap break-words">
              {results.diff.map((diff: any, i: number) => (
                <span key={i} className={getDiffClass(diff.type)}>
                  {diff.value}
                </span>
              ))}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Input section component (shared across modes)
function ComparisonInputSection({
  mode,
  prompt,
  setPrompt,
  modelA,
  setModelA,
  modelB,
  setModelB,
  models,
  running,
  onRun,
  error,
  onDismissError,
  buttonText,
  runningText,
}: {
  mode: ComparisonMode;
  prompt: string;
  setPrompt: (val: string) => void;
  modelA: string;
  setModelA: (val: string) => void;
  modelB: string;
  setModelB: (val: string) => void;
  models: ModelInfo[];
  running: boolean;
  onRun: () => void;
  error: string | null;
  onDismissError: () => void;
  buttonText: string;
  runningText: string;
}) {
  const config = modeConfig[mode];
  const ModeIcon = config.icon;

  return (
    <Card
      className={cn(
        "overflow-hidden",
        config.borderColor,
        "border-2"
      )}
    >
      <CardHeader
        className={cn(
          "pb-4 bg-gradient-to-r",
          config.color,
          "border-b border-border/50"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg bg-background/50", config.badgeColor)}>
            <ModeIcon className={cn("h-5 w-5", config.iconColor)} />
          </div>
          <div>
            <CardTitle className="text-lg">{config.label}</CardTitle>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-5">
        {/* Model selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ModelSelector
            label="Model A"
            value={modelA}
            onChange={setModelA}
            models={models}
            excludeModel={modelB}
            placeholder="Select first model..."
            icon={<div className="h-2 w-2 rounded-full bg-blue-500" />}
          />
          <ModelSelector
            label="Model B"
            value={modelB}
            onChange={setModelB}
            models={models}
            excludeModel={modelA}
            placeholder="Select second model..."
            icon={<div className="h-2 w-2 rounded-full bg-green-500" />}
          />
        </div>

        {/* Prompt input */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Test Prompt
          </Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="Enter your test prompt here..."
            className="resize-none font-mono text-sm bg-background/50 border-border/50 focus:border-primary transition-colors"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{prompt.length} characters</span>
            <span>~{Math.ceil(prompt.length / 4)} tokens</span>
          </div>
        </div>

        {/* Error alert */}
        {error && <ErrorAlert error={error} onDismiss={onDismissError} />}

        {/* Run button */}
        <Button
          onClick={onRun}
          disabled={running || !modelA || !modelB || !prompt.trim()}
          className="w-full h-12 text-base font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200"
          size="lg"
        >
          {running ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {runningText}
            </>
          ) : (
            <>
              <Play className="h-5 w-5 mr-2" />
              {buttonText}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// Sidebar info component
function ComparisonSidebar() {
  return (
    <div className="space-y-4 sticky top-24">
      <Card className="overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-primary/10 to-violet-500/5 border-b border-primary/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg">Comparison Modes</CardTitle>
          </div>
        </div>
        <CardContent className="p-4 space-y-3">
          {Object.entries(modeConfig).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <div
                key={key}
                className="flex items-start gap-3 p-3 rounded-xl bg-background/30 border border-border/50 hover:border-border/50 hover:bg-background/50 transition-colors"
              >
                <div className={cn("p-2 rounded-lg", config.badgeColor)}>
                  <Icon className={cn("h-4 w-4", config.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {config.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {config.description}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-primary/5 to-violet-500/5 border-primary/10">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Pro Tip</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use Blind Test mode for unbiased comparisons when choosing between models for production use.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Main component
export function ABComparisonTool() {
  const [mode, setMode] = useState<ComparisonMode>("battle");
  const [prompt, setPrompt] = useState("Write a function to validate email addresses in JavaScript.");
  const [modelA, setModelA] = useState("");
  const [modelB, setModelB] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [winner, setWinner] = useState<"A" | "B" | "tie" | null>(null);
  const [blindReveal, setBlindReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load models from SettingsManager
  const [models, setModels] = useState<ModelInfo[]>([]);

  // Tournament state
  const [selectedTournamentModels, setSelectedTournamentModels] = useState<string[]>([]);
  const [tournament, setTournament] = useState<TournamentBracket | null>(null);
  const [tournamentRunning, setTournamentRunning] = useState(false);

  // Load models on mount
  useEffect(() => {
    const allModels = SettingsManager.getAllModels();
    const enabledModels = allModels
      .filter((m) => m.isEnabled)
      .map((m) => {
        const providerId = m.isCustom ? m.name : m.id;
        return {
          providerId,
          name: m.isCustom ? (m as any).displayName || m.name : m.name,
          provider: m.provider,
        };
      });
    setModels(enabledModels);
  }, []);

  // Helper to get model display name
  const getModelName = (providerId: string): string => {
    const model = models.find((m) => m.providerId === providerId);
    return model?.name || providerId;
  };

  // Clear error when mode or inputs change
  useEffect(() => {
    setError(null);
  }, [mode, modelA, modelB, prompt]);

  const runComparison = async () => {
    if (!modelA || !modelB) {
      setError("Please select two models to compare");
      return;
    }

    if (!prompt.trim()) {
      setError("Please enter a prompt to compare");
      return;
    }

    setRunning(true);
    setResults(null);
    setWinner(null);
    setBlindReveal(false);
    setError(null);

    // Prepare API keys
    const apiKeys = SettingsManager.getApiKeys();
    const apiKeysMap: Record<string, string> = {};
    for (const apiKey of apiKeys) {
      if (apiKey.isActive) {
        const decoded = decodeApiKey(apiKey.key);
        apiKeysMap[apiKey.provider.toLowerCase()] = decoded;
      }
    }

    // Get maxTokens from preferences
    const preferences = SettingsManager.getPreferences();
    const maxTokens = preferences.maxTokens || 8192;

    try {
      const response = await fetch("/api/compare/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, modelA, modelB, apiKeys: apiKeysMap, maxTokens }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data);

        // Show warning if one model failed
        if (data.partialFailure) {
          if (data.responseA?.error && !data.responseB?.error) {
            setError(`Warning: Model A failed but Model B succeeded. Error: ${data.responseA.error}`);
          } else if (data.responseB?.error && !data.responseA?.error) {
            setError(`Warning: Model B failed but Model A succeeded. Error: ${data.responseB.error}`);
          }
        }
      } else if (response.status === 401) {
        const errorData = await response.json();
        setError(errorData.error?.message || "Authentication required. Please check your API keys in Settings.");
      } else if (response.status === 500) {
        const errorData = await response.json();
        const details = errorData.error?.details;
        if (details?.type === "missing_api_key" || details?.message?.includes("API key")) {
          setError(`API key required for this model. Please add your API key in Settings.`);
        } else if (errorData.error?.code === "BOTH_MODELS_FAILED") {
          setError(`Both models failed. Model A: ${details.modelAError || "Unknown error"}, Model B: ${details.modelBError || "Unknown error"}`);
        } else {
          setError(errorData.error?.message || "Failed to run comparison");
        }
      } else {
        setError("Failed to run comparison. Please try again.");
      }
    } catch (err) {
      console.error("Comparison error:", err);
      setError("Failed to run comparison. Please try again.");
    } finally {
      setRunning(false);
    }
  };

  const handleVote = (vote: "A" | "B" | "tie") => {
    setWinner(vote);
    if (mode === "blind") {
      setBlindReveal(true);
    }
  };

  const toggleTournamentModel = (modelId: string) => {
    setSelectedTournamentModels((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId]
    );
  };

  const runTournament = async () => {
    if (selectedTournamentModels.length < 2) {
      setError("Please select at least 2 models for the tournament");
      return;
    }

    setTournamentRunning(true);
    setTournament(null);
    setError(null);

    try {
      const participants = [...selectedTournamentModels];
      const rounds: TournamentMatch[][] = [];
      let currentRound = 0;

      // Run tournament rounds
      while (participants.length > 1) {
        const roundMatches: TournamentMatch[] = [];
        const nextRoundParticipants: string[] = [];

        // Create pairings for this round
        for (let i = 0; i < participants.length; i += 2) {
          const modelA = participants[i];
          const modelB = participants[i + 1];

          if (!modelA || !modelB) {
            if (modelA) nextRoundParticipants.push(modelA);
            continue;
          }

          // Prepare API keys
          const apiKeys = SettingsManager.getApiKeys();
          const apiKeysMap: Record<string, string> = {};
          for (const apiKey of apiKeys) {
            if (apiKey.isActive) {
              const decoded = decodeApiKey(apiKey.key);
              apiKeysMap[apiKey.provider.toLowerCase()] = decoded;
            }
          }

          // Get maxTokens from preferences
          const preferences = SettingsManager.getPreferences();
          const maxTokens = preferences.maxTokens || 8192;

          // Run comparison
          const response = await fetch("/api/compare/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, modelA, modelB, apiKeys: apiKeysMap, maxTokens }),
          });

          if (response.ok) {
            const data = await response.json();
            const matchWinner = data.battleScore?.winner === "Model A" ? modelA : modelB;

            roundMatches.push({
              id: `${currentRound}-${i}`,
              round: currentRound,
              modelA,
              modelB,
              winner: matchWinner,
              scores: data.battleScore?.scores,
            });

            nextRoundParticipants.push(matchWinner);
          } else {
            const fallbackWinner = Math.random() > 0.5 ? modelA : modelB;
            roundMatches.push({
              id: `${currentRound}-${i}`,
              round: currentRound,
              modelA,
              modelB,
              winner: fallbackWinner,
            });
            nextRoundParticipants.push(fallbackWinner);
          }
        }

        rounds.push(roundMatches);
        currentRound++;
        participants.length = 0;
        participants.push(...nextRoundParticipants);
      }

      const champion = participants[0] || null;

      setTournament({
        rounds,
        champion,
      });
    } catch (error) {
      console.error("Tournament error:", error);
      setError("Failed to run tournament");
    } finally {
      setTournamentRunning(false);
    }
  };

  const resetTournament = () => {
    setTournament(null);
    setSelectedTournamentModels([]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Main Content */}
      <div className="lg:col-span-3 space-y-6">
        {/* Mode Tabs */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as ComparisonMode)}>
          <TabsList className="bg-surface/50 border border-border/50 p-1.5 h-auto">
            {Object.entries(modeConfig).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Icon className={cn("h-4 w-4", mode === key ? config.iconColor : "")} />
                  {config.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Battle Mode */}
          <TabsContent value="battle" className="space-y-6 mt-6 animate-fade-in">
            <ComparisonInputSection
              mode="battle"
              prompt={prompt}
              setPrompt={setPrompt}
              modelA={modelA}
              setModelA={setModelA}
              modelB={modelB}
              setModelB={setModelB}
              models={models}
              running={running}
              onRun={runComparison}
              error={error}
              onDismissError={() => setError(null)}
              buttonText="Run Battle"
              runningText="Running Battle..."
            />

            {running && <ComparisonSkeleton />}

            {results && results.battleScore && !running && (
              <>
                <BattleScoreCard
                  results={results}
                  modelA={modelA}
                  modelB={modelB}
                  getModelName={getModelName}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ResponseComparisonCard
                    title={getModelName(modelA)}
                    output={results.responseA?.output || "No response"}
                    winnerIndicator={
                      results.battleScore.winner === "Model A" ? "A" : undefined
                    }
                  />
                  <ResponseComparisonCard
                    title={getModelName(modelB)}
                    output={results.responseB?.output || "No response"}
                    winnerIndicator={
                      results.battleScore.winner === "Model B" ? "B" : undefined
                    }
                  />
                </div>
              </>
            )}
          </TabsContent>

          {/* Blind Test */}
          <TabsContent value="blind" className="space-y-6 mt-6 animate-fade-in">
            <ComparisonInputSection
              mode="blind"
              prompt={prompt}
              setPrompt={setPrompt}
              modelA={modelA}
              setModelA={setModelA}
              modelB={modelB}
              setModelB={setModelB}
              models={models}
              running={running}
              onRun={runComparison}
              error={error}
              onDismissError={() => setError(null)}
              buttonText="Start Blind Test"
              runningText="Running Blind Test..."
            />

            {running && <ComparisonSkeleton />}

            {results && !blindReveal && !running && (
              <BlindTestVotingCard
                responseA={results.responseA?.output || "No response"}
                responseB={results.responseB?.output || "No response"}
                onVote={handleVote}
              />
            )}

            {results && blindReveal && !running && (
              <BlindTestRevealCard
                winner={winner!}
                modelA={modelA}
                modelB={modelB}
                getModelName={getModelName}
                onReset={() => {
                  setBlindReveal(false);
                  setWinner(null);
                }}
              />
            )}
          </TabsContent>

          {/* Diff Viewer */}
          <TabsContent value="diff" className="space-y-6 mt-6 animate-fade-in">
            <ComparisonInputSection
              mode="diff"
              prompt={prompt}
              setPrompt={setPrompt}
              modelA={modelA}
              setModelA={setModelA}
              modelB={modelB}
              setModelB={setModelB}
              models={models}
              running={running}
              onRun={runComparison}
              error={error}
              onDismissError={() => setError(null)}
              buttonText="Generate Diff"
              runningText="Generating Diff..."
            />

            {running && <ComparisonSkeleton />}

            {results && results.diff && !running && <DiffResults results={results} />}
          </TabsContent>

          {/* Tournament */}
          <TabsContent value="tournament" className="space-y-6 mt-6 animate-fade-in">
            <Card className="border-2 border-amber-500/20">
              <CardHeader className="pb-4 bg-gradient-to-r from-amber-500/10 to-yellow-500/5 border-b border-amber-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <Trophy className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Model Tournament</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Bracket-style competition to find the ultimate champion
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-5">
                {/* Prompt */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Tournament Prompt
                  </Label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    placeholder="Enter prompt for all tournament matches..."
                    className="resize-none font-mono text-sm bg-background/50 border-border/50"
                  />
                </div>

                {/* Model selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Target className="h-4 w-4 text-amber-500" />
                      Select Participants
                    </Label>
                    <Badge variant="outline" className="text-xs">
                      {selectedTournamentModels.length} selected
                    </Badge>
                  </div>
                  <TournamentModelSelector
                    models={models}
                    selected={selectedTournamentModels}
                    onToggle={toggleTournamentModel}
                  />
                </div>

                {/* Error */}
                {error && <ErrorAlert error={error} onDismiss={() => setError(null)} />}

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    onClick={runTournament}
                    disabled={tournamentRunning || selectedTournamentModels.length < 2}
                    className="flex-1 h-12 shadow-lg shadow-amber-500/20"
                  >
                    {tournamentRunning ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Running Tournament...
                      </>
                    ) : (
                      <>
                        <Trophy className="h-5 w-5 mr-2" />
                        Start Tournament ({selectedTournamentModels.length} models)
                      </>
                    )}
                  </Button>
                  {tournament && (
                    <Button
                      variant="outline"
                      onClick={resetTournament}
                      className="h-12 px-6"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {tournamentRunning && <LoadingSpinner text="Running tournament battles..." />}

            {tournament && !tournamentRunning && (
              <TournamentBracket tournament={tournament} getModelName={getModelName} />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Info Sidebar */}
      <div className="lg:col-span-1">
        <ComparisonSidebar />
      </div>
    </div>
  );
}
