import type { SupabaseClient, User } from "@supabase/supabase-js";
import { WELCOME_POINTS_BONUS } from "@/lib/pointsConfig";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

/** Display name from OAuth metadata only (no email / default fallback). Used for merge conflict rules. */
export function nameFromOAuthMetadata(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const full =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    (typeof meta.given_name === "string" &&
      `${meta.given_name} ${typeof meta.family_name === "string" ? meta.family_name : ""}`.trim()) ||
    "";
  return full || null;
}

export function displayNameFromUser(user: User): string {
  return nameFromOAuthMetadata(user) || user.email?.split("@")[0]?.trim() || "مالك";
}

export function avatarUrlFromUser(user: User): string | null {
  const meta = user.user_metadata as Record<string, unknown>;
  const a = meta.avatar_url;
  if (typeof a === "string" && a.startsWith("http")) return a;
  const p = meta.picture;
  if (typeof p === "string" && p.startsWith("http")) return p;
  if (p && typeof p === "object" && p !== null && "data" in p) {
    const url = (p as { data?: { url?: string } }).data?.url;
    if (typeof url === "string" && url.startsWith("http")) return url;
  }
  return null;
}

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  wallet_balance: number | null;
  role: string | null;
  points?: number | null;
};

const PLACEHOLDER_NAME = "مالك";

function normalizedDigits(s: string | null | undefined): string {
  return String(s ?? "").replace(/\s|-/g, "").trim();
}

function hasMeaningfulPhone(phone: string | null | undefined): boolean {
  return normalizedDigits(phone).length > 0;
}

function hasMeaningfulStoredName(name: string | null | undefined): boolean {
  const t = typeof name === "string" ? name.trim() : "";
  return t.length > 0 && t !== PLACEHOLDER_NAME;
}

function resolveMergedName(legacy: ProfileRow, user: User): string {
  if (hasMeaningfulStoredName(legacy.name)) return String(legacy.name).trim();
  const oauth = nameFromOAuthMetadata(user)?.trim();
  if (oauth) return oauth;
  const leg = typeof legacy.name === "string" ? legacy.name.trim() : "";
  if (leg) return leg;
  return displayNameFromUser(user);
}

function resolveMergedPhone(
  legacy: ProfileRow,
  metaPhone: string | null,
  phoneDirect: string | null,
): string | null {
  if (hasMeaningfulPhone(legacy.phone)) return legacy.phone;
  const fromAuth = metaPhone || phoneDirect;
  if (fromAuth) return fromAuth;
  return legacy.phone ?? null;
}

function resolveMergedAvatar(googleAvatar: string | null, legacy: ProfileRow): string | null {
  if (googleAvatar) return googleAvatar;
  return legacy.avatar_url ?? null;
}

async function repointProfileForeignKeys(
  admin: SupabaseClient,
  oldProfileId: string,
  newProfileId: string,
): Promise<void> {
  const { error: pErr } = await admin
    .from("properties")
    .update({ owner_id: newProfileId })
    .eq("owner_id", oldProfileId);
  if (pErr) console.error("[ensureBrokerProfile] properties owner_id:", pErr.message);

  const { error: tErr } = await admin
    .from("transactions")
    .update({ broker_id: newProfileId })
    .eq("broker_id", oldProfileId);
  if (tErr) console.error("[ensureBrokerProfile] transactions broker_id:", tErr.message);

  const { error: eErr } = await admin
    .from("broker_under_review_events")
    .update({ broker_id: newProfileId })
    .eq("broker_id", oldProfileId);
  if (eErr && !String(eErr.message ?? "").includes("does not exist")) {
    console.error("[ensureBrokerProfile] broker_under_review_events:", eErr.message);
  }
}

/**
 * Legacy account (same email, older auth id) → current session user row (e.g. Google).
 * Keeps ads/points on the unified profile id = user.id.
 */
async function absorbLegacyProfileIntoSessionRow(
  admin: SupabaseClient,
  user: User,
  current: ProfileRow,
  legacy: ProfileRow,
  email: string,
  metaPhone: string | null,
  phoneDirect: string | null,
): Promise<void> {
  const oldId = legacy.id;
  const avatarUrl = avatarUrlFromUser(user);

  const mergedName = resolveMergedName(legacy, user);
  const mergedPhone = resolveMergedPhone(legacy, metaPhone, phoneDirect);
  const mergedAvatar = resolveMergedAvatar(avatarUrl, legacy);
  const mergedPoints = Number(legacy.points ?? 0) + Number(current.points ?? 0);
  const mergedWallet =
    (typeof legacy.wallet_balance === "number" ? legacy.wallet_balance : 0) +
    (typeof current.wallet_balance === "number" ? current.wallet_balance : 0);
  const mergedRole = legacy.role || current.role || "broker";

  await repointProfileForeignKeys(admin, oldId, user.id);

  const { error: upErr } = await admin
    .from("profiles")
    .update({
      name: mergedName,
      email,
      phone: mergedPhone,
      avatar_url: mergedAvatar,
      wallet_balance: mergedWallet,
      role: mergedRole,
      points: mergedPoints,
    })
    .eq("id", user.id);

  if (upErr) {
    console.error("[ensureBrokerProfile] absorb merge update:", upErr.message);
    return;
  }

  const { error: delErr } = await admin.from("profiles").delete().eq("id", oldId);
  if (delErr) console.error("[ensureBrokerProfile] absorb delete legacy:", delErr.message);
}

