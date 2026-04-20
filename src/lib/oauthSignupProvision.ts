import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { displayNameFromUser } from "@/lib/authProfile";
import { isValidAgencySlugAscii, suggestedAgencySlugAsciiFromName } from "@/lib/agencySlug";

export type OAuthSignupUserType = "broker" | "owner";

/**
 * Google OAuth «signup» extras: property owners get profile only (no agency row).
 * Brokers get a minimal `agencies` row when missing (same shape as /become-an-agency).
 */
export async function provisionOAuthSignupAgencyIfBroker(
  svc: SupabaseClient,
  user: User,
  userType: OAuthSignupUserType,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (userType === "owner") {
    return { ok: true };
  }

  const { data: existingAg, error: exErr } = await svc
    .from("agencies")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (exErr) {
    return { ok: false, reason: exErr.message };
  }
  if (existingAg?.id) {
    return { ok: true };
  }

  const { data: prof, error: profErr } = await svc.from("profiles").select("name").eq("id", user.id).maybeSingle();
  if (profErr) {
    return { ok: false, reason: profErr.message };
  }

  let displayName =
    (typeof prof?.name === "string" && prof.name.trim().length >= 2 ? prof.name.trim() : "") ||
    displayNameFromUser(user);
  if (displayName.trim().length < 2) {
    displayName = `Agency ${user.id.replace(/-/g, "").slice(0, 10)}`;
  }

  let baseSlug = suggestedAgencySlugAsciiFromName(displayName);
  if (!isValidAgencySlugAscii(baseSlug)) {
    baseSlug = `agency-${user.id.replace(/-/g, "").slice(0, 12)}`;
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
    const { data: taken } = await svc.from("agencies").select("id").eq("slug", slug).maybeSingle();
    if (taken?.id) continue;

    let insertPayload: Record<string, unknown> = {
      name: displayName,
      slug,
      bio: null,
      logo_url: null,
      owner_id: user.id,
      subscription_status: "free",
      is_verified: false,
    };

    let ins = await svc.from("agencies").insert(insertPayload).select("id").single();
    for (let guard = 0; guard < 4 && ins.error; guard++) {
      if (ins.error.code === "23505" || String(ins.error.message).includes("unique")) break;
      const msg = String(ins.error.message).toLowerCase();
      if (ins.error.code !== "42703" && !msg.includes("does not exist") && !msg.includes("column")) break;

      if (msg.includes("status") && "status" in insertPayload) {
        const { status: _s, ...rest } = insertPayload;
        insertPayload = rest;
        ins = await svc.from("agencies").insert(insertPayload).select("id").single();
        continue;
      }
      if (msg.includes("is_active") && "is_active" in insertPayload) {
        const { is_active: _a, ...rest } = insertPayload;
        insertPayload = rest;
        ins = await svc.from("agencies").insert(insertPayload).select("id").single();
        continue;
      }
      break;
    }

    if (ins.error) {
      if (ins.error.code === "23505" || String(ins.error.message).includes("unique")) continue;
      return { ok: false, reason: ins.error.message };
    }

    const agencyId = ins.data?.id as string | undefined;
    if (!agencyId) {
      return { ok: false, reason: "insert_missing_id" };
    }

    const { error: roleErr } = await svc.from("profiles").update({ role: "broker" }).eq("id", user.id);
    if (roleErr) {
      return { ok: false, reason: roleErr.message };
    }

    const { error: linkErr } = await svc
      .from("properties")
      .update({ agency_id: agencyId })
      .eq("owner_id", user.id)
      .is("agency_id", null);
    if (linkErr && !String(linkErr.message ?? "").includes("does not exist")) {
      return { ok: false, reason: linkErr.message };
    }

    return { ok: true };
  }

  return { ok: false, reason: "slug_exhausted" };
}

/** New Google accounts are «young»; older auth rows mean an existing user used the Signup tab. */
export function shouldApplyGoogleSignupProvisioning(isSignupIntent: boolean, user: User): boolean {
  if (!isSignupIntent) return false;
  const created = new Date(user.created_at ?? 0).getTime();
  if (!Number.isFinite(created) || created <= 0) return true;
  const ageMs = Date.now() - created;
  if (ageMs > 3 * 60 * 1000) {
    return false;
  }
  return true;
}
