import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgencyLeadRow } from "./AgencyCRMTable";
import type { DateRangeKey } from "./agencyDashboardUtils";
import { rangeStartMs } from "./agencyDashboardUtils";
import type { ViewEventRow } from "./agencyLeadAnalytics";

const IN_CHUNK = 120;

const PROPS_CORE = "title, unit_type, governorate, district, area";
const PROPS_FULL = `${PROPS_CORE}, listing_purpose, listing_type`;
const PROPS_DETAIL = `${PROPS_FULL}, images, price, slug, status`;

const LEAD_BASE = "id, client_name, client_phone, created_at, property_id, crm_status, agency_notes";

/** Phase 3 CRM columns + rich property join (run sql/agency_crm_phase3.sql). */
const LEAD_SELECT_PHASE3 = `${LEAD_BASE}, lead_source, assignee_display, crm_priority, lead_notes_history, properties(${PROPS_DETAIL})`;

/** Phase 3 lead columns without extra property columns (if detail select fails). */
const LEAD_SELECT_PHASE3_LITE = `${LEAD_BASE}, lead_source, assignee_display, crm_priority, lead_notes_history, properties(${PROPS_FULL})`;

const LEAD_SELECT_FULL = `${LEAD_BASE}, properties(${PROPS_FULL})`;

const LEAD_SELECT_FALLBACK = `${LEAD_BASE}, properties(${PROPS_CORE})`;

const LEAD_SELECT_MINIMAL = `id, client_name, client_phone, created_at, property_id, properties(${PROPS_CORE})`;

const LEAD_SELECT_TRIES: string[] = [
  LEAD_SELECT_PHASE3,
  LEAD_SELECT_PHASE3_LITE,
  LEAD_SELECT_FULL,
  LEAD_SELECT_FALLBACK,
  LEAD_SELECT_MINIMAL,
];

export type FetchAgencyDashboardDataResult = {
  propCount: number;
  activeListingsCount: number;
  numericPropIds: number[];
  leads: AgencyLeadRow[];
  /** View events in range (for line chart + device mix) */
  viewEvents: ViewEventRow[];
  viewsTableAvailable: boolean;
};

/**
 * Loads agency-scoped dashboard aggregates for the given date range.
 * RLS must restrict to authenticated agency owner (see sql/agency_analytics_and_crm.sql).
 */
export async function fetchAgencyDashboardData(
  client: SupabaseClient,
  agencyId: string,
  dateRange: DateRangeKey,
): Promise<FetchAgencyDashboardDataResult> {
  const sinceMs = rangeStartMs(dateRange);
  const sinceIso = new Date(sinceMs).toISOString();

  const [{ count: pc }, { count: activeC }, { data: agencyPropRows }] = await Promise.all([
    client.from("properties").select("id", { count: "exact", head: true }).eq("agency_id", agencyId),
    client
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .eq("status", "active"),
    client.from("properties").select("id").eq("agency_id", agencyId),
  ]);

  const numericPropIds = (agencyPropRows ?? [])
    .map((p) => Number((p as { id?: unknown }).id))
    .filter((n) => Number.isFinite(n));

  const leads: AgencyLeadRow[] = [];
  for (let i = 0; i < numericPropIds.length; i += IN_CHUNK) {
    const slice = numericPropIds.slice(i, i + IN_CHUNK);
    if (slice.length === 0) continue;

    let batch: AgencyLeadRow[] = [];
    let lastErr: unknown = null;
    for (const sel of LEAD_SELECT_TRIES) {
      const r = await client
        .from("leads")
        .select(sel)
        .in("property_id", slice)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false });
      if (!r.error && r.data) {
        batch = r.data as unknown as AgencyLeadRow[];
        lastErr = null;
        break;
      }
      lastErr = r.error;
    }
    if (lastErr) {
      console.error("Agency leads fetch (all select variants failed):", lastErr);
      break;
    }
    leads.push(...batch);
  }

  const viewEvents: ViewEventRow[] = [];
  let viewsTableAvailable = true;
  for (let i = 0; i < numericPropIds.length && viewsTableAvailable; i += IN_CHUNK) {
    const slice = numericPropIds.slice(i, i + IN_CHUNK);
    if (slice.length === 0) continue;

    const trySelect = async (cols: string) => {
      return client.from("property_listing_view_events").select(cols).in("property_id", slice).gte("created_at", sinceIso);
    };

    let { data: vRows, error: vErr } = await trySelect("created_at, client_device_hint");
    if (vErr && (vErr.message ?? "").toLowerCase().includes("client_device_hint")) {
      const fb = await trySelect("created_at");
      vRows = fb.data;
      vErr = fb.error;
    }

    if (vErr) {
      const msg = (vErr.message ?? "").toLowerCase();
      if (msg.includes("property_listing_view_events") || vErr.code === "42P01" || msg.includes("schema cache")) {
        viewsTableAvailable = false;
        break;
      }
      console.warn("View events fetch:", vErr.message);
      viewsTableAvailable = false;
      break;
    }
    for (const r of vRows ?? []) {
      if (!r || typeof r !== "object") continue;
      const row = r as { created_at?: unknown; client_device_hint?: unknown };
      if (typeof row.created_at === "string") {
        const hint =
          row.client_device_hint === "mobile" ||
          row.client_device_hint === "desktop" ||
          row.client_device_hint === "unknown"
            ? row.client_device_hint
            : null;
        viewEvents.push({ created_at: row.created_at, client_device_hint: hint });
      }
    }
  }

  return {
    propCount: pc ?? 0,
    activeListingsCount: activeC ?? 0,
    numericPropIds,
    leads,
    viewEvents: viewsTableAvailable ? viewEvents : [],
    viewsTableAvailable,
  };
}
