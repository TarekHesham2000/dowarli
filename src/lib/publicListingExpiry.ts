/**
 * Public listings: include rows with no expiry, or with expires_at in the future
 * (request-time comparison — acceptable for RLS/anon API reads).
 */
export function orPublicListingNotExpired(): string {
  return `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`;
}
