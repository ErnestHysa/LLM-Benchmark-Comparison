/**
 * AlertsPanel Component
 *
 * Displays regression alerts with ability to acknowledge them
 */

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  TrendingDown,
  X,
} from "lucide-react";

interface RegressionAlert {
  id: string;
  alertType: string;
  severity: string;
  message: string;
  acknowledged: boolean;
  createdAt: Date;
  regressionRun: {
    id: string;
    totalScore: number | null;
    previousScore: number | null;
    startedAt: Date;
    baseline: {
      id: string;
      name: string;
    };
  };
}

interface AlertsPanelProps {
  alerts: RegressionAlert[];
}

function getAlertIcon(alertType: string) {
  switch (alertType) {
    case "score_dropped":
    case "regression":
      return <TrendingDown className="h-5 w-5" />;
    case "threshold_failed":
      return <AlertTriangle className="h-5 w-5" />;
    default:
      return <Bell className="h-5 w-5" />;
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-error/10 text-error border-error/20";
    case "warning":
      return "bg-warning/10 text-warning border-warning/20";
    default:
      return "bg-info/10 text-info border-info/20";
  }
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const handleAcknowledge = async (alertId: string) => {
    setAcknowledging(alertId);
    try {
      const response = await fetch(`/api/regression/alerts/${alertId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledged: true }),
      });

      if (response.ok) {
        // Remove from list
        window.location.reload();
      }
    } finally {
      setAcknowledging(null);
    }
  };

  const handleDelete = async (alertId: string) => {
    if (!confirm("Are you sure you want to delete this alert?")) {
      return;
    }

    setAcknowledging(alertId);
    try {
      const response = await fetch(`/api/regression/alerts/${alertId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        window.location.reload();
      }
    } finally {
      setAcknowledging(null);
    }
  };

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-success" />
          <p className="font-medium">No alerts</p>
          <p className="text-sm mt-2">All regression tests are passing!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Recent Alerts ({alerts.length})
        </h3>
      </div>

      {alerts.map((alert) => (
        <Card
          key={alert.id}
          className={`border-l-4 ${
            alert.severity === "critical"
              ? "border-l-error"
              : alert.severity === "warning"
              ? "border-l-warning"
              : "border-l-info"
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}>
                  {getAlertIcon(alert.alertType)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">
                      {alert.regressionRun.baseline.name}
                    </span>
                    <Badge variant="outline" className={`text-xs ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground">{alert.message}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{new Date(alert.createdAt).toLocaleString()}</span>
                    {alert.regressionRun.totalScore !== null && (
                      <span>
                        Score: {alert.regressionRun.totalScore.toFixed(1)}
                        {alert.regressionRun.previousScore !== null &&
                          ` (was ${alert.regressionRun.previousScore.toFixed(1)})`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {!alert.acknowledged && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAcknowledge(alert.id)}
                    disabled={acknowledging === alert.id}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {acknowledging === alert.id ? "..." : "Acknowledge"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(alert.id)}
                    disabled={acknowledging === alert.id}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
