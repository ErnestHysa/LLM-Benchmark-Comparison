/**
 * Export Buttons Component
 *
 * Client component for exporting benchmark results
 */

"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToCSV, exportToJSON, exportToPDF, type ExportableResult } from "@/lib/export";
import { addToast } from "@/components/ui/toaster";

interface ExportButtonsProps {
  data: ExportableResult;
  className?: string;
}

export function ExportButtons({ data, className }: ExportButtonsProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className || ""}`}>
      <Button variant="outline" size="sm" onClick={() => exportToCSV(data)}>
        <Download className="mr-2 h-4 w-4" />
        CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => exportToJSON(data)}>
        <Download className="mr-2 h-4 w-4" />
        JSON
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          try {
            exportToPDF(data);
          } catch (error) {
            addToast({
              title: "PDF Export Failed",
              description:
                error instanceof Error
                  ? error.message
                  : "Could not open print window for PDF export.",
              variant: "error",
            });
          }
        }}
      >
        <Download className="mr-2 h-4 w-4" />
        PDF
      </Button>
    </div>
  );
}
