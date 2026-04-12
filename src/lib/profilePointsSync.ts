/** Fired after local actions that change `profiles.points` so UI can refetch. */
export const POINTS_CHANGED_EVENT = "dowarli:points-changed";

export function notifyPointsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(POINTS_CHANGED_EVENT));
}
