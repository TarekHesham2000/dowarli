"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "dowarli_agency_crm_opened_v1";
const MAX_IDS = 600;

function readSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

/** Persists which leads had the detail modal opened (client-only). */
export function useCrmOpenedLeadIds() {
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOpened(readSet());
    setReady(true);
  }, []);

  const markOpened = useCallback((id: string) => {
    const k = String(id);
    setOpened((prev) => {
      if (prev.has(k)) return prev;
      const next = new Set(prev);
      next.add(k);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next].slice(-MAX_IDS)));
      } catch {
        /* ignore quota */
      }
      return next;
    });
  }, []);

  return { opened, markOpened, ready };
}
