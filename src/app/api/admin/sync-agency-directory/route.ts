import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";
import { isAdminProfile } from "@/lib/isAdmin";
import { isValidAgencySlugAscii, suggestedAgencySlugAsciiFromName } from "@/lib/agencySlug";

type Body = { agency_id?: string };

function isSchemaColumnError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const m = String(err.message ?? "").toLowerCase();
  return err.code === "42703" || m.includes("does not exist") || m.includes("column");
}

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

  const agencyId = typeof body.agency_id === "string" ? body.agency_id.trim() : "";
  if (!agencyId) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  let svc: ReturnType<typeof getSupabaseServerClient>;
  try {
    svc = getSupabaseServerClient();
  } catch {
    return NextResponse.json({ ok: false, error: "config" }, { status: 500 });
  }

  const { data: actor, error: actorErr } = await svc.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actorErr || !isAdminProfile(actor)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { data: cur, error: curErr } = await svc
    .from("agencies")
    .select("id, name, slug")
    .eq("id", agencyId)
    .maybeSingle();
  if (curErr || !cur) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const displayName = String(cur.name ?? "").trim() || "Agency";
  let slug = String(cur.slug ?? "").trim().toLowerCase();
  if (!isValidAgencySlugAscii(slug)) {
    slug = suggestedAgencySlugAsciiFromName(displayName);
  }
  if (slug.length < 2) {
    slug = `agency-${agencyId.replaceAll("-", "").slice(0, 8)}`;
  }

  for (let attempt = 0; attempt < 24; attempt++) {
    const trySlug = attempt === 0 ? slug : `${slug}-${attempt}`;
    const { data: taken } = await svc.from("agencies").select("id").eq("slug", trySlug).neq("id", agencyId).maybeSingle();
    if (taken?.id) continue;

    let patch: Record<string, unknown> = {
      is_active: true,
      is_verified: true,
      status: "approved",
      slug: trySlug,
    };

    let upd = await svc.from("agencies").update(patch).eq("id", agencyId).select("id, slug").maybeSingle();

    for (let guard = 0; guard < 4 && upd.error; guard++) {
      if (!isSchemaColumnError(upd.error)) break;
      const msg = String(upd.error.message ?? "").toLowerCase();
      if (msg.includes("status") && "status" in patch) {
        const { status: _s, ...rest } = patch;
        patch = rest;
        upd = await svc.from("agencies").update(patch).eq("id", agencyId).select("id, slug").maybeSingle();
        continue;
      }
      if (msg.includes("is_active") && "is_active" in patch) {
        const { is_active: _a, ...rest } = patch;
        patch = rest;
        upd = await svc.from("agencies").update(patch).eq("id", agencyId).select("id, slug").maybeSingle();
        continue;
      }
      break;
    }

    if (upd.error) {
      if (upd.error.code === "23505" || String(upd.error.message).includes("unique")) continue;
      console.error("[admin/sync-agency-directory]", upd.error);
      return NextResponse.json(
        { ok: false, error: "update_failed", message: upd.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, agency_id: agencyId, slug: upd.data?.slug ?? trySlug });
  }

  return NextResponse.json({ ok: false, error: "slug_exhausted" }, { status: 409 });
}
