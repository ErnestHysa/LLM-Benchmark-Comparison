/**
 * Prisma Seed File
 *
 * Seeds the database with:
 * - Default models (OpenAI, Anthropic)
 * - Default categories with metrics
 * - Default benchmarks (5-10 per category)
 */

import { PrismaClient, CategoryType } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Default models to seed
 */
const DEFAULT_MODELS = [
  {
    name: "GPT-4o",
    provider: "OPENAI" as const,
    providerId: "gpt-4o",
    description: "OpenAI's most capable multimodal model",
    isActive: true,
  },
  {
    name: "GPT-4 Turbo",
    provider: "OPENAI" as const,
    providerId: "gpt-4-turbo",
    description: "OpenAI's GPT-4 Turbo model",
    isActive: true,
  },
  {
    name: "GPT-3.5 Turbo",
    provider: "OPENAI" as const,
    providerId: "gpt-3.5-turbo",
    description: "OpenAI's fast, cost-effective model",
    isActive: true,
  },
  {
    name: "Claude 3.5 Sonnet",
    provider: "ANTHROPIC" as const,
    providerId: "claude-3-5-sonnet",
    description: "Anthropic's most balanced model",
    isActive: true,
  },
  {
    name: "Claude 3 Opus",
    provider: "ANTHROPIC" as const,
    providerId: "claude-3-opus",
    description: "Anthropic's most capable model",
    isActive: true,
  },
  {
    name: "Claude 3 Sonnet",
    provider: "ANTHROPIC" as const,
    providerId: "claude-3-sonnet",
    description: "Anthropic's balanced performance model",
    isActive: true,
  },
];

/**
 * Category metrics configuration (from roadmap)
 */
const CATEGORY_METRICS_CONFIG: Record<
  CategoryType,
  Array<{ name: string; description: string; weight: number }>
> = {
  CODING: [
    { name: "Functionality", description: "Does the code work correctly?", weight: 0.30 },
    { name: "Code Quality", description: "Clean code, best practices, maintainability", weight: 0.20 },
    { name: "Performance", description: "Efficiency, optimization, resource usage", weight: 0.15 },
    { name: "Design", description: "Architecture, patterns, modularity", weight: 0.15 },
    { name: "Readability", description: "Comments, naming, structure", weight: 0.10 },
    { name: "UI/UX", description: "Frontend design quality (if applicable)", weight: 0.05 },
    { name: "Security", description: "Vulnerabilities, best practices", weight: 0.05 },
  ],
  WRITING: [
    { name: "Creativity & Originality", description: "Novel ideas, unique perspective", weight: 0.25 },
    { name: "Coherence & Flow", description: "Logical progression, smooth transitions", weight: 0.20 },
    { name: "Engagement Factor", description: "Interesting, holds attention", weight: 0.20 },
    { name: "Grammar & Style", description: "Language quality, proper grammar", weight: 0.15 },
    { name: "Structure", description: "Beginning, middle, end", weight: 0.10 },
    { name: "Emotional Impact", description: "Evokes feelings, resonates", weight: 0.10 },
  ],
  REASONING: [
    { name: "Accuracy", description: "Correct answer to the problem", weight: 0.35 },
    { name: "Logical Flow", description: "Step-by-step reasoning makes sense", weight: 0.25 },
    { name: "Completeness", description: "Addresses all aspects of the problem", weight: 0.20 },
    { name: "Clarity", description: "Easy to follow reasoning", weight: 0.10 },
    { name: "Problem-Solving Approach", description: "Good method/approach used", weight: 0.10 },
  ],
  DEBUGGING: [
    { name: "Fix Correctness", description: "Solved the problem correctly?", weight: 0.35 },
    { name: "Bug Detection Accuracy", description: "Found all bugs?", weight: 0.25 },
    { name: "Explanation Quality", description: "Clear explanation of what's wrong", weight: 0.15 },
    { name: "Solution Efficiency", description: "Optimal approach to fix", weight: 0.15 },
    { name: "Edge Cases", description: "Considered uncommon scenarios?", weight: 0.10 },
  ],
  API_DESIGN: [
    { name: "RESTfulness", description: "Follows REST principles", weight: 0.25 },
    { name: "Documentation", description: "Clear endpoints, examples, schemas", weight: 0.20 },
    { name: "Scalability", description: "Can handle growth?", weight: 0.20 },
    { name: "Security", description: "Authentication, validation, rate limiting", weight: 0.20 },
    { name: "Error Handling", description: "Proper status codes, error messages", weight: 0.15 },
  ],
  DATABASE_SCHEMA: [
    { name: "Normalization", description: "Proper normalization, no redundancy", weight: 0.25 },
    { name: "Performance", description: "Efficient queries, proper indexing", weight: 0.25 },
    { name: "Data Integrity", description: "Constraints, proper types", weight: 0.20 },
    { name: "Scalability", description: "Can handle data growth?", weight: 0.15 },
    { name: "Clarity", description: "Clear naming, relationships", weight: 0.15 },
  ],
  UI_UX_DESIGN: [
    { name: "Usability", description: "Intuitive to use, easy navigation", weight: 0.30 },
    { name: "Visual Appeal", description: "Looks good, cohesive design", weight: 0.20 },
    { name: "Accessibility", description: "Screen readers, keyboard nav, contrast", weight: 0.15 },
    { name: "Responsiveness", description: "Works on mobile, desktop", weight: 0.15 },
    { name: "Consistency", description: "Design system alignment", weight: 0.20 },
  ],
  DATA_ANALYSIS: [
    { name: "Accuracy", description: "Correct insights and calculations", weight: 0.30 },
    { name: "Insights Quality", description: "Actionable, valuable findings", weight: 0.25 },
    { name: "Methodology", description: "Sound analytical approach", weight: 0.20 },
    { name: "Visualization", description: "Clear charts, graphs, tables", weight: 0.15 },
    { name: "Explanation", description: "Clear conclusions", weight: 0.10 },
  ],
};

