"use client";

/**
 * Sidebar Navigation Component
 *
 * Left sidebar (240px) with navigation links
 * Hidden on mobile, shown on lg screens and above
 * Dark mode, glassmorphism effect
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  History,
  Settings,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Shield,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/benchmarks", label: "Benchmarks", icon: Trophy },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/regression", label: "Regression", icon: TrendingUp },
  { href: "/fuzz", label: "Fuzz Testing", icon: Shield },
  { href: "/compare", label: "A/B Compare", icon: Scale },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 border-r border-border bg-surface/80 backdrop-blur-md flex flex-col animate-slide-in-left hidden lg:flex">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-fg font-bold text-sm">LLM</span>
          </div>
          <span className="font-semibold text-foreground">Bench</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-fast",
                isActive
                  ? "bg-primary text-primary-fg"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          v0.1.0 • Phase 2
        </p>
      </div>
    </aside>
  );
}
