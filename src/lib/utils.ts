import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number with commas
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

/**
 * Format a score as a percentage
 */
export function formatScore(score: number): string {
  return `${score.toFixed(1)}%`;
}

/**
 * Format a duration in seconds to human-readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/**
 * Spring physics configurations for Framer Motion
 */
export const motionConfig = {
  /** Snappy for buttons, toggles */
  snappy: {
    type: "spring" as const,
    stiffness: 500,
    damping: 30,
    mass: 1,
  },

  /** Playful for modals, popups */
  bouncy: {
    type: "spring" as const,
    stiffness: 300,
    damping: 15,
    mass: 1.2,
  },

  /** Smooth for page transitions */
  smooth: {
    type: "spring" as const,
    stiffness: 100,
    damping: 20,
    mass: 1,
  },
} as const;
