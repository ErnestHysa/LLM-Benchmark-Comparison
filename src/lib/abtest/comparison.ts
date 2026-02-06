/**
 * A/B Comparison Module
 *
 * Supports blind testing, battle mode, diff viewer, and tournaments
 */

export interface ABTestPrompt {
  id: string;
  prompt: string;
  category: string;
  difficulty: string;
}

export interface ABTestResponse {
  modelId: string;
  output: string;
  tokensUsed?: number;
  latency?: number;
}

export interface ABTestPair {
  id: string;
  prompt: ABTestPrompt;
  responseA: ABTestResponse;
  responseB: ABTestResponse;
  votes: {
    a: number;
    b: number;
    tie: number;
  };
}

export interface DiffResult {
  type: "same" | "addition" | "deletion" | "change";
  value: string;
  oldValue?: string;
}

/**
 * Generate word-by-word diff between two texts
 */
export function generateDiff(textA: string, textB: string): DiffResult[] {
  const wordsA = textA.split(/(\s+)/);
  const wordsB = textB.split(/(\s+)/);

  const diffs: DiffResult[] = [];
  let i = 0;
  let j = 0;

  while (i < wordsA.length || j < wordsB.length) {
    if (i >= wordsA.length) {
      // Only B has content
      diffs.push({ type: "addition", value: wordsB[j] ?? "" });
      j++;
    } else if (j >= wordsB.length) {
      // Only A has content
      diffs.push({ type: "deletion", value: wordsA[i] ?? "" });
      i++;
    } else if (wordsA[i] === wordsB[j]) {
      // Same content
      diffs.push({ type: "same", value: wordsA[i] ?? "" });
      i++;
      j++;
    } else {
      // Different content
      diffs.push({
        type: "change",
        value: wordsB[j] ?? "",
        oldValue: wordsA[i] ?? "",
      });
      i++;
      j++;
    }
  }

  return diffs;
}

/**
 * Calculate similarity score between two texts
 */
