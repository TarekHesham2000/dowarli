import type { User } from "@supabase/supabase-js";

/** Full name from OAuth `user_metadata` (e.g. Google: full_name, name, given_name + family_name). */
export function nameFromUserMetadata(user: User): string {
  const meta = user.user_metadata ?? {};
  const full =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    (typeof meta.given_name === "string" &&
      `${meta.given_name} ${typeof meta.family_name === "string" ? meta.family_name : ""}`.trim()) ||
    "";
  return full;
}
