"use client";

import { useEffect, useState } from "react";

/** Animates from 0 toward `target` when `target` or `depsKey` changes. */
export function useCountUp(target: number, depsKey: string, durationMs = 1000): number {
  const [v, setV] = useState(0);

  useEffect(() => {
    const t = Math.max(0, Math.floor(target));
    setV(0);
    let raf = 0;
    const start = performance.now();
    const ease = (x: number) => 1 - (1 - x) ** 3;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      setV(Math.round(t * ease(p)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setV(t);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, depsKey]);

  return v;
}
