import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";
import { isAdminProfile } from "@/lib/isAdmin";
import { isValidAgencySlug } from "@/lib/agencySlug";

type Body = {
  agency_id?: string;
  name?: string;
  slug?: string;
  is_verified?: boolean;
  is_active?: boolean;
};

export async function PATCH(request: Request) {
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
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
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

  const { data: cur, error: curErr } = await svc.from("agencies").select("*").eq("id", agencyId).maybeSingle();
  if (curErr || !cur) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const nextName = typeof body.name === "string" ? body.name.trim() : String(cur.name ?? "").trim();
  if (!nextName) {
    return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
  }

  let nextSlug = typeof body.slug === "string" ? body.slug.trim() : String(cur.slug ?? "").trim();
  if (body.slug !== undefined) {
    if (!isValidAgencySlug(nextSlug)) {
      return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });
    }
    if (nextSlug.toLowerCase() !== String(cur.slug ?? "").toLowerCase()) {
      const { data: taken } = await svc.from("agencies").select("id").eq("slug", nextSlug).neq("id", agencyId).maybeSingle();
      if (taken?.id) {
        return NextResponse.json({ ok: false, error: "slug_taken" }, { status: 409 });
      }
    }
  } else {
    nextSlug = String(cur.slug ?? "");
  }

  const patch: Record<string, unknown> = {
    name: nextName,
    slug: nextSlug,
  };
  if (typeof body.is_verified === "boolean") patch.is_verified = body.is_verified;
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;

  let upd = await svc.from("agencies").update(patch).eq("id", agencyId).select("*").maybeSingle();
  if (
    upd.error &&
    "is_active" in patch &&
    (upd.error.code === "42703" || String(upd.error.message).toLowerCase().includes("is_active"))
  ) {
    const { is_active: _ia, ...rest } = patch;
    upd = await svc.from("agencies").update(rest).eq("id", agencyId).select("*").maybeSingle();
  }
  if (upd.error) {
    console.error("[admin/agency]", upd.error);
    return NextResponse.json({ ok: false, error: "update_failed", message: upd.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, agency: upd.data });
}
