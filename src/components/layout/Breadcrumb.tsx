/**
 * Breadcrumb Component
 *
 * Hierarchical navigation with proper styling
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={cn("flex items-center gap-1 text-sm text-muted-foreground", className)}>
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/50" />
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-foreground transition-colors duration-fast"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

/**
 * Hook to generate breadcrumb items from pathname
 */
export function getBreadcrumbItems(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);

  const items: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
  ];

  let href = "";
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) continue;
    href += `/${segment}`;

    // Format segment label
    const label = segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    items.push({
      label,
      href: i < segments.length - 1 ? href : undefined,
    });
  }

  return items;
}
