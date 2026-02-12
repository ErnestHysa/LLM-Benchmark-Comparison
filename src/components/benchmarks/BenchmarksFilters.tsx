/**
 * BenchmarksFilters Component
 *
 * Client component for search and category filters
 */

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState, useTransition, FormEvent } from "react";

interface BenchmarksFiltersProps {
  initialSearch?: string;
}

export function BenchmarksFilters({ initialSearch = "" }: BenchmarksFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(initialSearch);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const currentCategory = searchParams.get("category") || "ALL";

  const updateSearch = () => {
    const params = new URLSearchParams(searchParams.toString());

    if (search.trim()) {
      params.set("search", search.trim());
    } else {
      params.delete("search");
    }

    startTransition(() => {
      router.push(`/benchmarks?${params.toString()}`);
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateSearch();
  };

  const handleClear = () => {
    setSearch("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    startTransition(() => {
      router.push(`/benchmarks?${params.toString()}`);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search benchmarks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 pr-20"
        />
        {search && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-12 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
          >
            Clear
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-medium text-primary hover:underline disabled:opacity-50"
        >
          Search
        </button>
      </div>
    </form>
  );
}

interface CategoryTabsProps {
  currentCategory: string;
}

export function CategoryTabs({ currentCategory }: CategoryTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const CATEGORIES = [
    { value: "ALL", label: "All Categories" },
    { value: "CODING", label: "Coding" },
    { value: "WRITING", label: "Writing" },
    { value: "REASONING", label: "Reasoning" },
    { value: "DEBUGGING", label: "Debugging" },
    { value: "API_DESIGN", label: "API Design" },
    { value: "DATABASE_SCHEMA", label: "Database Schema" },
    { value: "UI_UX_DESIGN", label: "UI/UX Design" },
    { value: "DATA_ANALYSIS", label: "Data Analysis" },
  ];

  const handleCategoryChange = (category: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (category === "ALL") {
      params.delete("category");
    } else {
      params.set("category", category);
    }

    startTransition(() => {
      router.push(`/benchmarks?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-1">
      {CATEGORIES.map((cat) => {
        const isActive = currentCategory === cat.value;
        return (
          <button
            key={cat.value}
            onClick={() => handleCategoryChange(cat.value)}
            disabled={isPending}
            className={`
              px-4 py-2 text-sm font-medium rounded-t-md transition-colors
              ${isActive
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }
              ${isPending ? "opacity-50" : ""}
            `}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
