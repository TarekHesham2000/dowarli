/**
 * Public listings: include rows with no expiry, or with expires_at in the future
 * (request-time comparison — acceptable for RLS/anon API reads).
 */
export function orPublicListingNotExpired(): string {
  return `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`;
}

/** Postgres undefined_column / PostgREST when `properties.expires_at` was not migrated yet */
export function isMissingExpiresAtColumnError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  const msg = String(e.message ?? "").toLowerCase();
  if (!msg.includes("expires_at")) return false;
  if (e.code === "42703") return true;
  return msg.includes("does not exist") || msg.includes("undefined column");
}

/**
 * Browser-only: after the first failed query referencing `expires_at`, skip the filter until full reload
 * (avoids empty home feed before migration; full reload picks up the column after SQL is applied).
 */
let clientOmitListingExpiryOr = false;

export function resetClientListingExpiryFilterCache(): void {
  clientOmitListingExpiryOr = false;
}

export function suppressClientListingExpiryFilterIfMissingColumn(error: unknown): void {
  if (isMissingExpiresAtColumnError(error)) {
    clientOmitListingExpiryOr = true;
  }
}

/** Use from client components only — pairs with {@link suppressClientListingExpiryFilterIfMissingColumn}. */
export function maybeClientPublicListingExpiryOr(): string | null {
  if (clientOmitListingExpiryOr) return null;
  return orPublicListingNotExpired();
}

type PostgrestMaybeResult<T> = { data: T; error: unknown };

/**
 * Server-safe: try with `expires_at` filter first; if the column is missing in DB, retry without it.
 * Does not use global state (safe across requests after you add the column).
 */
export async function withListingExpiryQuery<T>(
  run: (includeExpiry: boolean) => PromiseLike<PostgrestMaybeResult<T>>,
): Promise<PostgrestMaybeResult<T>> {
  const first = await run(true);
  if (!first.error) return first;
  if (!isMissingExpiresAtColumnError(first.error)) return first;
  return run(false);
}
