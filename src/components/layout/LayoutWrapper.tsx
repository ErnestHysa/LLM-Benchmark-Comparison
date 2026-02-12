"use client";

/**
 * Layout Wrapper Component
 *
 * Manages mobile menu state and renders sidebar, header, and main content
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  History,
  Settings,
  X,
  BarChart3,
  TrendingUp,
  Shield,
  Scale,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { Button } from "@/components/ui/button";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Mobile Sidebar */}
          <div className="fixed left-0 top-0 z-50 h-screen w-64 border-r border-border bg-surface flex flex-col lg:hidden animate-slide-in-left">
            {/* Logo with close button */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-border">
              <Link
                href="/"
                className="flex items-center gap-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-fg font-bold text-sm">LLM</span>
                </div>
                <span className="font-semibold text-foreground">Bench</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                className="lg:hidden"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Navigation - matches Sidebar */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {[
                { href: "/", label: "Dashboard", icon: LayoutDashboard },
                { href: "/benchmarks", label: "Benchmarks", icon: Trophy },
                { href: "/batch", label: "Batch Run", icon: Layers },
                { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
                { href: "/analytics", label: "Analytics", icon: BarChart3 },
                { href: "/regression", label: "Regression", icon: TrendingUp },
                { href: "/fuzz", label: "Fuzz Testing", icon: Shield },
                { href: "/compare", label: "A/B Compare", icon: Scale },
                { href: "/history", label: "History", icon: History },
                { href: "/settings", label: "Settings", icon: Settings },
              ].map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-fast",
                      isActive
                        ? "bg-primary text-primary-fg"
                        : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                v1.0.0 • Production Ready
              </p>
            </div>
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col w-full lg:ml-60">
        <Header
          mobileMenuOpen={mobileMenuOpen}
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <main
          id="main-content"
          className="flex-1 p-3 sm:p-4 lg:p-8"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
