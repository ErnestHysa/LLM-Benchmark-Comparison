/**
 * Chart Components
 *
 * Reusable chart components for visualizing data
 */

'use client';

import { cn } from '@/lib/utils';

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
  }>;
}

export interface ChartProps {
  data: ChartData;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  className?: string;
}

/**
 * Simple SVG Line Chart - Base Implementation
 */
function LineChartImpl({ data, height = 300, className }: ChartProps) {
  const allData = data.datasets.flatMap((d) => d.data);
  const maxDataValue = allData.length > 0 ? Math.max(...allData) : 100;
  const width = 800;
  const chartHeight = height || 300;
  const padding = 40;

  return (
    <div className={cn('relative w-full overflow-x-auto', className)}>
      <svg width={width} height={chartHeight} className="overflow-visible">
        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <g key={`grid-${pct}`}>
            <line
              x1={padding}
              y1={pct * (chartHeight - padding)}
              x2={width - padding}
              y2={pct * (chartHeight - padding)}
              stroke="#e5e7eb"
              strokeWidth="1"
              strokeDasharray="4"
            />
            <text
              x={padding - 5}
              y={pct * (chartHeight - padding) + 4}
              textAnchor="end"
              fontSize="10"
              fill="#6b7280"
            >
              {Math.round(maxDataValue * (1 - pct))}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {data.labels.map((label, i) => {
          const x = padding + (i / (data.labels.length - 1 || 1)) * (width - 2 * padding);
          return (
            <g key={`label-${i}`}>
              <text
                x={x}
                y={chartHeight - 5}
                textAnchor="middle"
                fontSize="10"
                fill="#6b7280"
                className="text-muted-foreground"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Data lines */}
        {data.datasets.map((dataset, datasetIndex) => (
          <g key={`dataset-${datasetIndex}`}>
            <polyline
              fill="none"
              stroke={dataset.borderColor || '#3b82f6'}
              strokeWidth="2"
              points={dataset.data.map((val, j) => {
                const x = padding + (j / (dataset.data.length - 1 || 1)) * (width - 2 * padding);
                const y = (chartHeight - padding) - ((val / maxDataValue) * (chartHeight - padding));
                return `${x},${y}`;
              }).join(' ')}
            />
            {/* Data points */}
            {dataset.data.map((val, j) => {
              const x = padding + (j / (dataset.data.length - 1 || 1)) * (width - 2 * padding);
              const y = (chartHeight - padding) - ((val / maxDataValue) * (chartHeight - padding));
              return (
                <circle
                  key={`point-${j}`}
                  cx={x}
                  cy={y}
                  r="3"
                  fill={dataset.borderColor || '#3b82f6'}
                />
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

/**
 * Simple SVG Bar Chart - Base Implementation
 */
function BarChartImpl({ data, height = 300, className }: ChartProps) {
  const allData = data.datasets.flatMap((d) => d.data);
  const maxDataValue = allData.length > 0 ? Math.max(...allData) : 100;
  const width = 800;
  const chartHeight = height || 300;
  const padding = 40;

  const numLabels = data.labels.length;
  const numDatasets = data.datasets.length;
  const groupWidth = (width - 2 * padding) / numLabels;
  const barWidth = Math.max(10, (groupWidth / numDatasets) * 0.8);
  const barGap = (groupWidth - barWidth * numDatasets) / (numDatasets + 1);

  return (
    <div className={cn('relative w-full overflow-x-auto', className)}>
      <svg width={width} height={chartHeight} className="overflow-visible">
        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <g key={`grid-${pct}`}>
            <line
              x1={padding}
              y1={pct * (chartHeight - padding)}
              x2={width - padding}
              y2={pct * (chartHeight - padding)}
              stroke="#e5e7eb"
              strokeWidth="1"
              strokeDasharray="4"
            />
            <text
              x={padding - 5}
              y={pct * (chartHeight - padding) + 4}
              textAnchor="end"
              fontSize="10"
              fill="#6b7280"
            >
              {Math.round(maxDataValue * (1 - pct))}
            </text>
          </g>
        ))}

        {/* X-axis labels and bars */}
        {data.labels.map((label, labelIndex) => {
          const groupX = padding + labelIndex * groupWidth;

          return (
            <g key={`group-${labelIndex}`}>
              {/* X-axis label */}
              <text
                x={groupX + groupWidth / 2}
                y={chartHeight - 5}
                textAnchor="middle"
                fontSize="10"
                fill="#6b7280"
                className="text-muted-foreground"
              >
                {label}
              </text>

              {/* Bars for each dataset */}
              {data.datasets.map((dataset, datasetIndex) => {
                const value = dataset.data[labelIndex] || 0;
                const barHeight = (value / maxDataValue) * (chartHeight - padding);
                const y = (chartHeight - padding) - barHeight;
                const x = groupX + barGap + datasetIndex * (barWidth + barGap);

                return (
                  <rect
                    key={`bar-${datasetIndex}-${labelIndex}`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={dataset.backgroundColor || `hsl(${(labelIndex * 60) % 360}, 70%, 60%)`}
                    stroke={dataset.borderColor || `hsl(${(labelIndex * 60) % 360}, 70%, 50%)`}
                    strokeWidth="1"
                    rx="4"
                  />
                );
              })}
            </g>
          );
        })}

        {/* Legend */}
        {data.datasets.length > 1 && (
          <g transform={`translate(${width - 150}, 10)`}>
            {data.datasets.map((dataset, i) => (
              <g key={`legend-${i}`} transform={`translate(0, ${i * 20})`}>
                <rect
                  width="12"
                  height="12"
                  fill={dataset.backgroundColor || '#3b82f6'}
                  rx="2"
                />
                <text
                  x="20"
                  y="10"
                  fontSize="11"
                  fill="#374151"
                >
                  {dataset.label}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

// Export main components
export const LineChart = LineChartImpl;
export const BarChart = BarChartImpl;

// Export Simple* aliases
export const SimpleLineChart = LineChartImpl;
export const SimpleBarChart = BarChartImpl;
