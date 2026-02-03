export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4 p-8">
        <h1 className="text-4xl font-bold text-primary">
          LLM Benchmark & Comparison Platform
        </h1>
        <p className="text-muted-foreground text-lg">
          Setup complete. Welcome to the dashboard.
        </p>
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
          Phase 0: Setup Complete
        </div>
      </div>
    </main>
  );
}
