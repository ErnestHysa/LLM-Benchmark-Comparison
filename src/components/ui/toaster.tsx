/**
 * Toaster Component
 *
 * Client component that renders toast notifications
 */

"use client";

import { useEffect, useState } from "react";
import type { ToastMessage } from "./toast";
import { Toaster as ToastUi } from "./toast";

// Store for toast messages (module-level for cross-component access)
let toastMessages: ToastMessage[] = [];
const listeners = new Set<(toasts: ToastMessage[]) => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener([...toastMessages]));
}

function removeToast(id: string): void {
  toastMessages = toastMessages.filter((t) => t.id !== id);
  notifyListeners();
}

export function addToast(toast: Omit<ToastMessage, "id">): string {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const newToast: ToastMessage = { ...toast, id };
  toastMessages = [...toastMessages, newToast];
  notifyListeners();

  // Auto-remove after duration
  const duration = toast.duration ?? 5000;
  setTimeout(() => {
    removeToast(id);
  }, duration);

  return id;
}

export { removeToast };

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    // Initial load
    setToasts(toastMessages);

    // Listen for updates
    const update = (newToasts: ToastMessage[]) => {
      setToasts(newToasts);
    };

    listeners.add(update);

    return () => {
      listeners.delete(update);
    };
  }, []);

  return <ToastUi toasts={toasts} onRemove={(id) => removeToast(id)} />;
}
