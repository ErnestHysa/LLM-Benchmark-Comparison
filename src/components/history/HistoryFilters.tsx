/**
 * HistoryFilters Component
 *
 * Client component for filter controls that updates URL search params
 */

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Filter,
  Search,
} from "lucide-react";
import { FormEvent, useState, useTransition } from "react";

interface HistoryFiltersProps {
  categories: Array<{ id: string; name: string }>;
  models: string[];
  initialSearch?: string;
  initialCategory?: string;
  initialModel?: string;
  initialStatus?: string;
}

export function HistoryFilters({
  categories,
  models,
  initialSearch = "",
  initialCategory = "",
  initialModel = "",
  initialStatus = "",
}: HistoryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local state for form inputs
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory || "all");
  const [model, setModel] = useState(initialModel || "all");
  const [status, setStatus] = useState(initialStatus || "all");

  const updateFilters = () => {
    const params = new URLSearchParams(searchParams.toString());

    // Update params with current filter values
    if (search) {
      params.set("search", search);
    } else {
      params.delete("search");
    }

    if (category && category !== "all") {
      params.set("category", category);
    } else {
      params.delete("category");
    }

    if (model && model !== "all") {
      params.set("model", model);
    } else {
      params.delete("model");
    }

    if (status && status !== "all") {
      params.set("status", status);
    } else {
      params.delete("status");
    }

    // Reset to page 1 when filters change
    params.delete("page");

    startTransition(() => {
      router.push(`/history?${params.toString()}`);
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateFilters();
  };

  const handleClearFilters = () => {
    setSearch("");
    setCategory("all");
    setModel("all");
    setStatus("all");
    startTransition(() => {
      router.push("/history");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search benchmarks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Filter */}
        <Select
          value={category}
          onValueChange={setCategory}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.name}>
                {cat.name.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Model Filter */}
        <Select
          value={model}
          onValueChange={setModel}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Models</SelectItem>
            {models.slice(0, 20).map((m) => (
              <SelectItem key={m} value={m}>
                {m.length > 25 ? m.slice(0, 25) + "..." : m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={status}
          onValueChange={setStatus}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="RUNNING">Running</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="TIMEOUT">Timeout</SelectItem>
          </SelectContent>
        </Select>

        {/* Apply Filters Button */}
        <Button type="submit" disabled={isPending}>
          <Filter className="h-4 w-4 mr-2" />
          Apply
        </Button>

        {/* Clear Filters Button */}
        {(search || category !== "all" || model !== "all" || status !== "all") && (
          <Button type="button" variant="outline" onClick={handleClearFilters} disabled={isPending}>
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}
