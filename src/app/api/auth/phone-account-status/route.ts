import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

const E164_EG = /^\+20(10|11|12|15)\d{8}$/;

/**
 * Service-role only. Used after a failed phone+password login to detect legacy
 * phone (e.g. OTP) accounts with no password — without exposing other details.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { phone?: string };
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!E164_EG.test(phone)) {
      return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
    }

    const admin = getSupabaseServerClient();
    let page = 1;
    const perPage = 100;
    let foundId: string | null = null;

    for (let i = 0; i < 40; i++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error("[phone-account-status] listUsers:", error.message);
        return NextResponse.json({ ok: false, error: "lookup_failed" }, { status: 500 });
      }
      const match = data.users.find((u) => u.phone === phone);
      if (match?.id) {
        foundId = match.id;
        break;
      }
      if (!data.users.length || data.users.length < perPage) break;
      page += 1;
    }

    if (!foundId) {
      return NextResponse.json({ ok: true, exists: false, needsPassword: false });
    }

    const { data: detail, error: gErr } = await admin.auth.admin.getUserById(foundId);
    if (gErr || !detail?.user) {
      return NextResponse.json({ ok: true, exists: true, needsPassword: false });
    }

    const raw = detail.user as unknown as Record<string, unknown>;
    const enc = raw.encrypted_password;
    const needsPassword =
      enc === null || enc === "" || (typeof enc === "string" && enc.length === 0);

    return NextResponse.json({ ok: true, exists: true, needsPassword });
  } catch (e) {
    console.error("[phone-account-status]", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
