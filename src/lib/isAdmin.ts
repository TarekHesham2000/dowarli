/**
 * Admin access is derived from `public.profiles`.
 * Primary: `role === 'admin'`.
 * Optional: `is_admin === true` if you add column via `sql/profiles_is_admin_flag.sql`.
 */
export type AdminProfileRow = {
  role?: string | null;
  is_admin?: boolean | null;
};

export function isAdminProfile(profile: AdminProfileRow | null | undefined): boolean {
  if (!profile) return false;
  if (profile.is_admin === true) return true;
  return profile.role === "admin";
}
