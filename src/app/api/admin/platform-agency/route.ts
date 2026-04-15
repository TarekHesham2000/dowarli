import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";
import { isAdminProfile } from "@/lib/isAdmin";
import { isValidAgencySlug, suggestedAgencySlugFromName } from "@/lib/agencySlug";

type Body = { name?: string; slug?: string };

/**
 * Creates a verified agency owned by the current admin (official / platform brand listings).
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
    body = {};
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

  const { data: existing } = await svc.from("agencies").select("id").eq("owner_id", user.id).maybeSingle();
  if (existing?.id) {
    return NextResponse.json(
      { ok: false, error: "already_has_agency", agency_id: existing.id, message: "لديك وكالة مرتبطة بهذا الحساب بالفعل" },
      { status: 409 },
    );
  }

  const displayName =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : "دَورلي — وكالة المنصة الرسمية";

  let slug =
    typeof body.slug === "string" && body.slug.trim()
      ? body.slug.trim()
      : suggestedAgencySlugFromName(displayName);

  if (!isValidAgencySlug(slug)) {
    return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });
  }

  for (let attempt = 0; attempt < 16; attempt++) {
    const trySlug = attempt === 0 ? slug : `${slug}-${attempt}`;
    const { data: taken } = await svc.from("agencies").select("id").eq("slug", trySlug).maybeSingle();
    if (taken?.id) continue;

    const insertBase = {
      name: displayName,
      slug: trySlug,
      bio: null as string | null,
      logo_url: null as string | null,
      owner_id: user.id,
      subscription_status: "free" as const,
      is_verified: true,
      is_active: true,
    };

    let inserted = await svc.from("agencies").insert(insertBase).select("id, slug").single();
    if (
      inserted.error &&
      (inserted.error.code === "42703" || String(inserted.error.message).toLowerCase().includes("is_active"))
    ) {
      const { is_active: _a, ...withoutActive } = insertBase;
      inserted = await svc.from("agencies").insert(withoutActive).select("id, slug").single();
    }

    if (inserted.error) {
      if (inserted.error.code === "23505" || String(inserted.error.message).includes("unique")) continue;
      console.error("[admin/platform-agency]", inserted.error);
      return NextResponse.json(
        { ok: false, error: "insert_failed", message: inserted.error.message },
        { status: 500 },
      );
    }

    await svc.from("profiles").update({ role: "broker" }).eq("id", user.id);
    return NextResponse.json({ ok: true, agency_id: inserted.data?.id, slug: inserted.data?.slug });
  }

  return NextResponse.json({ ok: false, error: "slug_exhausted" }, { status: 409 });
}
