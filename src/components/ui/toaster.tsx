"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info" | "default";

export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastItem = ToastInput & {
  id: number;
  state: "open" | "closed";
};

type Ctx = {
  toast: (t: ToastInput) => number;
  success: (title: string, description?: string) => number;
  error: (title: string, description?: string) => number;
  info: (title: string, description?: string) => number;
  dismiss: (id: number) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

const DEFAULT_DURATION = 3500;
const ANIM_OUT_MS = 180;

let nextId = 1;

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, number>>(new Map());

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, state: "closed" } : t)));
      const t = timers.current.get(id);
      if (t) {
        window.clearTimeout(t);
        timers.current.delete(id);
      }
      window.setTimeout(() => remove(id), ANIM_OUT_MS);
    },
    [remove],
  );

  const push = useCallback(
    (input: ToastInput): number => {
      const id = nextId++;
      const item: ToastItem = {
        id,
        state: "open",
        variant: input.variant ?? "default",
        title: input.title,
        description: input.description,
        durationMs: input.durationMs,
      };
      setItems((prev) => [...prev, item]);
      const dur = input.durationMs ?? DEFAULT_DURATION;
      if (dur > 0) {
        const handle = window.setTimeout(() => dismiss(id), dur);
        timers.current.set(id, handle);
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    return () => {
      timers.current.forEach((h) => window.clearTimeout(h));
      timers.current.clear();
    };
  }, []);

  const api = useMemo<Ctx>(
    () => ({
      toast: push,
      success: (title, description) => push({ title, description, variant: "success" }),
      error: (title, description) =>
        push({ title, description, variant: "error", durationMs: 5000 }),
      info: (title, description) => push({ title, description, variant: "info" }),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastCtx.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    // Safe no-op when used outside provider — avoids crashes during early renders.
    return {
      toast: () => 0,
      success: () => 0,
      error: () => 0,
      info: () => 0,
      dismiss: () => undefined,
    };
  }
  return ctx;
}

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-4 sm:bottom-4 sm:left-auto sm:right-4 sm:items-end sm:px-0 sm:pb-0"
    >
      {items.map((t) => (
        <ToastView key={t.id} item={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const Icon =
    item.variant === "success"
      ? CheckCircle2
      : item.variant === "error"
        ? TriangleAlert
        : item.variant === "info"
          ? Info
          : null;

  const accent =
    item.variant === "success"
      ? "before:bg-emerald-500"
      : item.variant === "error"
        ? "before:bg-destructive"
        : item.variant === "info"
          ? "before:bg-sky-500"
          : "before:bg-foreground/30";

  const iconColor =
    item.variant === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : item.variant === "error"
        ? "text-destructive"
        : item.variant === "info"
          ? "text-sky-600 dark:text-sky-400"
          : "text-foreground";

  return (
    <div
      role="status"
      data-state={item.state}
      className={cn(
        "pointer-events-auto relative flex w-full max-w-sm items-start gap-2.5 overflow-hidden rounded-lg border bg-popover p-3 pr-9 text-popover-foreground shadow-lg ring-1 ring-foreground/5",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        accent,
        "transition-all duration-200 ease-out",
        "data-[state=open]:translate-y-0 data-[state=open]:opacity-100",
        "data-[state=closed]:translate-y-2 data-[state=closed]:opacity-0",
      )}
      style={{ transform: item.state === "open" ? undefined : "translateY(8px)" }}
    >
      {Icon && (
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconColor)} aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
