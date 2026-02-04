# LLM Benchmark & Comparison Platform

**A truthful LLM benchmarking platform with real tasks, real outputs, and real scores.**

> Compare multiple AI models using your own API keys. All results saved locally. No accounts required.

## Features

### Core Features
- **Realistic Benchmarks** - Practical tasks from coding to data analysis
- **Multiple Providers** - OpenAI, Anthropic, OpenRouter, and custom endpoints
- **Hybrid Scoring** - AI evaluation + human rating options
- **Side-by-Side Comparison** - Visual charts and detailed metrics
- **Local Storage** - All data saved locally (your API keys, results, preferences)
- **Export Options** - CSV, JSON formats
- **Leaderboards** - Track model performance over time
- **Configurable** - Custom evaluator, concurrency, timeout settings

### New Features (Latest)
- **View Model Output** - Full syntax highlighting for code outputs (15+ languages)
- **AI Metric Explanations** - See the reasoning behind each score from the AI evaluator
- **Bulk Delete Runs** - Delete multiple benchmark runs with checkboxes
- **Manual Model Registration** - Register custom models directly from the leaderboard
- **Toast Notifications** - Real-time feedback for all user actions

## Tech Stack

- **Framework**: Next.js 15 (App Router, React 19)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS v4
- **Database**: SQLite with Prisma ORM
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Syntax Highlighting**: react-syntax-highlighter
- **Animations**: CSS (no Framer Motion for React 19 compatibility)

## Prerequisites

- Node.js 20+
- npm or pnpm

## How to Run

### 1. Clone and Install

```bash
git clone <repository-url>
cd llm-benchmark-comparison
npm install
```

### 2. Setup Database

The project uses SQLite for local data storage. The database is automatically seeded with:

- 8 predefined benchmarks
- 8 predefined models (OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet, etc.)
- 8 benchmark categories with metrics

```bash
# Generate Prisma client
npm run db:generate

# Push database schema (creates SQLite DB)
npm run db:push

# Seed with initial data
npm run db:seed
```

### 3. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3010](http://localhost:3010) in your browser.

## Development Notes

### Database

The project uses **SQLite** instead of PostgreSQL for simplicity. The database schema is defined in `prisma/schema.prisma`.

- Database file: `prisma/dev.db`
- To view data: `npm run db:studio`

### API Keys

API keys are stored in **localStorage** (not the database):

1. Go to **Settings → API Keys**
2. Add your OpenAI, Anthropic, or OpenRouter API keys
3. Keys are base64-encoded before storing
4. Keys are only sent to the respective provider's API

**Note**: Never share your `.env` file if you add server-side API keys.

### Evaluator Configuration

The AI evaluator scores benchmark outputs. Configure it in **Settings → Evaluator**:

- **Default**: GPT-4o (OpenAI)
- **Options**: Claude 3.5 Sonnet, custom OpenRouter models
- The evaluator uses your API key to make requests
- **Test API** button verifies your keys are working

### Model Output Viewing

When viewing benchmark results, click **View Output** to see:
- Full model output with syntax highlighting
- Support for JavaScript, TypeScript, Python, Java, C++, Go, Rust, SQL, JSON, HTML, CSS, Bash, Markdown
- One-click copy to clipboard
- Character count and language detection

### AI Metric Explanations

On the Detailed Metrics tab, view **AI Explanations** for each score:
- Grouped by category
- Expandable/collapsible sections
- Shows the AI evaluator's reasoning for each score
- Metric name, value, and explanation displayed

### History Management

The History page includes:
- **Bulk Delete**: Select multiple runs with checkboxes
- **Individual Delete**: Delete single runs via dropdown menu
- **Confirmation Dialog**: Ensures no accidental deletions
- **Cascade Delete**: All related data (ModelRuns, Scores, MetricScores) removed automatically
- **Toast Notifications**: Success/error feedback

### Manual Model Registration

Register custom models from the Leaderboard:
- Click **Register Model** button
- Use **Quick Add** for common models
- Enter custom Model ID (e.g., `anthropic/claude-3.5-sonnet` for OpenRouter)
- Provider auto-detected from Model ID format
- Models appear in leaderboards once benchmarks are run

