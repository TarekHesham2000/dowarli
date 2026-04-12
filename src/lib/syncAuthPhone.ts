import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { EGYPTIAN_PHONE_REGEX, toE164Egypt } from "@/lib/egyptianPhone";

/**
 * Copies `profiles.phone` into `auth.users.phone` so `signInWithPassword({ phone })` works
 * for accounts that registered with email+password while phone lived only on `profiles`.
 */
export async function syncAuthPhoneFromProfileForUserId(userId: string): Promise<void> {
  const admin = getSupabaseServerClient();
  const { data: prof, error: pe } = await admin.from("profiles").select("phone").eq("id", userId).maybeSingle();
  if (pe || !prof?.phone) return;

  const cleaned = String(prof.phone).replace(/\s|-/g, "");
  if (!cleaned) return;
  const local = cleaned.startsWith("+20") ? `0${cleaned.slice(3)}` : cleaned;
  if (!EGYPTIAN_PHONE_REGEX.test(local)) return;

  const e164 = toE164Egypt(local);

  const { data: uData, error: ue } = await admin.auth.admin.getUserById(userId);
  if (ue || !uData.user) return;

  const current = (uData.user.phone ?? "").replace(/\s/g, "");
  const target = e164.replace(/\s/g, "");
  if (current === target) return;

  const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
    phone: e164,
    phone_confirm: true,
  });
  if (updErr) {
    console.error("[syncAuthPhoneFromProfile]", updErr.message);
  }
}
