import type { User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export function displayNameFromUser(user: User): string {
  const meta = user.user_metadata ?? {};
  const full =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    (typeof meta.given_name === "string" &&
      `${meta.given_name} ${typeof meta.family_name === "string" ? meta.family_name : ""}`.trim()) ||
    "";
  if (full) return full;
  return user.email?.split("@")[0]?.trim() || "مالك";
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
};

/**
 * Ensures public.profiles has a row for this auth user.
 * Links legacy profile rows (same email, old id) to the current auth id for OAuth upgrades.
 */
export async function ensureBrokerProfileForUser(user: User): Promise<void> {
  const admin = getSupabaseServerClient();
  const email = user.email?.trim().toLowerCase() ?? null;
  const name = displayNameFromUser(user);
  const avatarUrl = avatarUrlFromUser(user);
  const meta = user.user_metadata as Record<string, unknown>;
  const metaPhone =
    typeof meta.phone === "string" ? meta.phone.replace(/\s|-/g, "") : null;
  const phoneDirect =
    typeof user.phone === "string" ? user.phone.replace(/\s|-/g, "") : null;

  const { data: byId, error: byIdErr } = await admin
    .from("profiles")
    .select("id, name, email, phone, avatar_url, wallet_balance, role")
    .eq("id", user.id)
    .maybeSingle();

  if (byIdErr) {
    console.error("[ensureBrokerProfile] select by id:", byIdErr.message);
    return;
  }

  if (byId) {
    const patch: Record<string, unknown> = {};
    const rowName = typeof byId.name === "string" ? byId.name.trim() : "";
    if (name && (!rowName || rowName === "مالك")) patch.name = name;
    if (email && !byId.email) patch.email = email;
    if (avatarUrl && !byId.avatar_url) patch.avatar_url = avatarUrl;
    if (Object.keys(patch).length) {
      const { error } = await admin.from("profiles").update(patch).eq("id", user.id);
      if (error) console.error("[ensureBrokerProfile] patch:", error.message);
    }
    return;
  }

  if (email) {
    const { data: legacyRows, error: legErr } = await admin
      .from("profiles")
      .select("*")
      .eq("email", email);
    if (legErr) {
      console.error("[ensureBrokerProfile] legacy by email:", legErr.message);
    } else {
      const legacy = (legacyRows as ProfileRow[] | null)?.find((r) => r.id !== user.id);
      if (legacy) {
        const oldId = legacy.id;
        const mergedName = name || legacy.name?.trim() || "مالك";
        const mergedPhone = legacy.phone ?? metaPhone ?? phoneDirect;
        const mergedWallet =
          typeof legacy.wallet_balance === "number" ? legacy.wallet_balance : 0;
        const mergedRole = legacy.role || "broker";
        const mergedAvatar = avatarUrl ?? legacy.avatar_url;

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
          })
          .eq("id", oldId);

        if (!pkErr) {
          const { error: pErr } = await admin
            .from("properties")
            .update({ owner_id: user.id })
            .eq("owner_id", oldId);
          if (pErr) console.error("[ensureBrokerProfile] properties owner_id:", pErr.message);

          const { error: tErr } = await admin
            .from("transactions")
            .update({ broker_id: user.id })
            .eq("broker_id", oldId);
          if (tErr) console.error("[ensureBrokerProfile] transactions broker_id:", tErr.message);
          return;
        }

        console.warn("[ensureBrokerProfile] PK update failed, fallback insert:", pkErr.message);
        const { error: pErr } = await admin
          .from("properties")
          .update({ owner_id: user.id })
          .eq("owner_id", oldId);
        if (pErr) console.error("[ensureBrokerProfile] properties owner_id:", pErr.message);

        const { error: tErr } = await admin
          .from("transactions")
          .update({ broker_id: user.id })
          .eq("broker_id", oldId);
        if (tErr) console.error("[ensureBrokerProfile] transactions broker_id:", tErr.message);

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
          points: 0,
        });
        if (insErr) console.error("[ensureBrokerProfile] insert merged:", insErr.message);
        return;
      }
    }
  }

  const insertPayload: Record<string, unknown> = {
    id: user.id,
    name,
    phone: metaPhone || phoneDirect,
    role: "broker",
    wallet_balance: 0,
    points: 0,
  };
  if (email) insertPayload.email = email;
  if (avatarUrl) insertPayload.avatar_url = avatarUrl;

  const { error: insertError } = await admin.from("profiles").insert(insertPayload);
  if (insertError && insertError.code !== "23505") {
    console.error("[ensureBrokerProfile] insert:", insertError.message);
  }
}