### Toast Notifications

The app uses toast notifications for user feedback:
- **Success** - Green, for completed actions
- **Error** - Red, for failed operations
- **Warning** - Yellow, for caution states
- **Info** - Blue, for informational messages
- Auto-dismiss after 5 seconds

### CSS Animations

Instead of Framer Motion (incompatible with React 19), we use custom CSS animations:

- `animate-fade-in` - Opacity transition
- `animate-fade-in-up` - Opacity + Y transform
- `animate-scale-in` - Scale transition
- `animate-slide-in-left` - X transform
- `delay-100`, `delay-200`, etc. - Staggered delays

Reduced motion is respected via `@media (prefers-reduced-motion: reduce)`.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── benchmarks/         # Benchmark listing and detail
│   │   └── [id]/run/       # Run benchmark page
│   ├── history/            # Benchmark history with bulk delete
│   ├── leaderboard/        # Model leaderboards with registration
│   ├── results/[id]/       # Detailed results view with metric explanations
│   ├── settings/           # Settings (API keys, models, evaluator)
│   └── api/                # API routes
│       ├── benchmark-runs/ # DELETE endpoint for bulk delete
│       ├── models/         # POST/GET/DELETE for model registration
│       └── results/[id]/   # GET results with metric explanations
├── components/
│   ├── ui/                 # shadcn/ui components
│   │   ├── toast.tsx       # Toast primitives (Radix UI)
│   │   ├── toaster.tsx     # Toast state management
│   │   ├── alert-dialog.tsx
│   │   ├── checkbox.tsx    # For bulk selection
│   │   └── scroll-area.tsx # For modal content
│   ├── dashboard/          # Dashboard-specific components
│   ├── history/            # HistoryClient with bulk delete
│   ├── leaderboard/        # LeaderboardClient with RegisterModelDialog
│   ├── results/            # ResultsClient, ModelOutputModal
│   ├── layout/             # Sidebar, Header, Breadcrumb
│   └── settings/           # Settings components
├── lib/
│   ├── llm/                # LLM service layer (OpenAI, Anthropic, etc.)
│   ├── prisma.ts           # Prisma client
│   ├── scoring.ts          # Scoring algorithms
│   ├── export.ts           # CSV/JSON export
│   ├── errors.ts           # Error handling utilities
│   └── settings.ts         # Settings management (localStorage)
└── styles/
    └── globals.css          # Global styles, design tokens, animations
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest tests |
| `npm run test:ui` | Run Vitest with UI |
| `npm run test:coverage` | Run tests with coverage |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push database schema |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio |

## Benchmark Categories

| Category | Description |
|----------|-------------|
| **CODING** | Code quality, functionality, design |
| **WRITING** | Creativity, coherence, engagement |
| **REASONING** | Logic, accuracy, completeness |
| **DEBUGGING** | Bug detection, fix correctness |
| **API_DESIGN** | RESTfulness, documentation, scalability |
| **DATABASE_SCHEMA** | Normalization, performance, integrity |
| **UI_UX_DESIGN** | Usability, visual appeal, accessibility |
| **DATA_ANALYSIS** | Accuracy, insights, methodology |

## Accessibility

- WCAG 2.1 AA compliant color contrasts
- Keyboard navigation throughout
- Focus states on all interactive elements
- Touch targets ≥44×44px
- Proper ARIA labels on icons and buttons
- Reduced motion support
- Skip to main content link

## License

MIT License - feel free to use this project for your own LLM evaluations.

## Roadmap

See [roadmap.md](./roadmap.md) for the complete development roadmap and implementation phases.

## Status

**Phase 5: Polish & Testing (Week 7)** - Complete

✅ Phase 0: Setup
✅ Phase 1: Core Infrastructure
✅ Phase 2: Dashboard UI
✅ Phase 3: Results & Leaderboards
✅ Phase 4: Settings & Configuration
✅ Phase 5: Polish & Testing
✅ Phase 5.5: Feature Completion (Toast, Bulk Delete, Model Registration, Output Viewing, Metric Explanations)
⏳ Phase 6: Deployment
