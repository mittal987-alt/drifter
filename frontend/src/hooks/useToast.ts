import { useCallback, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

let globalToastFn: ((toast: Omit<Toast, "id">) => void) | null = null;

// Register the global toast function so non-React code (e.g., services) can trigger toasts
export function registerToastFn(fn: (toast: Omit<Toast, "id">) => void) {
  globalToastFn = fn;
}

export function toast(t: Omit<Toast, "id">) {
  if (globalToastFn) globalToastFn(t);
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    const newToast: Toast = { id, duration: 4500, ...t };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, newToast.duration);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