/**
 * Benchmark definitions by category
 */
const BENCHMARKS: Record<
  CategoryType,
  Array<{ name: string; description: string; prompt: string }>
> = {
  CODING: [
    {
      name: "Todo App with React",
      description: "Build a functional Todo app using React and TypeScript with state management",
      prompt: `Create a complete Todo application using React and TypeScript with the following features:
- Add, edit, and delete todos
- Mark todos as complete/incomplete
- Persist data to localStorage
- Include search and filter functionality (by status)
- Use proper TypeScript types
- Follow React best practices with hooks

Provide the complete code in a single file format with comments explaining your approach.`,
    },
    {
      name: "REST API with Express",
      description: "Build a REST API for a task management system using Express.js",
      prompt: `Create a REST API using Express.js and TypeScript for a task management system with the following endpoints:
- GET /tasks - List all tasks with pagination
- GET /tasks/:id - Get a single task
- POST /tasks - Create a new task
- PUT /tasks/:id - Update a task
- DELETE /tasks/:id - Delete a task
- GET /tasks/user/:userId - Get tasks by user

Requirements:
- Use TypeScript with proper types
- Include input validation
- Add error handling middleware
- Use an in-memory data store (no database needed)

Provide the complete server code.`,
    },
    {
      name: "Binary Search Tree Implementation",
      description: "Implement a binary search tree with common operations",
      prompt: `Implement a Binary Search Tree (BST) in TypeScript with the following methods:
- insert(value): Insert a new value
- search(value): Search for a value
- delete(value): Delete a value
- inOrderTraversal(): Return values in ascending order
- findMin(): Find the minimum value
- findMax(): Find the maximum value

Requirements:
- Use TypeScript generics for the tree type
- Include proper type definitions
- Handle edge cases (duplicate values, empty tree)
- Add JSDoc comments for each method

Provide the complete implementation with test examples.`,
    },
    {
      name: "Debounce Function",
      description: "Implement a debounce utility function with TypeScript",
      prompt: `Implement a debounce function in TypeScript that:
- Takes a function and delay time as parameters
- Returns a debounced version of the function
- Cancels pending calls if called again within the delay
- Executes the function after the delay period
- Supports optional immediate execution on first call

Requirements:
- Use proper TypeScript types
- Include support for passing arguments and return type
- Add a cancel method to the debounced function
- Include usage examples

Provide the complete implementation.`,
    },
    {
      name: "React Custom Hook - useLocalStorage",
      description: "Create a custom React hook for syncing state with localStorage",
      prompt: `Create a custom React hook called useLocalStorage that:
- Syncs a state value with localStorage
- Accepts a key and initial value as parameters
- Returns the current value, setter function, and utility methods
- Handles JSON serialization/parsing
- Works with SSR (checks for window availability)
- Includes error handling for quota exceeded

Requirements:
- Use TypeScript with proper types
- Support generic types for the stored value
- Include a remove method to delete the key
- Add JSDoc comments

Provide the complete hook implementation with usage examples.`,
    },
  ],
  WRITING: [
    {
      name: "Time Travel Story",
      description: "Write a creative short story about accidental time travel",
      prompt: `Write a short story (500-800 words) about a time traveler who accidentally changes history while trying to fix a minor mistake.

Requirements:
- Establish clear motivation for the initial time travel
- Show the ripple effects of the change
- Include a twist or realization
- Use vivid descriptions and dialogue
- Have a satisfying conclusion

Focus on creativity, emotional impact, and narrative flow.`,
    },
    {
      name: "Technical Blog Post",
      description: "Write a blog post explaining a complex technical concept",
      prompt: `Write a 600-800 word blog post explaining "How WebAssembly Works" to intermediate developers.

Requirements:
- Start with a compelling hook
- Use analogies to simplify complex concepts
- Include a code example
- Structure with clear headings
- End with practical takeaways

Focus on clarity, engagement, and educational value.`,
    },
    {
      name: "Product Description",
      description: "Write a persuasive product description for a smart home device",
      prompt: `Write a product description (200-300 words) for a new smart home device called "EcoHub" that:
- Monitors energy usage across all appliances
- Automatically optimizes power consumption
- Learns user preferences over time
- Integrates with existing smart home systems

Write in a persuasive, marketing-oriented style that:
- Highlights unique benefits
- Addresses potential pain points
- Creates urgency to purchase
- Maintains professional yet approachable tone

Focus on persuasion and emotional appeal.`,
    },
    {
      name: "Email Newsletter",
      description: "Write an engaging newsletter for a developer audience",
      prompt: `Write a weekly developer newsletter (300-400 words) featuring:
- A brief intro with a personal touch
- 3 curated links with brief descriptions (choose any topics)
- A "Tip of the Week" section
- A closing thought or question to engage readers

Tone should be:
- Conversational but professional
- Enthusiastic without being hype-driven
- Scannable with good structure

Focus on engagement value and readability.`,
    },
  ],
  REASONING: [
    {
      name: "Logic Puzzle - Five Houses",
      description: "Solve the classic Einstein puzzle (Five Houses riddle)",
      prompt: `Solve this logic puzzle step by step:

There are 5 houses in a row, each painted a different color. Each house has a resident with a unique nationality, pet, favorite drink, and preferred sport.

Clues:
1. The Englishman lives in the red house.
2. The Spaniard owns the dog.
3. Coffee is drunk in the green house.
4. The Ukrainian drinks tea.
5. The green house is immediately to the right of the white house.
6. The soccer player owns snails.
7. The yellow house contains a painter.
8. Milk is drunk in the middle house.
9. The Norwegian lives in the first house.
10. The tennis player lives next to the fox owner.
11. The painter's house is next to the horse owner.
12. The basketball player drinks orange juice.
13. The Japanese person plays baseball.
14. The Norwegian lives next to the blue house.

Who owns the fish? Show your reasoning step by step.`,
    },
    {
      name: "Mathematical Proof",
      description: "Prove that the square root of 2 is irrational",
      prompt: `Provide a clear, step-by-step proof that √2 is irrational using proof by contradiction.

Your proof should:
- Start with the assumption that √2 is rational
- Show the logical steps that lead to a contradiction
- Conclude that the original assumption must be false
- Explain each step clearly for someone learning proofs

Focus on logical clarity and completeness.`,
    },
    {
      name: "Algorithm Analysis",
      description: "Analyze and explain time complexity of a sorting algorithm",
      prompt: `Analyze the time and space complexity of Merge Sort and provide:
1. A clear explanation of how the algorithm works
2. Best case, average case, and worst case time complexity
3. Space complexity analysis
4. Comparison with Quick Sort
5. When you would choose Merge Sort over other sorting algorithms

Provide detailed reasoning for each point.`,
    },
  ],
  DEBUGGING: [
    {
      name: "React Component Bug - State Update",
      description: "Find and fix bugs in a React component with state issues",
      prompt: `This React component has bugs. Find all bugs and fix them:

\`\`\`tsx
import React, { useState, useEffect } from 'react';

const UserProfile = ({ userId }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId);
  }, []);

  const fetchUser = async (id) => {
    const response = await fetch(\`/api/users/\${id}\`);
    const data = await response.json();
    setUser(data);
    setLoading(false);
  };

  const updateName = (newName) => {
    user.name = newName;
    setUser(user);
  };

  return (
    <div>
      {loading ? <p>Loading...</p> : <p>Name: {user.name}</p>}
      <button onClick={() => updateName('New Name')}>Update Name</button>
    </div>
  );
};

export default UserProfile;
\`\`\`

List each bug you find and provide the corrected code with explanations.`,
    },
    {
      name: "JavaScript Async Bug - Race Condition",
      description: "Identify and fix race condition in async code",
      prompt: `This code has a race condition bug. Find it and fix it:

\`\`\`javascript
let cachedData = null;

async function getData() {
  if (cachedData) {
    return cachedData;
  }

  const response = await fetch('/api/data');
  cachedData = await response.json();
  return cachedData;
}

// Multiple concurrent calls
async function main() {
  const [data1, data2, data3] = await Promise.all([
    getData(),
    getData(),
    getData()
  ]);
  console.log(data1, data2, data3);
}
\`\`\`

Explain the bug and provide a corrected version that handles concurrent calls properly.`,
    },
    {
      name: "TypeScript Type Bug",
      description: "Fix TypeScript type errors in generic function",
      prompt: `This TypeScript function has type issues. Fix them:

\`\`\`typescript
function getProperty<T, K extends keyof T>(obj: T, key: K) {
  return obj[key];
}

function pluck<T, K extends keyof T>(arr: T[], key: K) {
  return arr.map(obj => obj[key]);
}

// Usage
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' }
];

const names = pluck(users, 'name');
const ages = pluck(users, 'age'); // This should error but doesn't
\`\`\`

Identify the type safety issues and provide a corrected version with proper types.`,
    },
  ],
  API_DESIGN: [
    {
      name: "Authentication API",
      description: "Design a REST API for user authentication and session management",
      prompt: `Design a REST API for a complete authentication system with the following endpoints:
- User registration
- Email verification
- Login (email/password)
- Password reset (forgot password)
- Refresh token mechanism
- Logout

For each endpoint, specify:
- HTTP method and path
- Request body structure
- Response structure (success and error cases)
- Appropriate status codes
- Security considerations

Include authentication flow documentation and security best practices.`,
    },
    {
      name: "File Upload API",
      description: "Design an API for handling file uploads with progress tracking",
      prompt: `Design a REST API for a file upload service with:
- Chunked upload support for large files
- Upload progress tracking
- Pause/resume functionality
- File type validation
- Virus scanning integration

Specify:
- All endpoints and their purposes
- How to handle concurrent uploads
- Data storage strategy
- Error handling for network failures

Include request/response examples.`,
    },
    {
      name: "WebSocket API Design",
      description: "Design a WebSocket API for real-time notifications",
      prompt: `Design a WebSocket API for a real-time notification system that supports:
- User-specific notifications
- Channel-based subscriptions
- Message acknowledgment
- Reconnection handling
- Presence indicators

Document:
- Connection flow
- Message format (JSON schema)
- Event types and payloads
- Authentication over WebSocket
- Reconnection strategy with backoff

Include example message flows.`,
    },
  ],
  DATABASE_SCHEMA: [
    {
      name: "E-commerce Database Schema",
      description: "Design a complete database schema for an e-commerce platform",
      prompt: `Design a database schema for an e-commerce platform with:
- Products with variants (size, color)
- Categories and hierarchical navigation
- Shopping cart and session management
- Orders with multiple items
- Payments with multiple providers
- User reviews and ratings

Provide:
- Complete table definitions with columns and types
- All relationships (one-to-many, many-to-many)
- Indexes for performance
- Considerations for data integrity

Use SQL DDL or Prisma schema format.`,
    },
    {
      name: "Social Media Database Schema",
      description: "Design a database schema for a social media feed system",
      prompt: `Design a database schema for a social media platform with:
- Users and profiles
- Posts with text, images, videos
- Comments (threaded)
- Likes/reactions
- Following/followers relationship
- Feed generation for timeline

Provide:
- Table definitions
- Relationships
- Indexes for common queries
- Scaling considerations for large datasets

Use SQL DDL or Prisma schema format.`,
    },
    {
      name: "Messaging App Database Schema",
      description: "Design a database for a real-time messaging application",
      prompt: `Design a database schema for a messaging app like WhatsApp with:
- One-on-one conversations
- Group chats with multiple participants
- Message threading
- Read receipts
- Message status (sent, delivered, read)
- Media attachments
- Search functionality

Provide:
- Table definitions
- Relationships
- Indexes for performance
- Query patterns for common operations

Use SQL DDL or Prisma schema format.`,
    },
  ],
  UI_UX_DESIGN: [
    {
      name: "Weather App UI Design",
      description: "Design the UI for a weather application",
      prompt: `Design the complete UI for a weather mobile app with:

Home Screen:
- Current temperature and conditions
- Hourly forecast (scrollable)
- 7-day forecast
- Weather alerts banner

Details Screen:
- Humidity, wind, UV index, visibility
- Sunrise/sunset times
- Air quality index
- Precipitation chart

Specify:
- Layout structure for each screen
- Component hierarchy
- Color scheme (consider light/dark modes)
- Typography hierarchy
- Touch targets and interaction patterns
- Animation considerations

Focus on usability and information hierarchy.`,
    },
    {
      name: "Dashboard Design for Analytics",
      description: "Design a dashboard for business analytics",
      prompt: `Design a web-based analytics dashboard for a business owner with:

Required Elements:
- Key metrics cards (revenue, orders, customers)
- Revenue chart (line graph, selectable time range)
- Top products table with trend indicators
- Customer map (geographic distribution)
- Recent activity feed
- Date range picker affecting all widgets

Specify:
- Grid layout structure
- Card component design
- Chart visualizations
- Color usage for data visualization
- Responsive behavior (tablet/desktop)
- Loading states

Focus on data clarity and scanability.`,
    },
    {
      name: "Settings Page Design",
      description: "Design a comprehensive settings page with multiple sections",
      prompt: `Design a settings page for a productivity app with sections:

Settings:
- Profile (name, avatar, bio)
- Notifications (email, push, in-app)
- Privacy (data sharing, profile visibility)
- Account (password, 2FA, connected apps)
- Appearance (theme, font size, density)
- Billing (subscription, payment methods, invoices)

Specify:
- Navigation structure (tabs vs sidebar)
- Form layout patterns
- Input component styles
- Save/cancel behavior
- Confirmation dialogs for destructive actions
- Empty states

Focus on efficiency and ease of use.`,
    },
  ],
  DATA_ANALYSIS: [
    {
      name: "Sales Data Analysis",
      description: "Analyze provided sales data and provide insights",
      prompt: `Analyze this hypothetical sales dataset for Q1 2024 and provide actionable insights:

Data:
- January: $120,000 (12% growth from Dec)
- February: $115,000 (-4% from Jan)
- March: $145,000 (+26% from Feb)

Top products by revenue:
1. Premium Widget - $45,000
2. Basic Widget - $38,000
3. Enterprise Plan - $32,000

Customer segments:
- Enterprise (47% of revenue)
- Mid-market (32% of revenue)
- SMB (21% of revenue)

Provide:
- Key trends and patterns
- Performance drivers
- Areas of concern
- Specific recommendations for Q2
- Metrics to track going forward

Focus on actionable insights.`,
    },
    {
      name: "A/B Test Analysis",
      description: "Analyze A/B test results and provide recommendations",
      prompt: `Analyze these A/B test results for a checkout flow change:

Control (original design):
- Visitors: 10,000
- Add to cart: 4,500 (45%)
- Started checkout: 2,700 (60% of add to cart)
- Completed purchase: 1,350 (50% of started checkout)
- Total conversion: 13.5%

Variant (new design):
- Visitors: 10,000
- Add to cart: 4,800 (48%)
- Started checkout: 2,400 (50% of add to cart)
- Completed purchase: 1,440 (60% of started checkout)
- Total conversion: 14.4%

Provide:
- Statistical significance assessment
- Funnel analysis
- Recommendation (control vs variant)
- Potential follow-up tests
- Risk assessment

Focus on methodology and clear conclusions.`,
    },
    {
      name: "Churn Analysis",
      description: "Analyze customer churn data and identify patterns",
      prompt: `Analyze customer churn data and provide insights:

Churn by subscription length:
- 0-3 months: 8%
- 3-6 months: 12%
- 6-12 months: 18%
- 12+ months: 5%

Churn by payment plan:
- Monthly: 15%
- Quarterly: 10%
- Annual: 4%

Top churn reasons from exit surveys:
1. "Too expensive" - 35%
2. "Didn't use enough" - 28%
3. "Found alternative" - 18%
4. "Technical issues" - 12%
5. "Other" - 7%

Provide:
- Key churn risk factors
- Segments with highest risk
- Retention strategies
- Early warning indicators
- Priority actions

Focus on actionable retention strategies.`,
    },
  ],
};

