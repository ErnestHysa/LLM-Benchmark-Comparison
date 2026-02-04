"use client";

/**
 * Score Card Component
 *
 * Displays a single metric with its value and trend
 */

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ScoreCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
  color?: "primary" | "success" | "warning" | "error" | "info";
}

const colorClasses = {
  primary: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  error: "text-error bg-error/10",
  info: "text-info bg-info/10",
};

export function ScoreCard({
  title,
  value,
  description,
  trend,
  icon,
  className,
  color = "primary",
}: ScoreCardProps) {
  return (
    <div className="animate-scale-in">
      <Card className={cn("card-hover", className)}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">{title}</p>
              <p className="text-2xl font-semibold text-foreground">{value}</p>
              {description && (
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            {icon && (
              <div className={cn("p-3 rounded-lg", colorClasses[color])}>
                {icon}
              </div>
            )}
          </div>
          {trend && (
            <div className="mt-4 flex items-center gap-1 text-xs">
              <span
                className={cn(
                  "font-medium",
                  trend.isPositive ? "text-success" : "text-error"
                )}
              >
                {trend.isPositive ? "+" : ""}
                {trend.value}%
              </span>
              <span className="text-muted-foreground">vs last week</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