/**
 * Ensures public.profiles has a row for this auth user.
 * Links legacy profile rows (same email, old id) to the current auth id for OAuth upgrades.
 */
export async function ensureBrokerProfileForUser(user: User): Promise<void> {
  const admin = getSupabaseServerClient();
  const email = user.email?.trim().toLowerCase() ?? null;
  const avatarUrl = avatarUrlFromUser(user);
  const meta = user.user_metadata as Record<string, unknown>;
  const metaPhone =
    typeof meta.phone === "string" ? meta.phone.replace(/\s|-/g, "") : null;
  const phoneDirect =
    typeof user.phone === "string" ? user.phone.replace(/\s|-/g, "") : null;

  const { data: byId, error: byIdErr } = await admin
    .from("profiles")
    .select("id, name, email, phone, avatar_url, wallet_balance, role, points")
    .eq("id", user.id)
    .maybeSingle();

  if (byIdErr) {
    console.error("[ensureBrokerProfile] select by id:", byIdErr.message);
    return;
  }

  let legacy: ProfileRow | undefined;
  if (email) {
    const { data: legacyRows, error: legErr } = await admin
      .from("profiles")
      .select("*")
      .eq("email", email);
    if (legErr) {
      console.error("[ensureBrokerProfile] legacy by email:", legErr.message);
    } else {
      legacy = (legacyRows as ProfileRow[] | null)?.find((r) => r.id !== user.id);
    }
  }

  if (byId && legacy) {
    await absorbLegacyProfileIntoSessionRow(admin, user, byId as ProfileRow, legacy, email!, metaPhone, phoneDirect);
    return;
  }

  if (byId) {
    const patch: Record<string, unknown> = {};
    const rowName = typeof byId.name === "string" ? byId.name.trim() : "";
    const oauthName = nameFromOAuthMetadata(user)?.trim();
    if (!hasMeaningfulStoredName(rowName)) {
      const nextName = oauthName || (!rowName || rowName === PLACEHOLDER_NAME ? displayNameFromUser(user) : null);
      if (nextName) patch.name = nextName;
    }
    if (email && !byId.email) patch.email = email;
    if (avatarUrl && !byId.avatar_url) patch.avatar_url = avatarUrl;
    if (!hasMeaningfulPhone(byId.phone)) {
      const p = metaPhone || phoneDirect;
      if (p) patch.phone = p;
    }
    if (Object.keys(patch).length) {
      const { error } = await admin.from("profiles").update(patch).eq("id", user.id);
      if (error) console.error("[ensureBrokerProfile] patch:", error.message);
    }
    return;
  }

  if (email && legacy) {
    const oldId = legacy.id;
    const mergedName = resolveMergedName(legacy, user);
    const mergedPhone = resolveMergedPhone(legacy, metaPhone, phoneDirect);
    const mergedWallet =
      typeof legacy.wallet_balance === "number" ? legacy.wallet_balance : 0;
    const mergedRole = legacy.role || "broker";
    const mergedAvatar = resolveMergedAvatar(avatarUrl, legacy);
    const mergedPoints = Number(legacy.points ?? 0);

    await admin.from("profiles").delete().eq("id", user.id);

    const { error: pkErr } = await admin
      .from("profiles")
      .update({
        id: user.id,
        name: mergedName,
        email,
        phone: mergedPhone,
        avatar_url: mergedAvatar,
        wallet_balance: mergedWallet,
        role: mergedRole,
        points: mergedPoints,
      })
      .eq("id", oldId);

    if (!pkErr) {
      await repointProfileForeignKeys(admin, oldId, user.id);
      return;
    }

    console.warn("[ensureBrokerProfile] PK update failed, fallback insert:", pkErr.message);
    await repointProfileForeignKeys(admin, oldId, user.id);

    const { error: delLegacyErr } = await admin.from("profiles").delete().eq("id", oldId);
    if (delLegacyErr) console.error("[ensureBrokerProfile] delete legacy:", delLegacyErr.message);

    const { error: insErr } = await admin.from("profiles").insert({
      id: user.id,
      name: mergedName,
      email,
      phone: mergedPhone,
      avatar_url: mergedAvatar,
      wallet_balance: mergedWallet,
      role: mergedRole,
      points: mergedPoints,
    });
    if (insErr) console.error("[ensureBrokerProfile] insert merged:", insErr.message);
    return;
  }

  const insertPayload: Record<string, unknown> = {
    id: user.id,
    name: displayNameFromUser(user),
    phone: metaPhone || phoneDirect,
    role: "broker",
    wallet_balance: 0,
    points: WELCOME_POINTS_BONUS,
  };
  if (email) insertPayload.email = email;
  if (avatarUrl) insertPayload.avatar_url = avatarUrl;

  const { error: insertError } = await admin.from("profiles").insert(insertPayload);
  if (insertError && insertError.code !== "23505") {
    console.error("[ensureBrokerProfile] insert:", insertError.message);
  }
}