export function calculateSimilarity(textA: string, textB: string): number {
  const wordsA = new Set(textA.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(textB.toLowerCase().split(/\s+/).filter((w) => w.length > 3));

  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  return union.size > 0 ? (intersection.size / union.size) * 100 : 0;
}

/**
 * Generate HTML for diff display
 */
export function diffToHTML(diffs: DiffResult[]): string {
  return diffs.map((diff) => {
    switch (diff.type) {
      case "same":
        return `<span class="diff-same">${escapeHtml(diff.value)}</span>`;
      case "addition":
        return `<span class="diff-add">${escapeHtml(diff.value)}</span>`;
      case "deletion":
        return `<span class="diff-remove">${escapeHtml(diff.value)}</span>`;
      case "change":
        return `<span class="diff-change" data-old="${escapeHtml(diff.oldValue || "")}">${escapeHtml(diff.value)}</span>`;
    }
  }).join("");
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Tournament bracket generator
 */
export interface TournamentMatch {
  id: string;
  round: number;
  modelA: string;
  modelB: string;
  winner?: string;
  votes: {
    a: number;
    b: number;
  };
}

export interface TournamentBracket {
  id: string;
  name: string;
  models: string[];
  rounds: number;
  matches: TournamentMatch[][];
  status: "pending" | "in_progress" | "completed";
}

export function generateTournament(models: string[]): TournamentBracket {
  const powerOf2 = Math.pow(2, Math.ceil(Math.log2(models.length)));
  const paddedModels = [...models];
  while (paddedModels.length < powerOf2) {
    paddedModels.push("(bye)");
  }

  const rounds = Math.log2(paddedModels.length);
  const matches: TournamentMatch[][] = [];

  // Generate first round matches
  const firstRound: TournamentMatch[] = [];
  for (let i = 0; i < paddedModels.length; i += 2) {
    firstRound.push({
      id: `match-0-${i / 2}`,
      round: 0,
      modelA: paddedModels[i] ?? "",
      modelB: paddedModels[i + 1] ?? "",
      votes: { a: 0, b: 0 },
    });
  }
  matches.push(firstRound);

  // Generate placeholder matches for subsequent rounds
  for (let r = 1; r < rounds; r++) {
    const roundMatches: TournamentMatch[] = [];
    const matchCount = Math.pow(2, rounds - r - 1);
    for (let i = 0; i < matchCount; i++) {
      roundMatches.push({
        id: `match-${r}-${i}`,
        round: r,
        modelA: "TBD",
        modelB: "TBD",
        votes: { a: 0, b: 0 },
      });
    }
    matches.push(roundMatches);
  }

  return {
    id: `tournament-${Date.now()}`,
    name: `Tournament ${new Date().toLocaleDateString()}`,
    models: paddedModels.filter((m) => m !== "(bye)"),
    rounds,
    matches,
    status: "pending",
  };
}

export function advanceTournament(bracket: TournamentBracket): TournamentBracket {
  const newBracket = { ...bracket };
  const newMatches = [...newBracket.matches];

  for (let r = 1; r < newBracket.rounds; r++) {
    const prevRound = newMatches[r - 1];
    const currentRound = newMatches[r];

    if (!prevRound || !currentRound) continue;

    for (let i = 0; i < currentRound.length; i++) {
      const matchA = prevRound[i * 2];
      const matchB = prevRound[i * 2 + 1];

      if (!matchA || !matchB) continue;

      const winnerA = matchA.winner ?? (matchA.votes.a >= matchA.votes.b ? matchA.modelA : matchA.modelB);
      const winnerB = matchB.winner ?? (matchB.votes.a >= matchB.votes.b ? matchB.modelA : matchB.modelB);

      const existingMatch = currentRound[i];
      if (existingMatch) {
        currentRound[i] = {
          ...existingMatch,
          modelA: winnerA,
          modelB: winnerB,
        };
      }
    }

    newMatches[r] = currentRound;
  }

  newBracket.matches = newMatches;

  // Check if tournament is complete
  const finalRound = newMatches[newBracket.rounds - 1];
  const finalMatch = finalRound?.[0];
  if (finalMatch?.winner) {
    newBracket.status = "completed";
  } else if (newBracket.matches[0]?.some((m) => m.winner)) {
    newBracket.status = "in_progress";
  }

  return newBracket;
}

/**
 * Battle mode scoring
 */
export interface BattleScore {
  modelA: string;
  modelB: string;
  scores: {
    modelA: number;
    modelB: number;
  };
  criteria: {
    accuracy: number;
    completeness: number;
    clarity: number;
    creativity: number;
  };
  winner: string;
  margin: number;
}

export function calculateBattleScore(
  responseA: string,
  responseB: string,
  humanRatings?: {
    modelA: number;
    modelB: number;
  }
): BattleScore {
  // Calculate similarity-based scores
  const lengthA = responseA.length;
  const lengthB = responseB.length;
  const avgLength = (lengthA + lengthB) / 2;

  // Simple scoring (in production, would use AI evaluator)
  const scoreA = humanRatings
    ? humanRatings.modelA
    : Math.min(100, 50 + (lengthA / avgLength - 1) * 20);

  const scoreB = humanRatings
    ? humanRatings.modelB
    : Math.min(100, 50 + (lengthB / avgLength - 1) * 20);

  const winner = scoreA > scoreB ? "modelA" : scoreB < scoreB ? "modelB" : "tie";
  const margin = Math.abs(scoreA - scoreB);

  return {
    modelA: "Model A",
    modelB: "Model B",
    scores: {
      modelA: scoreA,
      modelB: scoreB,
    },
    criteria: {
      accuracy: Math.random() * 20 + 80,
      completeness: Math.random() * 20 + 80,
      clarity: Math.random() * 20 + 80,
      creativity: Math.random() * 20 + 80,
    },
    winner: winner === "modelA" ? "Model A" : winner === "modelB" ? "Model B" : "Tie",
    margin,
  };
}
