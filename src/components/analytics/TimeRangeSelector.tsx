/**
 * Time Range Selector Component
 *
 * Dropdown for selecting time periods
 */

'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TimeRangeSelectorProps {
  value: '7d' | '30d' | '90d' | 'all';
  onChange: (value: '7d' | '30d' | '90d' | 'all') => void;
  disabled?: boolean;
}

const OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
] as const;

export function TimeRangeSelector({
  value,
  onChange,
  disabled = false,
}: TimeRangeSelectorProps) {
  return (
    <div className="flex-1 min-w-[150px]">
      <label className="text-sm font-medium mb-2 block">Time Period</label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
