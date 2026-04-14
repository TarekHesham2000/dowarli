/**
 * Invoked after a property is approved (see Next.js /api/admin/trigger-property-alerts).
 * Matches `public.saved_searches` and inserts `property_alert_notifications`.
 * Optional: set RESEND_API_KEY + RESEND_FROM + SITE_URL to email users.
 *
 * Keep matcher logic aligned with `src/lib/matchSavedSearch.ts`.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type SavedFiltersV1 = {
  v: 1;
  searchQuery: string;
  activeFilter: string;
  parsed: {
    area: string;
    district?: string;
    governorate?: string;
    maxPrice: number | null;
    unitType: string;
    keywords: string;
  };
};

function propertyMatches(
  prop: {
    area: string;
    governorate?: string | null;
    district?: string | null;
    landmark?: string | null;
    price: number;
    unit_type: string;
    title: string;
    description: string;
    address: string;
  },
  filters: SavedFiltersV1,
): boolean {
  const { parsed, activeFilter } = filters;
  const dist = (parsed.district || "").replace(/\s+/g, " ").trim();
  const gov = (parsed.governorate || "").replace(/\s+/g, " ").trim();
  const locHay =
    `${prop.governorate ?? ""} ${prop.district ?? ""} ${prop.area ?? ""}`.replace(/\s+/g, " ");

  if (dist && !locHay.includes(dist)) return false;
  if (gov && !locHay.includes(gov)) {
    if (!(dist && locHay.includes(dist))) return false;
  }
  if (!dist && !gov && parsed.area && !locHay.includes(parsed.area)) return false;
  if (parsed.maxPrice != null && Number(prop.price) > parsed.maxPrice) return false;
  const effectiveUnit =
    activeFilter && activeFilter !== "all" ? activeFilter : parsed.unitType || "";
  if (effectiveUnit && String(prop.unit_type) !== effectiveUnit) return false;
  const kw = (parsed.keywords || "").replace(/\s+/g, " ").trim();
  if (kw.length > 2) {
    const hay =
      `${prop.title} ${prop.description} ${prop.address} ${prop.landmark ?? ""}`.toLowerCase();
    if (!hay.includes(kw.toLowerCase())) return false;
  }
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: "missing_env" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { property_id?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "bad_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const propertyId = Number(body?.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    return new Response(JSON.stringify({ error: "invalid_property_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: prop, error: propErr } = await admin
    .from("properties")
    .select(
      "id, area, governorate, district, landmark, price, unit_type, title, description, address, status, slug",
    )
    .eq("id", propertyId)
    .maybeSingle();

  if (propErr || !prop) {
    return new Response(JSON.stringify({ error: "property_not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (String(prop.status) !== "active") {
    return new Response(JSON.stringify({ ok: true, skipped: "not_active" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const matchProp = {
    area: String(prop.area ?? ""),
    governorate: prop.governorate != null ? String(prop.governorate) : null,
    district: prop.district != null ? String(prop.district) : null,
    landmark: prop.landmark != null ? String(prop.landmark) : null,
    price: Number(prop.price ?? 0),
    unit_type: String(prop.unit_type ?? ""),
    title: String(prop.title ?? ""),
    description: String(prop.description ?? ""),
    address: String(prop.address ?? ""),
  };

  let offset = 0;
  const pageSize = 200;
  let notified = 0;
  const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
  const propSlug = String((prop as { slug?: string | null }).slug ?? "").trim();
  const propertyPath = propSlug ? `${siteUrl}/property/${propSlug}` : `${siteUrl}/property/${propertyId}`;

  while (true) {
    const { data: rows, error: seErr } = await admin
      .from("saved_searches")
      .select("id, user_id, filters")
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (seErr) {
      console.error("[property-approved-alerts] saved_searches:", seErr.message);
      return new Response(JSON.stringify({ error: "saved_searches_query" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!rows?.length) break;

    for (const row of rows) {
      const raw = row.filters as SavedFiltersV1 | null;
      if (!raw || raw.v !== 1 || !row.user_id) continue;
      if (!propertyMatches(matchProp, raw)) continue;

      const bodyAr =
        `عقار جديد يطابق بحثك المحفوظ: «${raw.searchQuery?.slice(0, 80) || "تنبيه"}» — رقم الإعلان ${propertyId}`;

      const { error: insErr } = await admin.from("property_alert_notifications").insert({
        user_id: row.user_id,
        property_id: propertyId,
        saved_search_id: row.id,
        body: bodyAr,
      });

      if (insErr) {
        if (insErr.code === "23505") continue;
        console.error("[property-approved-alerts] insert notification:", insErr.message);
        continue;
      }
      notified++;

      const resendKey = Deno.env.get("RESEND_API_KEY");
      const resendFrom = Deno.env.get("RESEND_FROM");
      if (resendKey && resendFrom) {
        try {
          const { data: authUser } = await admin.auth.admin.getUserById(row.user_id);
          const to = authUser?.user?.email;
          if (to) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: resendFrom,
                to: [to],
                subject: "دَورلي — عقار جديد يطابق بحثك",
                html: `<p dir="rtl">${bodyAr}</p>${
                  siteUrl
                    ? `<p dir="rtl"><a href="${propertyPath}">عرض الإعلان</a></p>`
                    : ""
                }`,
              }),
            });
          }
        } catch (e) {
          console.error("[property-approved-alerts] email:", e);
        }
      }
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return new Response(JSON.stringify({ ok: true, notified }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
