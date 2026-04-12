/**
 * Next.js 16 can throw "Router action dispatched before initialization" if
 * router.refresh() runs in the same tick as navigation or during early mount.
 * Deferring to a microtask avoids that in most cases.
 */
export function safeRouterRefresh(router: { refresh: () => void }): void {
  queueMicrotask(() => {
    try {
      router.refresh();
    } catch {
      /* ignore */
    }
  });
}
