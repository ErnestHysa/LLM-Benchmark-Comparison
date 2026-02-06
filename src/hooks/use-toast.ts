/**
 * Toast Hook
 *
 * Client-side hook for displaying toast notifications
 */

"use client";

import { useState, useEffect } from "react";

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

export type ToastProps = {
  id?: string;
  title?: string;
  description: string;
  variant?: ToastVariant;
  duration?: number;
  action?: React.ReactNode;
};

type ToastMessage = ToastProps & { id: string };

let toastCount = 0;

export function generateId(): string {
  return `toast-${++toastCount}`;
}

// Global state for toasts (works without context)
let globalToasts: ToastMessage[] = [];
const globalListeners: Set<(toasts: ToastMessage[]) => void> = new Set();

function notifyListeners() {
  globalListeners.forEach((listener) => listener([...globalToasts]));
}

export function toast(props: ToastProps): string {
  const id = props.id ?? generateId();
  const newToast: ToastMessage = { ...props, id };

  globalToasts = [...globalToasts, newToast];
  notifyListeners();

  // Auto-remove after duration
  const duration = props.duration ?? 5000;
  setTimeout(() => {
    removeToast(id);
  }, duration);

  return id;
}

export function removeToast(id: string): void {
  globalToasts = globalToasts.filter((t) => t.id !== id);
  notifyListeners();
}

export function clearToasts(): void {
  globalToasts = [];
  notifyListeners();
}

// Convenience methods
export const toastSuccess = (description: string, title?: string) => {
  return toast({ description, title, variant: "success" });
};

export const toastError = (description: string, title?: string) => {
  return toast({ description, title, variant: "error", duration: 7000 });
};

export const toastWarning = (description: string, title?: string) => {
  return toast({ description, title, variant: "warning" });
};

export const toastInfo = (description: string, title?: string) => {
  return toast({ description, title, variant: "info" });
};

// Hook for components
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    globalListeners.add(setToasts);
    setToasts(globalToasts);

    return () => {
      globalListeners.delete(setToasts);
    };
  }, []);

  return {
    toasts,
    toast,
    removeToast,
    clearToasts,
    success: toastSuccess,
    error: toastError,
    warning: toastWarning,
    info: toastInfo,
  };
}
