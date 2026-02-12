/**
 * Table Components
 *
 * Re-usable table components for data display
 */

'use client';

import { cn } from '@/lib/utils';

export { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Table cell component
 */
interface CellProps {
  className?: string;
  children: React.ReactNode;
}

export function Cell({ className, children }: CellProps) {
  return (
    <div
      className={cn(
        'h-12 w-12 text-center text-sm font-mono border-r border-border',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Table cell header component
 */
export interface CellHeaderProps {
  className?: string;
  children: React.ReactNode;
  colSpan?: number;
}

export function CellHeader({ className, children, colSpan = 1 }: CellHeaderProps) {
  const spanStyle = colSpan > 1 ? { gridColumn: `span ${colSpan}` } : undefined;

  return (
    <div
      className={cn(
        'h-12 px-3 text-left text-xs font-semibold border-b border-border bg-muted',
        className
      )}
      style={spanStyle}
    >
      {children}
    </div>
  );
}

// Re-export as Table, TableHeader, TableBody, TableRow, TableCell, TableHead for compatibility
export { Cell as Table, CellHeader as TableHeader, Cell as TableCell, Cell as TableRow, CellHeader as TableHead };
export { Cell as TableBody };
