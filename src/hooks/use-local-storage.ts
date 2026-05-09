"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

type Setter<T> = (value: T | ((prev: T) => T)) => void;

const subscribers = new Map<string, Set<() => void>>();

function getSubscriberSet(key: string) {
  let s = subscribers.get(key);
  if (!s) {
    s = new Set();
    subscribers.set(key, s);
  }
  return s;
}

function notify(key: string) {
  subscribers.get(key)?.forEach((cb) => cb());
}

export function useLocalStorage<T>(
  key: string,
  initial: T | (() => T),
): [T, Setter<T>, boolean] {
  const initialRef = useRef<{ value: T } | null>(null);
  if (initialRef.current === null) {
    initialRef.current = {
      value: typeof initial === "function" ? (initial as () => T)() : initial,
    };
  }

  const subscribe = useCallback(
    (cb: () => void) => {
      const set = getSubscriberSet(key);
      set.add(cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) cb();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        set.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key],
  );

  const getSnapshot = useCallback((): string | null => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);

  const getServerSnapshot = useCallback((): string | null => null, []);

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const value: T = useMemo(() => {
    if (raw === null) return initialRef.current!.value;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initialRef.current!.value;
    }
  }, [raw]);

  const set: Setter<T> = useCallback(
    (next) => {
      let prev: T;
      try {
        const r = window.localStorage.getItem(key);
        prev = r === null ? initialRef.current!.value : (JSON.parse(r) as T);
      } catch {
        prev = initialRef.current!.value;
      }
      const resolved =
        typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // ignore quota errors
      }
      notify(key);
    },
    [key],
  );

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  return [value, set, hydrated];
}
