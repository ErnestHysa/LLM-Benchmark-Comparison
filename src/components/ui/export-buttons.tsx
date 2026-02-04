/**
 * Export Buttons Component
 *
 * Client component for exporting benchmark results
 */

"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  exportToCSV,
  exportToJSON,
  type ExportableResult,
} from "@/lib/export";

interface ExportButtonsProps {
  data: ExportableResult;
  className?: string;
}

export function ExportButtons({ data, className }: ExportButtonsProps) {
  return (
    <div className={className}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportToCSV(data)}
      >
        <Download className="h-4 w-4 mr-2" />
        CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportToJSON(data)}
      >
        <Download className="h-4 w-4 mr-2" />
        JSON
      </Button>
    </div>
  );
}
