/**
 * Challenging Benchmark Seeds
 *
 * Advanced benchmarks that test LLM capabilities with complex prompts,
 * edge cases, and traps that make scoring 90%+ difficult.
 */

import { PrismaClient, CategoryType } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Challenging benchmarks - one per category
 * These are designed to be significantly harder than default benchmarks
 */
const CHALLENGING_BENCHMARKS: Array<{
  name: string;
  description: string;
  prompt: string;
  category: CategoryType;
}> = [
  {
    category: "CODING",
    name: "Concurrent Rate Limiter with Distributed Systems",
    description: "Build a distributed rate limiter with sliding window, Redis-backed state, and precise edge cases",
    prompt: `You are implementing a rate limiter for a distributed API gateway. Build a complete solution in TypeScript with these requirements:

CORE FUNCTIONALITY:
- Sliding window algorithm (NOT fixed window or token bucket)
- Window: 10 seconds, max 100 requests
- Must handle concurrent requests without race conditions
- Distributed: multiple server instances share state via Redis

EXACT OUTPUT FORMAT:
Your response must follow this structure exactly:

\`\`\`typescript
// types.ts
[your type definitions]

// rate-limiter.ts
[main implementation]

// redis-client.ts
[Redis integration]

// tests.ts
[test cases showing edge cases]
\`\`\`

CRITICAL EDGE CASES TO HANDLE:
1. Request at exactly window boundary - must be counted correctly
2. Burst of 1000 requests at once - must only allow 100
3. Clock drift between servers - your solution must handle this
4. Redis failure - implement fallback strategy
5. Request arrives while Redis is reconnecting

TRAPS TO AVOID:
- Do NOT use simple counters (they fail for sliding window)
- Do NOT ignore the distributed requirement
- Do NOT forget to handle Redis unavailability
- Do NOT use token bucket (we specifically want sliding window)
- The window slides CONTINUOUSLY, not in discrete increments

BONUS: Include timestamp-based cleanup for old entries

After your code, explain specifically how you handle each edge case.`,
  },
  {
    category: "WRITING",
    name: "Multi-Layered Satire with Tonal Shifts",
    description: "Write satirical content that balances multiple layers of meaning while navigating tonal tightropes",
    prompt: `Write a satirical op-ed (800-1000 words) titled "Why We Should Embrace AI-Generated Corporate Communication."

LAYERING REQUIREMENTS:
Your piece must work on ALL these levels simultaneously:
1. Surface level: Appears to support AI in corporate comms
2. Satirical layer: Actually critiques corporate dehumanization
3. Meta layer: Satirizes the AI hype cycle itself
4. Emotional layer: Must evoke genuine unease in the reader

TONAL RESTRICTIONS (do not violate):
- Never break character into obvious sarcasm
- Use corporate buzzwords unironically within the satire
- Maintain "pro-AI" stance throughout (the critique must be implied)
- No winking at the reader (no "just kidding" moments)

SPECIFIC REQUIREMENTS:
- Include a "genuine" testimonial that's obviously fake but presented as real
- Reference 3 real AI companies (use their actual messaging style)
- End with a call-to-action that's progressively more disturbing
- Use at least 5 of these phrases unironically: "synergy," "paradigm shift," "game-changer," "revolutionize," "unlock value"

FORBIDDEN:
- Do NOT use obvious satire markers (quotation marks, "sic," etc.)
- Do NOT break the fourth wall
- Do NOT make the corporations obviously evil (they should be terrifyingly normal)

After your piece, briefly explain (2-3 sentences) what you actually believe about AI in corporate communication - this tests if you can separate persona from your actual view.

This tests: sustained voice, layered meaning, tonal consistency, and moral ambiguity without breaking character.`,
  },
  {
    category: "REASONING",
    name: "Self-Referential Paradox Chain",
    description: "Solve interconnected logical paradoxes that reference each other and require careful parsing",
    prompt: `Solve this multi-step reasoning problem. Read EXTREMELY carefully - small details matter.

PROBLEM:

Five logicians (A, B, C, D, E) are playing a truth-telling game with these rules:
- Truth-tellers ALWAYS tell the truth
- Liars ALWAYS lie
- Alternators alternate between truth and lies (starting with either)
- Each person is exactly one type

They make these statements IN ORDER:

A: "B is a truth-teller."
B: "C is NOT the same type as me."
C: "D and E are different types."
D: "A is a liar."
E: "C told the truth. Also, the number of truth-tellers among us is prime."

Then they each reveal one more piece:

A: "By the way, if I'm an alternator, I started with a lie."
B: "The number of liars is greater than the number of truth-tellers."
C: "D and I are the same type."
D: "Exactly one person is an alternator."
E: "I started my sequence with a truth if and only if B is a liar."

YOUR TASK:
1. Determine each person's type with complete certainty
2. For each person, explain your reasoning step-by-step
3. If any ambiguity remains, state ALL possible valid solutions

TRAPS AND WARNINGS:
- The statements are made IN ORDER - this affects alternators
- "NOT the same type as me" means they are different types
- An alternator "starting with a lie" means their FIRST statement was false
- The word "Also" in E's first statement means BOTH parts must be true (if E is truth-telling then) or BOTH false (if E is lying then)
- When someone says "if I'm an alternator..." this statement itself must be evaluated for truth

CRITICAL: If you miscount the alternator states, you will get the wrong answer. Track carefully.

Format your answer:
A: [type] - [reasoning]
B: [type] - [reasoning]
C: [type] - [reasoning]
D: [type] - [reasoning]
E: [type] - [reasoning]

FINAL ANSWER: [your complete solution]`,
  },
  {
    category: "DEBUGGING",
    name: "Heisenbug Race Condition with Memory Leaks",
    description: "Find and fix subtle bugs including race conditions, memory leaks, and undefined behavior",
    prompt: `This code has MULTIPLE bugs. Some are obvious, some are subtle, some only appear under specific conditions.

\`\`\`typescript
interface CacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
}

class DataCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize = 1000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  async get(key: string): Promise<any> {
    const entry = this.cache.get(key);

    if (!entry) {
      return this.fetchAndCache(key);
    }

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return this.fetchAndCache(key);
    }

    return entry.data;
  }

  async set(key: string, data: any, ttl: number = 3600000): Promise<void> {
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    });
  }

  private async fetchAndCache(key: string): Promise<any> {
    const pending = this.cache.get(\`pending:\${key}\`);

    if (pending) {
      return pending.data;
    }

    const promise = this.fetchFromSource(key);
    this.cache.set(\`pending:\${key}\`, { data: promise, timestamp: Date.now(), expiresAt: Infinity });

    try {
      const data = await promise;
      this.cache.delete(\`pending:\${key}\`);
      await this.set(key, data);
      return data;
    } catch (error) {
      this.cache.delete(\`pending:\${key}\`);
      throw error;
    }
  }

  private async fetchFromSource(key: string): Promise<any> {
    // Simulated API call
    const response = await fetch(\`/api/data/\${key}\`);
    return response.json();
  }

  private evictOldest(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime && !key.startsWith('pending:')) {
        oldest = key;
        oldestTime = entry.timestamp;
      }
    }

    if (oldest) {
      this.cache.delete(oldest);
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache) {
        if (entry.expiresAt < now) {
          this.cache.delete(key);
        }
      }
    }, 60000);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Usage
const cache = new DataCache();
\`\`\`

BUGS TO FIND:

OBVIOUS BUGS (find these first):
1. There are 2-3 obvious bugs that would cause immediate issues

SUBTLE BUGS:
2. Race condition in concurrent access - when would this manifest?
3. Memory leak - where is it?
4. Type safety issue that TypeScript misses

EDGE CASE BUGS:
5. What happens with rapid get() calls for same key before fetch completes?
6. What happens when maxSize is reached and cache is full of pending entries?
7. What if fetchFromSource takes longer than ttl?

For EACH bug:
1. Identify the exact line(s) and bug type
2. Explain WHEN it would cause problems
3. Provide the fix
4. Explain WHY your fix works

Format:
BUG 1: [name]
Lines: [affected lines]
Issue: [explanation]
Fix: [code snippet]

... continue for all bugs

Then provide the complete corrected code.`,
  },
  {
    category: "API_DESIGN",
    name: "Event-Sourced Microservices with CQRS",
    description: "Design a complex event-sourced API with eventual consistency, command validation, and query optimization",
    prompt: `Design a complete REST API for an event-sourced e-commerce order system using CQRS pattern.

REQUIREMENTS:

COMMAND SIDE (writes):
1. POST /orders/command/create - Create new order
2. POST /orders/command/{orderId}/items - Add item (with idempotency key)
3. POST /orders/command/{orderId}/cancel - Cancel order
4. POST /orders/command/{orderId}/confirm - Confirm order

QUERY SIDE (reads):
5. GET /orders/query/{orderId} - Get current order state
6. GET /orders/query/{orderId}/events - Get full event history
7. GET /orders/query?status=confirmed&dateFrom=2024-01-01 - List with filters

CRITICAL COMPLEXITY REQUIREMENTS:

1. IDEMPOTENCY: All command endpoints must be idempotent. Design the mechanism.
2. EVENTUAL CONSISTENCY: Queries might be stale. How do you communicate this?
3. SAGA PATTERN: Order confirmation involves:
   - Reserve inventory (Inventory Service)
   - Process payment (Payment Service)
   - Send confirmation email (Notification Service)
   Design the saga compensation if any step fails.
4. VERSIONING: How do you handle event schema evolution?
5. OPTIMISTIC LOCKING: Prevent concurrent modifications

FOR EACH ENDPOINT SPECIFY:
- Method, path, and purpose
- Request body with validation rules
- Response structure (202 Accepted with async operation ID pattern?)
- Error responses with specific status codes
- Idempotency key handling
- Retry policy

ADDITIONAL DOCUMENTATION:
- Event store schema (what events exist?)
- Command validation rules (business logic)
- Read model projection strategy
- Compensation logic for failed sagas
- How to handle "command already processed" vs "duplicate command"

TRAPS TO CONSIDER:
- What if the same command is sent twice with same idempotency key but different payload?
- What if a saga fails midway through?
- How do you ensure read model is eventually consistent?
- What if the event store is temporarily unavailable?

Provide API specification in OpenAPI format or clear structured documentation.`,
  },
  {
    category: "DATABASE_SCHEMA",
    name: "Multi-Tenant SaaS with Time-Travel and Auditing",
    description: "Design a complex multi-tenant database with row-level security, audit trails, and temporal queries",
    prompt: `Design a database schema for a multi-tenant SaaS application with these advanced requirements:

CORE ENTITIES:
- Tenants (organizations)
- Users (with role-based access per tenant)
- Projects (belong to tenants)
- Tasks (belong to projects, with assignments)
- Documents (with version history)

ADVANCED REQUIREMENTS:

1. ROW-LEVEL SECURITY (RLS):
- Users can only see data from their tenant
- Some users have cross-tenant access (auditors)
- Some rows are marked "sensitive" and require additional permission
- Design the RLS approach (database-level vs app-level)

2. TIME TRAVEL QUERIES:
- Support "as of [timestamp]" queries for any table
- Track all changes (insert, update, delete)
- Provide schema for temporal tables
- Example: "Show me all tasks assigned to user X as of 2024-01-15"

3. AUDIT TRAIL:
- Who changed what, when, and from where
- Schema for audit log table
- How to handle cascading deletes in audit trail
- Query pattern for "show me the full history of record Y"

4. SOFT DELETE + HARD DELETE:
- Some tables support soft delete (is_deleted flag)
- After 30 days, soft-deleted rows are hard deleted
- How does this interact with audit trail?

5. DATA ARCHIVAL:
- Old data moves to cold storage
- Schema for archived tables
- How to query across active + archived data

PROVIDE:
- Complete DDL for all tables (PostgreSQL or your choice)
- Indexes for performance
- Constraints for data integrity
- RLS policy definitions (if database-level)
- Migration strategy for adding time-travel to existing tables
- Example queries for:
  a) Cross-tenant admin query
  b) Temporal query (as of timestamp)
  c) Audit trail retrieval
  d) Archived data query

COMPLEXITY TRAPS:
- How do you handle foreign keys to soft-deleted rows?
- What if someone restores a soft-deleted row that was referenced?
- How do you prevent duplicate audit entries during bulk updates?
- Time-travel for many-to-many relationships?
- Performance: time-travel queries can be slow - optimization strategy?`,
  },
  {
    category: "UI_UX_DESIGN",
    name: "Complex Collaborative Editor Interface",
    description: "Design a real-time collaborative editor with presence, conflicts, and version history",
    prompt: `Design the complete UI/UX for a Figma/Google Docs-style collaborative editor.

SCREENS TO DESIGN:

1. CANVAS SCREEN (main editing area):
- Infinite canvas with pan/zoom
- Multiple users editing simultaneously
- Real-time cursors with user names
- Selection indicators showing what others are selecting
- Conflict resolution UI (when two edit same object)

2. VERSION HISTORY PANEL:
- Timeline of all changes
- Per-user contributions highlighted
- "Play" button to watch document evolve
- Branch comparison (show differences between versions)
- Rollback with merge (not just replace)

3. COMMENT THREADS:
- Inline comments attached to specific elements
- @mentions with dropdown
- Resolved vs unresolved states
- Thread collapse/expand
- Comment presence indicators (who's viewing which comment)

4. COLLABORATION SIDEBAR:
- Active users now (with status: online, away, offline)
- Voice/video call buttons
- Share dialog with granular permissions (view, comment, edit)
- Activity feed (who did what in last hour)

CRITICAL UX CHALLENGES TO ADDRESS:

1. NETWORK ISSUES:
- How do you show "reconnecting..." state?
- What happens when someone edits while disconnected?
- Conflict resolution UI when changes conflict
- Optimistic updates that get rejected

2. PERFORMANCE:
- 1000+ objects on canvas
- How to maintain 60fps?
- Loading states for large documents
- Progressive loading strategy

3. ACCESSIBILITY:
- Keyboard navigation for complex canvas
- Screen reader announcements for:
  - User joined/left
  - New comments
  - Conflicts detected
- High contrast mode for color-blind users
- Voice control considerations

4. MOBILE ADAPTATION:
- How does canvas work on touch?
- How do you show cursors of 5 other users on mobile?
- Smaller screen version of history panel

FOR EACH SCREEN SPECIFY:
- Layout structure (grid/flex/absolute)
- Component hierarchy
- Visual design details (colors, spacing, typography)
- Interaction patterns
- Animation strategy
- Loading states
- Error states

INCLUDE:
- Presence indicators design
- Cursor appearance (how to distinguish 10 users?)
- Conflict UI (how to show "Bob changed this while you were editing"?)
- Version history visualization
- Comment thread interaction model

BONUS: Dark mode considerations for complex UI`,
  },
  {
    category: "DATA_ANALYSIS",
    name: "Causal Inference from Observational Data",
    description: "Analyze causality, not just correlation, with confounding variables and selection bias",
    prompt: `You are given observational data from an A/B test that was NOT properly randomized. Your task is to determine true causality.

SCENARIO:
An e-commerce company tested a new checkout flow. They assigned users to NEW or OLD flow based on:
- Users with even-numbered user IDs got NEW flow
- Users with odd-numbered user IDs got OLD flow
- User IDs are assigned sequentially at signup

RAW DATA:

| Metric | OLD Flow | NEW Flow |
|--------|----------|----------|
| Users | 10,000 | 10,000 |
| Completed purchase | 1,200 (12%) | 1,500 (15%) |
| Avg order value | $85 | $82 |
| Return rate (30 days) | 8% | 12% |

ADDITIONAL CONTEXT (discovered during investigation):
- User IDs 1-15,000 signed up BEFORE the test (more experienced users)
- User IDs 15,001-30,000 signed up DURING the test (new users)
- Even IDs skew toward NEW users (who signed up later)
- OLD flow users have been with platform 2x longer on average
- Mobile users: 40% of OLD flow, 65% of NEW flow
- Desktop conversion: 18%, Mobile conversion: 8%
- Premium users: 25% of OLD flow, 10% of NEW flow

YOUR ANALYSIS MUST INCLUDE:

1. CONFOUNDING VARIABLES:
   - List all confounding variables
   - For each: explain how it affects the results
   - Which direction does it bias?

2. SELECTION BIAS ANALYSIS:
   - What creates the selection bias?
   - How would you quantify it?
   - What's the true effect size range?

3. STATISTICAL TESTS:
   - What test would you run? (chi-square? t-test? regression?)
   - Show the formula/approach
   - What's your confidence interval for TRUE lift?

4. CAUSAL INFERENCE:
   - Use instrumental variables if applicable
   - Use propensity score matching approach
   - Use difference-in-differences if you have pre-test data
   - What assumptions are you making?

5. RECOMMENDATION:
   - Should they roll out the NEW flow?
   - What additional experiment would you run?
   - How would you properly A/B test this?

TRAPS TO AVOID:
- Do NOT just say "NEW flow won 15% vs 12%"
- Do NOT ignore the user ID assignment issue
- Do NOT forget Simpson's paradox potential
- Do NOT make causal claims without addressing confounders
- The obvious answer (NEW flow is better) is likely WRONG

Format your answer with clear sections and show your work.`,
  },
];

/**
 * Seed function
 */
async function main() {
  console.log("🌱 Adding challenging benchmarks...");

  let count = 0;

  for (const benchmark of CHALLENGING_BENCHMARKS) {
    // Find category
    const category = await prisma.benchmarkCategory.findUnique({
      where: { name: benchmark.category },
    });

    if (!category) {
      console.log(`⚠️  Category ${benchmark.category} not found, skipping...`);
      continue;
    }

    // Create benchmark
    const created = await prisma.benchmark.create({
      data: {
        name: benchmark.name,
        description: benchmark.description,
        prompt: benchmark.prompt,
        primaryCategory: benchmark.category,
        isPublic: true,
      },
    });

    // Link to category
    await prisma.benchmarkCategory.update({
      where: { id: category.id },
      data: {
        benchmarks: {
          connect: { id: created.id },
        },
      },
    });

    count++;
    console.log(`✅ Created: ${benchmark.name}`);
  }

  console.log(`\n🎉 Added ${count} challenging benchmarks!`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
