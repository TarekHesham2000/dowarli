import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";
import { isAdminProfile } from "@/lib/isAdmin";
import { isValidAgencySlugAscii, suggestedAgencySlugAsciiFromName } from "@/lib/agencySlug";

type Body = { user_id?: string; name?: string; slug?: string };

/**
 * Creates an `agencies` row for a profile (service role). RLS blocks cross-user INSERT from the browser.
 * `name` is required (official agency name). Promoted agencies default to directory-visible: active, verified, approved.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    return NextResponse.json({ ok: false, error: "config" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anon, {
    ...getSupabaseGlobalClientOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* ignore */
        }
      },
    },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const ownerId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  if (!ownerId) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const displayName = typeof body.name === "string" ? body.name.trim() : "";
  if (displayName.length < 2) {
    return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
  }

  let svc: ReturnType<typeof getSupabaseServerClient>;
  try {
    svc = getSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: false, error: "config" }, { status: 500 });
  }

  const { data: actor, error: actorErr } = await svc
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (actorErr || !isAdminProfile(actor)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { data: existing } = await svc.from("agencies").select("id").eq("owner_id", ownerId).maybeSingle();
  if (existing?.id) {
    return NextResponse.json({ ok: true, agency_id: existing.id, already: true });
  }

  const { data: prof, error: pErr } = await svc
    .from("profiles")
    .select("id, name, role")
    .eq("id", ownerId)
    .maybeSingle();

  if (pErr || !prof) {
    return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
  }

  const slugFromBody = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (slugFromBody && !isValidAgencySlugAscii(slugFromBody)) {
    return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });
  }

  let baseSlug = slugFromBody || suggestedAgencySlugAsciiFromName(displayName);
  if (baseSlug.length < 2) baseSlug = `agency-${ownerId.slice(0, 8)}`;

  for (let attempt = 0; attempt < 20; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
    const { data: taken } = await svc.from("agencies").select("id").eq("slug", slug).maybeSingle();
    if (taken?.id) continue;

    let insertPayload: Record<string, unknown> = {
      name: displayName,
      slug,
      bio: null,
      logo_url: null,
      owner_id: ownerId,
      subscription_status: "free",
      is_verified: true,
      is_active: true,
      status: "approved",
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
      console.error("[admin/bootstrap-agency]", ins.error);
      return NextResponse.json(
        { ok: false, error: "insert_failed", message: ins.error.message },
        { status: 500 },
      );
    }

    const inserted = ins.data;
    if (!inserted?.id) {
      return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
    }

    await svc.from("profiles").update({ role: "broker" }).eq("id", ownerId);

    await svc.from("properties").update({ agency_id: inserted.id }).eq("owner_id", ownerId).is("agency_id", null);

    return NextResponse.json({ ok: true, agency_id: inserted.id, slug });
  }

  return NextResponse.json({ ok: false, error: "slug_exhausted" }, { status: 409 });
}
