import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";
import { isAdminProfile } from "@/lib/isAdmin";

type Body = { property_id?: number; agency_id?: string | null };

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

  const propertyId = typeof body.property_id === "number" ? body.property_id : Number(body.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const agencyRaw = body.agency_id;
  const agencyId =
    agencyRaw === null || agencyRaw === undefined || agencyRaw === ""
      ? null
      : typeof agencyRaw === "string"
        ? agencyRaw.trim() || null
        : null;

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

  if (agencyId) {
    const { data: ag } = await svc.from("agencies").select("id").eq("id", agencyId).maybeSingle();
    if (!ag?.id) {
      return NextResponse.json({ ok: false, error: "agency_not_found" }, { status: 404 });
    }
  }

  const { error: upErr } = await svc.from("properties").update({ agency_id: agencyId }).eq("id", propertyId);
  if (upErr) {
    console.error("[admin/property-agency]", upErr);
    return NextResponse.json({ ok: false, error: "update_failed", message: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, property_id: propertyId, agency_id: agencyId });
}