/**
 * Seed function
 */
async function main() {
  console.log("🌱 Starting database seed...");

  // Clean existing data (optional - comment out to preserve data)
  console.log("🧹 Cleaning existing data...");
  await prisma.humanRating.deleteMany();
  await prisma.metricScore.deleteMany();
  await prisma.score.deleteMany();
  await prisma.categoryScore.deleteMany();
  await prisma.modelRun.deleteMany();
  await prisma.benchmarkRun.deleteMany();
  await prisma.categoryMetric.deleteMany();
  await prisma.benchmarkCategory.deleteMany();
  await prisma.benchmark.deleteMany();
  await prisma.model.deleteMany();
  await prisma.apiKey.deleteMany();

  console.log("✅ Cleaned existing data");

  // Seed models
  console.log("📦 Seeding default models...");
  for (const model of DEFAULT_MODELS) {
    await prisma.model.upsert({
      where: { name: model.name },
      update: {},
      create: model,
    });
  }
  console.log(`✅ Created ${DEFAULT_MODELS.length} models`);

  // Seed categories and metrics
  console.log("📊 Seeding categories and metrics...");
  let categoryCount = 0;
  let metricCount = 0;

  for (const [categoryType, metrics] of Object.entries(CATEGORY_METRICS_CONFIG)) {
    // Create category
    const category = await prisma.benchmarkCategory.upsert({
      where: { name: categoryType },
      update: {},
      create: {
        name: categoryType,
        description: `${categoryType.replace("_", " ")} evaluation category`,
        color: getCategoryColor(categoryType as CategoryType),
      },
    });

    categoryCount++;

    // Create metrics for this category
    for (const metric of metrics) {
      await prisma.categoryMetric.upsert({
        where: {
          name_categoryId: {
            name: metric.name,
            categoryId: category.id,
          },
        },
        update: {},
        create: {
          categoryId: category.id,
          name: metric.name,
          description: metric.description,
          weight: metric.weight,
        },
      });
      metricCount++;
    }
  }

  console.log(`✅ Created ${categoryCount} categories with ${metricCount} metrics`);

  // Seed benchmarks
  console.log("📝 Seeding benchmarks...");
  let benchmarkCount = 0;

  for (const [categoryType, benchmarks] of Object.entries(BENCHMARKS)) {
    for (const benchmark of benchmarks) {
      const created = await prisma.benchmark.create({
        data: {
          name: benchmark.name,
          description: benchmark.description,
          prompt: benchmark.prompt,
          primaryCategory: categoryType as CategoryType,
          isPublic: true,
        },
      });

      benchmarkCount++;

      // Link category
      const category = await prisma.benchmarkCategory.findUnique({
        where: { name: categoryType },
      });

      if (category) {
        await prisma.benchmarkCategory.update({
          where: { id: category.id },
          data: {
            benchmarks: {
              connect: { id: created.id },
            },
          },
        });
      }
    }
  }

  console.log(`✅ Created ${benchmarkCount} benchmarks`);

  console.log("🎉 Seed completed successfully!");
  console.log("\n📈 Summary:");
  console.log(`  - Models: ${DEFAULT_MODELS.length}`);
  console.log(`  - Categories: ${categoryCount}`);
  console.log(`  - Metrics: ${metricCount}`);
  console.log(`  - Benchmarks: ${benchmarkCount}`);
}

/**
 * Get color for category
 */
function getCategoryColor(category: CategoryType): string {
  const colors: Record<CategoryType, string> = {
    CODING: "#8b5cf6", // violet
    WRITING: "#f59e0b", // amber
    REASONING: "#3b82f6", // blue
    DEBUGGING: "#ef4444", // red
    API_DESIGN: "#10b981", // emerald
    DATABASE_SCHEMA: "#06b6d4", // cyan
    UI_UX_DESIGN: "#ec4899", // pink
    DATA_ANALYSIS: "#f97316", // orange
  };

  return colors[category] || "#8b5cf6";
}

/**
 * Run seed
 */
main()
  .catch((e) => {
    console.error("❌ Seed failed:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
