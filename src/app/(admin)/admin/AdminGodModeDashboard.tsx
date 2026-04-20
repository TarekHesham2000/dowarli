"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  Home,
  Inbox,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  RefreshCw,
  Search,
  Settings,
  Users,
  Vault,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { propertyPathFromRecord } from "@/lib/propertySlug";
import { safeRouterRefresh } from "@/lib/safeRouterRefresh";
import { notifyPointsChanged } from "@/lib/profilePointsSync";
import {
  effectiveListingActivationPoints,
  normalizePlatformSettings,
  PLATFORM_SETTINGS_DEFAULTS,
  type PlatformSettingsRow,
} from "@/lib/platformSettings";
import { PropertyImagesAdmin } from "./PropertyImagesAdmin";
import SiteBrandLogo from "@/components/brand/SiteBrandLogo";
import {
  activationCostLabelAr,
  getEmbedUrl,
  isAwaitingPropertyApproval,
  listingPurposeFromProperty,
} from "./adminShared";

type ProfileMini = { name: string; phone: string; id: string; points?: number | null; email?: string | null };

type Property = {
  id: number;
  title: string;
  area: string;
  governorate?: string | null;
  district?: string | null;
  landmark?: string | null;
  price: number;
  status: string;
  images: string[];
  description: string;
  address: string;
  slug?: string | null;
  video_url?: string | null;
  listing_type?: string | null;
  listing_purpose?: string | null;
  was_charged?: boolean | null;
  agency_id?: string | null;
  owner_id?: string | null;
  rejection_reason?: string | null;
  created_at?: string | null;
  unit_type?: string | null;
  profiles: ProfileMini;
};

/** Must stay aligned with normalizeAdminProperty — used in loadAll and admin preview fetch. */
const ADMIN_PROPERTIES_SELECT =
  "id, title, area, governorate, district, landmark, price, status, images, description, address, slug, video_url, listing_type, listing_purpose, was_charged, agency_id, owner_id, rejection_reason, created_at, unit_type, profiles(name, phone, id, points, email)";

function normalizeAdminProperty(raw: unknown): Property {
  const p = raw as Record<string, unknown>;
  const prof = p.profiles;
  const po = (Array.isArray(prof) ? prof[0] : prof) as Record<string, unknown> | undefined;
  return {
    id: Number(p.id),
    title: String(p.title ?? ""),
    area: String(p.area ?? ""),
    governorate: p.governorate != null ? String(p.governorate) : null,
    district: p.district != null ? String(p.district) : null,
    landmark: p.landmark != null ? String(p.landmark) : null,
    price: Number(p.price ?? 0),
    status: String(p.status ?? ""),
    images: Array.isArray(p.images)
      ? (p.images as unknown[]).map((x) => String(x)).filter(Boolean)
      : [],
    description: String(p.description ?? ""),
    address: String(p.address ?? ""),
    slug: p.slug != null ? String(p.slug) : null,
    video_url: p.video_url != null ? String(p.video_url) : null,
    listing_type: p.listing_type != null ? String(p.listing_type) : null,
    listing_purpose: p.listing_purpose != null ? String(p.listing_purpose) : null,
    was_charged: p.was_charged === true,
    agency_id: p.agency_id != null ? String(p.agency_id) : null,
    owner_id: p.owner_id != null ? String(p.owner_id) : null,
    rejection_reason: p.rejection_reason != null ? String(p.rejection_reason) : null,
    created_at: p.created_at != null ? String(p.created_at) : undefined,
    unit_type: p.unit_type != null ? String(p.unit_type) : null,
    profiles: {
      name: String(po?.name ?? ""),
      phone: String(po?.phone ?? ""),
      id: String(po?.id ?? ""),
      points: po?.points != null && po.points !== "" ? Number(po.points) : null,
      email: po?.email != null ? String(po.email) : null,
    },
  };
}

type Transaction = {
  id: number;
  amount: number;
  screenshot_url: string;
  status: string;
  broker_id: string;
  sender_phone?: string | null;
  points_requested?: number | null;
  package_name?: string | null;
  profiles: { name: string; phone: string };
};

type LedgerTx = Transaction & {
  created_at?: string | null;
  rejection_reason?: string | null;
  admin_notes?: string | null;
};

type UserRow = {
  id: string;
  name: string;
  phone: string;
  points: number;
  is_active: boolean;
  role?: string | null;
  created_at: string;
  total_charged?: number;
};

type Lead = {
  id: string | number;
  client_name: string;
  client_phone: string;
  created_at: string;
  property_id: number;
  property_title?: string;
  property_area?: string;
  owner_name?: string;
  property_slug?: string | null;
};

/** Verified payments — extended for treasury + revenue breakdown */
type VerifiedTx = {
  id: number;
  amount: number;
  broker_id: string;
  created_at: string;
  package_name?: string | null;
  points_requested?: number | null;
  sender_phone?: string | null;
  screenshot_url?: string | null;
  profiles?: { name: string; phone: string } | null;
};

type AgencyRow = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  is_verified?: boolean | null;
  is_active?: boolean | null;
};

type Stats = {
  totalUsers: number;
  totalBrokers: number;
  publishedProperties: number;
  rejectedProperties: number;
  totalLeads: number;
  pendingProperties: number;
  pendingTransactions: number;
  totalCharged: number;
  signupsToday: number;
};

type Tab =
  | "overview"
  | "queue"
  | "listings"
  | "users"
  | "ledger"
  | "leads"
  | "vault"
  | "settings";

const PROPERTY_REJECT_PRESETS: { id: string; label: string; text: string }[] = [
  {
    id: "photos",
    label: "صور غير مناسبة",
    text: "صور غير واضحة أو غير مناسبة للنشر. رجاء إعادة رفع صور حقيقية واضحة للعقار.",
  },
  {
    id: "phone_in_image",
    label: "رقم هاتف على الصورة",
    text: "يُمنع ظهور أرقام هواتف على صور الإعلان — احذف الرقم أو غطّه وأعد الإرسال.",
  },
  {
    id: "price",
    label: "سعر غير صحيح",
    text: "السعر المعروض غير مطابق لشروط المنصة. رجاء تصحيح السعر وإعادة الطلب.",
  },
];

const SIDEBAR: { id: Tab; label: string; icon: typeof LayoutDashboard; badge?: keyof Stats }[] = [
  { id: "overview", label: "نظرة عامة", icon: LayoutDashboard },
  { id: "queue", label: "طابور المراجعة", icon: ClipboardList, badge: "pendingProperties" },
  { id: "listings", label: "كل الإعلانات", icon: Building2 },
  { id: "users", label: "المستخدمون", icon: Users },
  { id: "ledger", label: "سجل المدفوعات", icon: CreditCard },
  { id: "leads", label: "العملاء", icon: Home },
  { id: "vault", label: "الخزنة", icon: Vault },
  { id: "settings", label: "إعدادات", icon: Settings },
];

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const MS_DAY = 86400000;

function pctTrendVsPreviousWeek(current: number, previous: number): { text: string; up: boolean; muted: boolean } {
  if (current === 0 && previous === 0) return { text: "0٪", up: true, muted: true };
  if (previous === 0) return { text: current > 0 ? "+جديد" : "0٪", up: current >= 0, muted: current === 0 };
  const raw = ((current - previous) / previous) * 100;
  const rounded = Math.round(raw * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return { text: `${sign}${rounded}٪`, up: rounded >= 0, muted: false };
}

const ADMIN_NEON = {
  teal: "#2dd4bf",
  purple: "#a78bfa",
  gold: "#fbbf24",
  grid: "#334155",
  tick: "#94a3b8",
} as const;

const REVENUE_DONUT_COLORS = [ADMIN_NEON.teal, ADMIN_NEON.purple, ADMIN_NEON.gold];

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: "#0f172a",
    border: "1px solid rgba(167, 139, 250, 0.35)",
    borderRadius: "12px",
    fontSize: "12px",
    color: "#f1f5f9",
  },
  labelStyle: { color: "#e2e8f0" },
};

export default function AdminGodModeDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [omniSearch, setOmniSearch] = useState("");

  const [properties, setProperties] = useState<Property[]>([]);
  const [ledgerRows, setLedgerRows] = useState<LedgerTx[]>([]);
  const [verifiedTxRows, setVerifiedTxRows] = useState<VerifiedTx[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalBrokers: 0,
    publishedProperties: 0,
    rejectedProperties: 0,
    totalLeads: 0,
    pendingProperties: 0,
    pendingTransactions: 0,
    totalCharged: 0,
    signupsToday: 0,
  });

  const [listingCost, setListingCost] = useState("50");
  const [bannerText, setBannerText] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettingsRow>(PLATFORM_SETTINGS_DEFAULTS);
  const [savingPlatformSettings, setSavingPlatformSettings] = useState(false);
  const [editNewImageUrl, setEditNewImageUrl] = useState("");

  const [notifyUserId, setNotifyUserId] = useState<string | null>(null);
  const [notifyTitle, setNotifyTitle] = useState("إشعار من الإدارة");
  const [notifyBody, setNotifyBody] = useState("");
  const [notifySending, setNotifySending] = useState(false);

  const [propertySearch, setPropertySearch] = useState("");
  const [propertyStatusFilter, setPropertyStatusFilter] = useState<
    "all" | "pending" | "active" | "rejected"
  >("all");
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [ledgerSearch, setLedgerSearch] = useState("");

  const [pointsAdjustInputs, setPointsAdjustInputs] = useState<Record<string, string>>({});
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [savingPropertyEdit, setSavingPropertyEdit] = useState(false);
  const [editAgencyId, setEditAgencyId] = useState<string>("");

  const [bootstrapModalUserId, setBootstrapModalUserId] = useState<string | null>(null);
  const [bootstrapAgencyName, setBootstrapAgencyName] = useState("");
  const [bootstrapSlug, setBootstrapSlug] = useState("");
  const [bootstrapSubmitting, setBootstrapSubmitting] = useState(false);

  const [platformAgencyModalOpen, setPlatformAgencyModalOpen] = useState(false);
  const [platformAgencyName, setPlatformAgencyName] = useState("دَورلي — وكالة المنصة الرسمية");
  const [platformAgencySlug, setPlatformAgencySlug] = useState("");
  const [platformAgencyBusy, setPlatformAgencyBusy] = useState(false);

  const [agencyDrafts, setAgencyDrafts] = useState<
    Record<string, { name: string; slug: string; is_verified: boolean; is_active: boolean }>
  >({});
  const [savingAgencyId, setSavingAgencyId] = useState<string | null>(null);
  const [syncingAgencyId, setSyncingAgencyId] = useState<string | null>(null);

  const [previewProperty, setPreviewProperty] = useState<Property | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectAdminNotes, setRejectAdminNotes] = useState("");
  const [rejectType, setRejectType] = useState<"property" | "transaction">("property");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const [deletePropertyId, setDeletePropertyId] = useState<number | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deletingProperty, setDeletingProperty] = useState(false);

  const [vaultPassword, setVaultPassword] = useState("");
  const [vaultUnlocked, setVaultUnlocked] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  const [profilesError, setProfilesError] = useState("");
  const [verifiedTxError, setVerifiedTxError] = useState("");
  const [approvingPropertyId, setApprovingPropertyId] = useState<number | null>(null);
  const [approvingTransactionId, setApprovingTransactionId] = useState<number | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const loadAll = useCallback(async () => {
    try {
      const [
        propsRes,
        transRes,
        verifiedRes,
        ledgerRes,
        usersRes,
        agenciesRes,
        leadsRes,
        settingsRes,
      ] = await Promise.all([
        supabase.from("properties").select(ADMIN_PROPERTIES_SELECT).order("created_at", { ascending: false }),
        supabase
          .from("transactions")
          .select(
            "id, amount, screenshot_url, status, broker_id, sender_phone, points_requested, package_name, profiles(name, phone)",
          )
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
        supabase
          .from("transactions")
          .select(
            "id, amount, broker_id, created_at, package_name, p   oints_requested, sender_phone, screenshot_url, profiles(name, phone)",
          )
          .eq("status", "verified")
          .order("created_at", { ascending: false })
          .limit(10000),
        supabase
          .from("transactions")
          .select(
            "id, amount, screenshot_url, status, broker_id, sender_phone, points_requested, package_name, created_at, rejection_reason, admin_notes, profiles(name, phone)",
          )
          .order("created_at", { ascending: false })
          .limit(400),
        supabase
          .from("profiles")
          .select("id, name, phone, points, is_active, role, created_at")
          .neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("agencies").select("id, name, slug, owner_id, is_verified, is_active"),
        supabase
          .from("leads")
          .select("id, client_name, client_phone, created_at, property_id")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("settings").select("key, value"),
      ]);

      if (usersRes.error) {
        setProfilesError(`${usersRes.error.code ?? "ERR"}: ${usersRes.error.message}`);
      } else setProfilesError("");

      if (verifiedRes.error) {
        setVerifiedTxError(`${verifiedRes.error.code ?? "ERR"}: ${verifiedRes.error.message}`);
      } else setVerifiedTxError("");

      const props = ((propsRes.data as unknown[]) ?? []).map((row) => normalizeAdminProperty(row));
      const pendingTx = (transRes.data as unknown as Transaction[]) ?? [];
      const verified = verifiedRes.error ? [] : ((verifiedRes.data as unknown as VerifiedTx[]) ?? []);
      const ledger = (ledgerRes.data as unknown as LedgerTx[]) ?? [];
      const allProfiles = (usersRes.data as UserRow[]) ?? [];
      const agRows = (agenciesRes.data as AgencyRow[]) ?? [];
      const rawLeads = (leadsRes.data as Lead[]) ?? [];

      let totalCharged = 0;
      const chargedByBroker = new Map<string, number>();
      for (const row of verified) {
        const amt = Number(row.amount ?? 0);
        totalCharged += amt;
        chargedByBroker.set(row.broker_id, (chargedByBroker.get(row.broker_id) ?? 0) + amt);
      }

      const userRows = allProfiles.map((b) => ({
        ...b,
        total_charged: chargedByBroker.get(b.id) ?? 0,
      }));

      const enrichedLeads = rawLeads.map((l) => {
        const prop = props.find((p) => p.id === l.property_id);
        return {
          ...l,
          property_title: prop?.title ?? "—",
          property_area:
            [prop?.district, prop?.governorate].filter(Boolean).join(" — ") || prop?.area || "—",
          owner_name: prop?.profiles?.name ?? "—",
          property_slug: prop?.slug ?? null,
        };
      });

      const t0 = startOfToday();
      const signupsToday = allProfiles.filter(
        (p) => p.created_at && new Date(p.created_at) >= t0,
      ).length;

      setProperties(props);
      setVerifiedTxRows(
        verifiedRes.error
          ? []
          : ((verifiedRes.data as unknown as VerifiedTx[]) ?? []).map((r) => ({
              id: Number(r.id),
              amount: Number(r.amount ?? 0),
              broker_id: String(r.broker_id ?? ""),
              created_at: String(r.created_at ?? ""),
              package_name: r.package_name != null ? String(r.package_name) : null,
              points_requested: r.points_requested != null ? Number(r.points_requested) : null,
              sender_phone: r.sender_phone != null ? String(r.sender_phone) : null,
              screenshot_url: r.screenshot_url != null ? String(r.screenshot_url) : null,
              profiles: r.profiles && typeof r.profiles === "object" && !Array.isArray(r.profiles)
                ? {
                    name: String((r.profiles as { name?: unknown }).name ?? ""),
                    phone: String((r.profiles as { phone?: unknown }).phone ?? ""),
                  }
                : Array.isArray(r.profiles) && r.profiles[0]
                  ? {
                      name: String((r.profiles[0] as { name?: unknown }).name ?? ""),
                      phone: String((r.profiles[0] as { phone?: unknown }).phone ?? ""),
                    }
                  : null,
            })),
      );
      setLedgerRows(ledger);
      setUsers(userRows);
      setAgencies(agRows);
      setLeads(enrichedLeads);

      if (settingsRes.data) {
        const cost = settingsRes.data.find((s) => s.key === "listing_cost");
        if (cost) setListingCost(cost.value);
        const banner = settingsRes.data.find((s) => s.key === "banner_text");
        if (banner) setBannerText(banner?.value ?? "");
      }

      try {
        const pr = await fetch("/api/platform-settings");
        const pj = (await pr.json()) as { settings?: Record<string, unknown> };
        if (pj?.settings) setPlatformSettings(normalizePlatformSettings(pj.settings));
      } catch {
        setPlatformSettings(PLATFORM_SETTINGS_DEFAULTS);
      }

      setStats({
        totalUsers: allProfiles.length,
        totalBrokers: allProfiles.filter((p) => p.role === "broker" || p.role === "admin").length,
        publishedProperties: props.filter((p) => p.status === "active").length,
        rejectedProperties: props.filter((p) => p.status === "rejected").length,
        totalLeads: enrichedLeads.length,
        pendingProperties: props.filter((p) => isAwaitingPropertyApproval(p.status)).length,
        pendingTransactions: pendingTx.length,
        totalCharged,
        signupsToday,
      });
    } catch (e) {
      console.error("loadAll", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const patchPropertyImages = useCallback((propertyId: number, next: string[]) => {
    setProperties((prev) => prev.map((x) => (x.id === propertyId ? { ...x, images: next } : x)));
    setSelectedProperty((sp) => (sp && sp.id === propertyId ? { ...sp, images: next } : sp));
  }, []);

  const closeAdminPreview = useCallback(() => {
    setPreviewProperty(null);
    setPreviewError(null);
    setPreviewLoading(false);
  }, []);

  useEffect(() => {
    setAgencyDrafts(
      Object.fromEntries(
        agencies.map((a) => [
          a.id,
          {
            name: a.name,
            slug: a.slug,
            is_verified: a.is_verified !== false,
            is_active: a.is_active !== false,
          },
        ]),
      ),
    );
  }, [agencies]);

  const openAdminPreview = useCallback(async (propertyId: number) => {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewProperty(null);
    try {
      const { data, error } = await supabase
        .from("properties")
        .select(ADMIN_PROPERTIES_SELECT)
        .eq("id", propertyId)
        .maybeSingle();
      if (error) {
        setPreviewError(error.message);
        return;
      }
      if (!data) {
        setPreviewError("لم يُعثر على الإعلان");
        return;
      }
      setPreviewProperty(normalizeAdminProperty(data));
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push("/login");
        return;
      }
      const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (error || profile?.role !== "admin") {
        router.push("/dashboard");
        return;
      }
      setAuthReady(true);
      void loadAll();
    };
    void run();

    const channelId = `admin-god-${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on("postgres_changes", { event: "*", schema: "public", table: "properties" }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void loadAll())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, loadAll]);

  const agencyById = useMemo(() => {
    const m = new Map<string, AgencyRow>();
    for (const a of agencies) m.set(a.id, a);
    return m;
  }, [agencies]);

  const agencyLeadStats = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const l of leads) {
      const prop = properties.find((p) => p.id === l.property_id);
      const ag = prop?.agency_id ? agencyById.get(prop.agency_id) : undefined;
      const label = ag?.name ?? "إعلانات بدون وكالة / مالك مباشر";
      map.set(label, { name: label, count: (map.get(label)?.count ?? 0) + 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 12);
  }, [leads, properties, agencyById]);

  const revenueSourceDonut = useMemo(() => {
    const owners = new Set(agencies.map((a) => a.owner_id));
    let individual = 0;
    let agencyOwners = 0;
    for (const r of verifiedTxRows) {
      const amt = Number(r.amount ?? 0);
      if (owners.has(r.broker_id)) agencyOwners += amt;
      else individual += amt;
    }
    const rows = [
      { name: "أفراد / وسطاء", value: individual },
      { name: "مالكو وكالات", value: agencyOwners },
    ].filter((x) => x.value > 0);
    return rows;
  }, [verifiedTxRows, agencies]);

  const overviewTrends = useMemo(() => {
    const now = Date.now();
    const curStart = now - 7 * MS_DAY;
    const prevStart = now - 14 * MS_DAY;
    const prevEnd = curStart;

    const sumVerified = (startMs: number, endMs: number) =>
      verifiedTxRows.reduce((s, r) => {
        const t = new Date(r.created_at).getTime();
        if (!Number.isFinite(t)) return s;
        if (t >= startMs && t < endMs) return s + Number(r.amount ?? 0);
        return s;
      }, 0);

    const revenueCur = sumVerified(curStart, now);
    const revenuePrev = sumVerified(prevStart, prevEnd);

    const newActivesThis = properties.filter((p) => {
      if (p.status !== "active" || !p.created_at) return false;
      const t = new Date(p.created_at).getTime();
      return t >= curStart && t < now;
    }).length;
    const newActivesPrev = properties.filter((p) => {
      if (p.status !== "active" || !p.created_at) return false;
      const t = new Date(p.created_at).getTime();
      return t >= prevStart && t < prevEnd;
    }).length;

    const signupsCur = users.filter((u) => {
      if (!u.created_at) return false;
      const t = new Date(u.created_at).getTime();
      return t >= curStart && t < now;
    }).length;
    const signupsPrev = users.filter((u) => {
      if (!u.created_at) return false;
      const t = new Date(u.created_at).getTime();
      return t >= prevStart && t < prevEnd;
    }).length;

    const leadsCur = leads.filter((l) => {
      const t = new Date(l.created_at).getTime();
      return t >= curStart && t < now;
    }).length;
    const leadsPrev = leads.filter((l) => {
      const t = new Date(l.created_at).getTime();
      return t >= prevStart && t < prevEnd;
    }).length;

    return {
      revenue: pctTrendVsPreviousWeek(revenueCur, revenuePrev),
      listings: pctTrendVsPreviousWeek(newActivesThis, newActivesPrev),
      signups: pctTrendVsPreviousWeek(signupsCur, signupsPrev),
      leads: pctTrendVsPreviousWeek(leadsCur, leadsPrev),
    };
  }, [verifiedTxRows, properties, users, leads]);

  const vaultChartData = useMemo(() => {
    const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
    const localDayKey = (d: Date) =>
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const map = new Map<string, number>();
    for (const r of verifiedTxRows) {
      const k = localDayKey(new Date(r.created_at));
      map.set(k, (map.get(k) ?? 0) + Number(r.amount ?? 0));
    }
    const out: { dayKey: string; labelShort: string; labelFull: string; amount: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const dt = new Date();
      dt.setHours(12, 0, 0, 0);
      dt.setDate(dt.getDate() - i);
      const dayKey = localDayKey(dt);
      const labelShort = `${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
      const labelFull = dt.toLocaleDateString("ar-EG", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      out.push({ dayKey, labelShort, labelFull, amount: map.get(dayKey) ?? 0 });
    }
    return out;
  }, [verifiedTxRows]);

  const vaultTransactionLog = useMemo(() => {
    const owners = new Set(agencies.map((a) => a.owner_id));
    return [...verifiedTxRows]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50)
      .map((r) => ({
        ...r,
        sourceLabel: owners.has(r.broker_id) ? "وكالة" : "فرد / وسيط",
        paymentLabel:
          r.screenshot_url && r.screenshot_url.length > 4 ? "إيصال / لقطة شاشة" : "تحويل (دون إيصال)",
      }));
  }, [verifiedTxRows, agencies]);

  const pendingQueue = useMemo(
    () => properties.filter((p) => isAwaitingPropertyApproval(p.status)),
    [properties],
  );

  const filteredListings = useMemo(() => {
    const matchStatus = (p: Property) => {
      if (propertyStatusFilter === "all") return true;
      if (propertyStatusFilter === "pending") return isAwaitingPropertyApproval(p.status);
      return p.status === propertyStatusFilter;
    };
    const q = propertySearch.trim().toLowerCase();
    const matchSearch = (p: Property) =>
      !q ||
      p.title?.toLowerCase().includes(q) ||
      p.profiles?.name?.toLowerCase().includes(q) ||
      String(p.id).includes(q);
    const matchOwner = (p: Property) => !ownerFilter || p.profiles?.id === ownerFilter;
    return properties.filter((p) => matchStatus(p) && matchSearch(p) && matchOwner(p));
  }, [properties, propertyStatusFilter, propertySearch, ownerFilter]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter(
      (u) =>
        !q ||
        u.name?.toLowerCase().includes(q) ||
        u.phone?.includes(q) ||
        u.id.toLowerCase().includes(q),
    );
  }, [users, userSearch]);

  const filteredLedger = useMemo(() => {
    const q = ledgerSearch.trim().toLowerCase();
    return ledgerRows.filter((r) => {
      if (!q) return true;
      return (
        (r.profiles?.name ?? "").toLowerCase().includes(q) ||
        (r.profiles?.phone ?? "").includes(q) ||
        String(r.id).includes(q) ||
        (r.status ?? "").toLowerCase().includes(q)
      );
    });
  }, [ledgerRows, ledgerSearch]);

  const omniHits = useMemo(() => {
    const q = omniSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    type Hit = { key: string; title: string; subtitle: string; onSelect: () => void };
    const hits: Hit[] = [];
    for (const u of users) {
      if (hits.length >= 8) break;
      if (u.name?.toLowerCase().includes(q) || u.phone?.includes(q) || u.id.toLowerCase().includes(q)) {
        hits.push({
          key: `u-${u.id}`,
          title: u.name || "—",
          subtitle: `${u.phone} · ${u.role ?? "—"}`,
          onSelect: () => {
            setTab("users");
            setUserSearch(u.phone || u.name || "");
            setOmniSearch("");
          },
        });
      }
    }
    for (const p of properties) {
      if (hits.length >= 12) break;
      if (p.title?.toLowerCase().includes(q) || String(p.id).includes(q)) {
        hits.push({
          key: `p-${p.id}`,
          title: p.title,
          subtitle: `#${p.id} · ${p.status}`,
          onSelect: () => {
            setTab("listings");
            setPropertySearch(String(p.id));
            setSelectedProperty(p);
            setOmniSearch("");
          },
        });
      }
    }
    for (const a of agencies) {
      if (hits.length >= 14) break;
      if (a.name?.toLowerCase().includes(q) || a.slug?.toLowerCase().includes(q)) {
        hits.push({
          key: `a-${a.id}`,
          title: a.name,
          subtitle: `/${a.slug}`,
          onSelect: () => {
            setTab("overview");
            setOmniSearch("");
          },
        });
      }
    }
    return hits;
  }, [omniSearch, users, properties, agencies]);

  const filterByOwner = (brokerId: string) => {
    setOwnerFilter(brokerId);
    setPropertyStatusFilter("all");
    setPropertySearch("");
    setTab("listings");
  };

  const approveProperty = async (property: Property) => {
    if (approvingPropertyId !== null) return;
    setApprovingPropertyId(property.id);
    try {
      const { data: fresh, error: fetchError } = await supabase
        .from("properties")
        .select("id, status")
        .eq("id", property.id)
        .single();
      if (fetchError || !fresh) {
        showToast("تعذر جلب بيانات الإعلان", "error");
        return;
      }
      if (fresh.status === "active") {
        showToast("مفعّل بالفعل", "success");
        setSelectedProperty(null);
        await loadAll();
        return;
      }
      if (!isAwaitingPropertyApproval(fresh.status)) {
        showToast("ليس في انتظار الموافقة", "error");
        return;
      }
      const { error: rpcError } = await supabase.rpc("handle_admin_approval", { p_property_id: property.id });
      if (rpcError) {
        showToast(rpcError.message || "تعذّر التفعيل", "error");
        return;
      }
      notifyPointsChanged();
      showToast("تمت الموافقة على الإعلان", "success");
      void fetch("/api/admin/trigger-property-alerts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: property.id }),
      }).catch(() => {});
      setSelectedProperty(null);
      await loadAll();
      safeRouterRefresh(router);
    } finally {
      setApprovingPropertyId(null);
    }
  };

  const rejectProperty = async () => {
    if (!rejectId || !rejectReason.trim() || rejectSubmitting) return;
    setRejectSubmitting(true);
    const propRow = properties.find((x) => x.id === rejectId);
    const ownerId = propRow?.profiles?.id;
    const propTitle = propRow?.title ?? "إعلانك";
    const reasonLine = rejectReason.trim();
    try {
      const { error } = await supabase
        .from("properties")
        .update({ status: "rejected", rejection_reason: reasonLine, is_approved: false })
        .eq("id", rejectId);
      if (error) {
        showToast(error.message, "error");
        return;
      }
      if (ownerId) {
        await fetch("/api/admin/notify-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            user_id: ownerId,
            title: "تم رفض إعلانك",
            body: `العنوان: «${propTitle}»\nالسبب: ${reasonLine}\nيمكنك تعديل الإعلان وإعادة الإرسال بعد معالجة الملاحظات.`,
          }),
        }).catch(() => {});
      }
      showToast("تم الرفض وتسجيل السبب وإرسال إشعار للمستخدم", "success");
      setRejectId(null);
      setRejectReason("");
      await loadAll();
      safeRouterRefresh(router);
    } finally {
      setRejectSubmitting(false);
    }
  };

  const approveTransaction = async (t: Transaction) => {
    const id = t.id;
    const brokerId = t.broker_id;
    const pointsAdd = t.points_requested != null ? Number(t.points_requested) : 0;
    const isAgencyProPackage = t.package_name === "agency_business_pro";
    if (approvingTransactionId !== null || rejectSubmitting) return;
    setApprovingTransactionId(id);

    if (isAgencyProPackage) {
      const { error: rpcErr } = await supabase.rpc("activate_agency_pro_admin", {
        p_broker_id: brokerId,
        p_transaction_id: Number(id),
      });
      if (rpcErr) {
        showToast(rpcErr.message || "فشل تفعيل الباقة", "error");
        setApprovingTransactionId(null);
        return;
      }
      setApprovingTransactionId(null);
      showToast("تم تفعيل اشتراك الوكالة", "success");
      await loadAll();
      safeRouterRefresh(router);
      return;
    }

    if (pointsAdd > 0) {
      const res = await fetch("/api/admin/add-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ p_user_id: brokerId, p_delta: pointsAdd }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        showToast(payload.message || payload.error || "فشل النقاط", "error");
        setApprovingTransactionId(null);
        return;
      }
    } else {
      const { error: walletError } = await supabase.rpc("add_wallet", { user_id: brokerId, amount: t.amount });
      if (walletError) {
        showToast(walletError.message, "error");
        setApprovingTransactionId(null);
        return;
      }
    }

    const { data: updatedRows, error: txError } = await supabase
      .from("transactions")
      .update({ status: "verified", is_verified: true })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");
    if (txError || !updatedRows?.length) {
      showToast(txError?.message || "تعذر تحديث المعاملة", "error");
      setApprovingTransactionId(null);
      await loadAll();
      return;
    }
    setApprovingTransactionId(null);
    showToast("تم تأكيد الشحنة", "success");
    await loadAll();
    safeRouterRefresh(router);
  };

  const rejectTransaction = async () => {
    if (!rejectId || !rejectReason.trim() || rejectSubmitting) return;
    const txId = rejectId;
    const txReason = rejectReason.trim();
    const notes = rejectAdminNotes.trim() || null;
    setRejectSubmitting(true);
    try {
      const { data: updatedRows, error } = await supabase
        .from("transactions")
        .update({ status: "rejected", rejection_reason: txReason, admin_notes: notes })
        .eq("id", txId)
        .eq("status", "pending")
        .select();
      if (error || !updatedRows?.length) {
        showToast(error?.message || "لم يتم الرفض", "error");
        await loadAll();
        return;
      }
      setRejectId(null);
      setRejectReason("");
      setRejectAdminNotes("");
      showToast("تم رفض المعاملة", "success");
      await loadAll();
      safeRouterRefresh(router);
    } finally {
      setRejectSubmitting(false);
    }
  };

  const toggleUserActive = async (id: string, current: boolean) => {
    await supabase.from("profiles").update({ is_active: !current }).eq("id", id);
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, is_active: !current } : u)));
    showToast(!current ? "تم تفعيل الحساب" : "تم إيقاف الحساب", "success");
  };

  const adjustPoints = async (id: string, direction: 1 | -1) => {
    const raw = pointsAdjustInputs[id];
    const amount = Number(raw);
    if (!raw || Number.isNaN(amount) || amount <= 0) {
      showToast("أدخل عدد النقاط", "error");
      return;
    }
    const p_delta = direction * Math.floor(amount);
    const res = await fetch("/api/admin/add-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ p_user_id: id, p_delta }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!res.ok) {
      showToast(payload.message || payload.error || "فشل", "error");
      return;
    }
    setPointsAdjustInputs((prev) => ({ ...prev, [id]: "" }));
    notifyPointsChanged();
    showToast(direction === 1 ? "تمت الإضافة" : "تم الخصم", "success");
    await loadAll();
    safeRouterRefresh(router);
  };

  const setUserRole = async (userId: string, role: "user" | "broker") => {
    setRoleBusyId(userId);
    try {
      const res = await fetch("/api/admin/user-role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user_id: userId, role }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showToast(j.error || "تعذر تحديث الدور", "error");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      showToast("تم تحديث الدور", "success");
      await loadAll();
    } finally {
      setRoleBusyId(null);
    }
  };

  const submitBootstrapAgencyModal = async () => {
    if (!bootstrapModalUserId || !bootstrapAgencyName.trim() || bootstrapSubmitting) return;
    setBootstrapSubmitting(true);
    try {
      const res = await fetch("/api/admin/bootstrap-agency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          user_id: bootstrapModalUserId,
          name: bootstrapAgencyName.trim(),
          ...(bootstrapSlug.trim() ? { slug: bootstrapSlug.trim() } : {}),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        already?: boolean;
      };
      if (!res.ok) {
        showToast(j.message || j.error || "تعذر إنشاء الوكالة", "error");
        return;
      }
      showToast(j.already ? "لديه وكالة بالفعل" : "تم إنشاء الوكالة — تظهر في دليل الوكالات فوراً", "success");
      setBootstrapModalUserId(null);
      setBootstrapAgencyName("");
      setBootstrapSlug("");
      await loadAll();
      safeRouterRefresh(router);
    } finally {
      setBootstrapSubmitting(false);
    }
  };

  const submitSaveAgencyRow = async (agencyId: string) => {
    const d = agencyDrafts[agencyId];
    if (!d || savingAgencyId) return;
    setSavingAgencyId(agencyId);
    try {
      const res = await fetch("/api/admin/agency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          agency_id: agencyId,
          name: d.name.trim(),
          slug: d.slug.trim(),
          is_verified: d.is_verified,
          is_active: d.is_active,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok) {
        showToast(j.message || j.error || "تعذر حفظ الوكالة", "error");
        return;
      }
      showToast("تم تحديث الوكالة", "success");
      await loadAll();
      safeRouterRefresh(router);
    } finally {
      setSavingAgencyId(null);
    }
  };

  const syncAgencyToDirectory = async (agencyId: string) => {
    if (syncingAgencyId) return;
    setSyncingAgencyId(agencyId);
    try {
      const res = await fetch("/api/admin/sync-agency-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agency_id: agencyId }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        slug?: string;
      };
      if (!res.ok) {
        showToast(j.message || j.error || "تعذر مزامنة الدليل", "error");
        return;
      }
      const syncedSlug = typeof j.slug === "string" && j.slug.length > 0 ? j.slug : null;
      if (syncedSlug) {
        setAgencyDrafts((prev) => {
          const cur = prev[agencyId];
          if (!cur) return prev;
          return { ...prev, [agencyId]: { ...cur, slug: syncedSlug } };
        });
      }
      showToast("تمت مزامنة الدليل العام (نشط + موثّق + معتمد + slug)", "success");
      await loadAll();
      safeRouterRefresh(router);
    } finally {
      setSyncingAgencyId(null);
    }
  };

  const submitPlatformAgency = async () => {
    if (!platformAgencyName.trim() || platformAgencyBusy) return;
    setPlatformAgencyBusy(true);
    try {
      const res = await fetch("/api/admin/platform-agency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: platformAgencyName.trim(),
          ...(platformAgencySlug.trim() ? { slug: platformAgencySlug.trim() } : {}),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        showToast(j.message || j.error || "تعذر إنشاء وكالة المنصة", "error");
        return;
      }
      showToast("تم إنشاء وكالة المنصة الرسمية لحسابك", "success");
      setPlatformAgencyModalOpen(false);
      await loadAll();
      safeRouterRefresh(router);
    } finally {
      setPlatformAgencyBusy(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    const { error } = await supabase
      .from("settings")
      .upsert(
        [
          { key: "listing_cost", value: listingCost },
          { key: "banner_text", value: bannerText.trim() },
        ],
        { onConflict: "key" },
      );
    setSavingSettings(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("تم الحفظ", "success");
    await loadAll();
  };

  const openEditProperty = (p: Property) => {
    setSelectedProperty(p);
    setEditTitle(p.title ?? "");
    setEditPrice(String(p.price ?? ""));
    setEditNewImageUrl("");
    setEditAgencyId(p.agency_id ? String(p.agency_id) : "");
  };

  const appendEditImage = async () => {
    if (!selectedProperty || !editNewImageUrl.trim()) return;
    const next = [...(selectedProperty.images ?? []), editNewImageUrl.trim()];
    const { error } = await supabase.from("properties").update({ images: next }).eq("id", selectedProperty.id);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    patchPropertyImages(selectedProperty.id, next);
    setEditNewImageUrl("");
    showToast("تمت إضافة الصورة", "success");
  };

  const savePropertyEdit = async () => {
    if (!selectedProperty) return;
    setSavingPropertyEdit(true);
    try {
      const priceNum = Number(editPrice);
      if (!editTitle.trim() || Number.isNaN(priceNum) || priceNum < 0) {
        showToast("عنوان أو سعر غير صالح", "error");
        return;
      }
      const { error } = await supabase
        .from("properties")
        .update({
          title: editTitle.trim(),
          price: priceNum,
          images: selectedProperty.images ?? [],
        })
        .eq("id", selectedProperty.id);
      if (error) {
        showToast(error.message, "error");
        return;
      }
      const prevAgency = selectedProperty.agency_id ? String(selectedProperty.agency_id) : "";
      const nextAgency = editAgencyId.trim();
      if (prevAgency !== nextAgency) {
        const res = await fetch("/api/admin/property-agency", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            property_id: selectedProperty.id,
            agency_id: nextAgency || null,
          }),
        });
        const pj = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
        if (!res.ok) {
          showToast(pj.message || pj.error || "تم حفظ العنوان والسعر لكن فشل ربط الوكالة", "error");
          await loadAll();
          return;
        }
      }
      showToast("تم حفظ التعديلات", "success");
      setSelectedProperty(null);
      await loadAll();
      safeRouterRefresh(router);
    } finally {
      setSavingPropertyEdit(false);
    }
  };

  const deletePropertyHard = async () => {
    if (deletePropertyId === null) return;
    if (!deleteReason.trim()) {
      showToast("اكتب سبب الحذف", "error");
      return;
    }
    setDeletingProperty(true);
    const idToDelete = deletePropertyId;
    try {
      const { error } = await supabase.from("properties").delete().eq("id", idToDelete);
      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast("تم حذف الإعلان", "success");
      setDeletePropertyId(null);
      setDeleteReason("");
      setSelectedProperty((cur) => (cur?.id === idToDelete ? null : cur));
      await loadAll();
      safeRouterRefresh(router);
    } finally {
      setDeletingProperty(false);
    }
  };

  const vaultTotalRevenue = verifiedTxRows.reduce((s, r) => s + Number(r.amount ?? 0), 0);

  const tryUnlockVault = () => {
    if (vaultPassword === "opensesame") {
      setVaultUnlocked(true);
      setVaultPassword("");
      showToast("تم فتح الخزنة", "success");
    } else {
      showToast("كلمة المرور غير صحيحة", "error");
    }
  };

  const listingCostLabel = useCallback(
    (p: Property) =>
      activationCostLabelAr(
        p,
        p.was_charged
          ? effectiveListingActivationPoints(listingPurposeFromProperty(p), platformSettings)
          : undefined,
      ),
    [platformSettings],
  );

  const savePlatformSettings = async () => {
    setSavingPlatformSettings(true);
    try {
      const res = await fetch("/api/admin/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ad_post_cost_sale: Number(platformSettings.ad_post_cost_sale),
          ad_post_cost_rent: Number(platformSettings.ad_post_cost_rent),
          free_listing_limit: Number(platformSettings.free_listing_limit),
          promo_discount_percentage: Number(platformSettings.promo_discount_percentage),
          sale_mode_enabled: platformSettings.sale_mode_enabled,
          sale_mode_bonus_points_percent: Number(platformSettings.sale_mode_bonus_points_percent),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; settings?: PlatformSettingsRow };
      if (!res.ok) {
        showToast(j.error || "تعذر حفظ إعدادات المنصة", "error");
        return;
      }
      if (j.settings) setPlatformSettings(normalizePlatformSettings(j.settings));
      showToast("تم حفظ إعدادات المنصة", "success");
    } finally {
      setSavingPlatformSettings(false);
    }
  };

  const sendUserNotification = async () => {
    if (!notifyUserId || !notifyTitle.trim() || !notifyBody.trim()) return;
    setNotifySending(true);
    try {
      const res = await fetch("/api/admin/notify-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          user_id: notifyUserId,
          title: notifyTitle.trim(),
          body: notifyBody.trim(),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        showToast(j.error || "تعذر الإرسال", "error");
        return;
      }
      showToast("تم إرسال الإشعار", "success");
      setNotifyUserId(null);
      setNotifyBody("");
      setNotifyTitle("إشعار من الإدارة");
    } finally {
      setNotifySending(false);
    }
  };

  if (!authReady || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 size-10 animate-spin text-emerald-400" aria-hidden />
          <p className="text-sm font-semibold">جاري تحميل لوحة التحكم…</p>
        </div>
      </div>
    );
  }

  const badge = (key: keyof Stats | undefined) => {
    if (!key) return null;
    const n = stats[key];
    if (typeof n !== "number" || n <= 0) return null;
    return (
      <span className="me-auto rounded-full bg-rose-500/90 px-2 py-0.5 text-[11px] font-bold text-white">
        {n > 99 ? "99+" : n}
      </span>
    );
  };

  const NavButton = ({
    item,
    mobile = false,
  }: {
    item: (typeof SIDEBAR)[number];
    mobile?: boolean;
  }) => {
    const Icon = item.icon;
    const active = tab === item.id;
    return (
      <button
        type="button"
        onClick={() => {
          setTab(item.id);
          if (mobile) setSidebarOpen(false);
        }}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
          active
            ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40"
            : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
        }`}
      >
        <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
        <span className="flex-1 text-start">{item.label}</span>
        {badge(item.badge)}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir="rtl">
      {/* Mobile sidebar overlay */}
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          aria-label="إغلاق القائمة"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 z-50 w-72 shrink-0 border-s border-slate-800 bg-slate-950 end-0 md:static ${
            sidebarOpen ? "flex flex-col" : "hidden md:flex md:flex-col"
          }`}
        >
          <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-4">
            <SiteBrandLogo layout="icon" />
            <div>
              <div className="text-sm font-black text-white">دورلي</div>
              <div className="text-[11px] font-semibold text-slate-500">لوحة تحكم الإدارة</div>
            </div>
            <button
              type="button"
              className="ms-auto rounded-lg p-2 text-slate-400 hover:bg-slate-800 md:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="إغلاق"
            >
              <X className="size-5" />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {SIDEBAR.map((item) => (
              <NavButton key={item.id} item={item} mobile />
            ))}
          </nav>
          <div className="border-t border-slate-800 p-3">
            <Link
              href="/"
              className="mb-2 flex items-center justify-center rounded-xl border border-slate-700 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
            >
              الموقع العام
            </Link>
            <button
              type="button"
              onClick={() => void supabase.auth.signOut().then(() => router.push("/login"))}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-700"
            >
              <LogOut className="size-4" />
              خروج
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex flex-col gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur md:flex-row md:items-center md:px-6">
            <div className="flex items-center gap-2 md:hidden">
              <button
                type="button"
                className="rounded-lg border border-slate-700 p-2 text-slate-200"
                onClick={() => setSidebarOpen(true)}
                aria-label="القائمة"
              >
                <Menu className="size-5" />
              </button>
              <span className="text-sm font-black">الإدارة</span>
            </div>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={omniSearch}
                onChange={(e) => setOmniSearch(e.target.value)}
                placeholder="ابحث عن مستخدم، إعلان، وكالة…"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pe-10 ps-3 text-sm font-semibold text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {omniHits.length > 0 ? (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                  {omniHits.map((h) => (
                    <button
                      key={h.key}
                      type="button"
                      onClick={h.onSelect}
                      className="flex w-full flex-col items-start gap-0.5 border-b border-slate-800 px-3 py-2 text-start text-sm hover:bg-slate-800"
                    >
                      <span className="font-bold text-white">{h.title}</span>
                      <span className="text-xs text-slate-400">{h.subtitle}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void loadAll()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
            >
              <RefreshCw className="size-4" />
              تحديث
            </button>
          </header>

          <main className="flex-1 space-y-6 p-4 md:p-6">
            {verifiedTxError ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                تعذر تحميل بعض بيانات الشحنات المؤكدة: {verifiedTxError}
              </div>
            ) : null}

            {tab === "overview" && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {(
                    [
                      {
                        label: "إيرادات مؤكدة (ج.م)",
                        value: stats.totalCharged.toLocaleString("ar-EG"),
                        trend: overviewTrends.revenue,
                        tone: "emerald",
                        trendHint: "إيرادات مؤكدة أُضيفت خلال ٧ أيام مقارنة بالأسبوع السابق",
                      },
                      {
                        label: "إعلانات نشطة",
                        value: stats.publishedProperties,
                        trend: overviewTrends.listings,
                        tone: "sky",
                        trendHint: "إعلانات نشطة جُددت خلال ٧ أيام مقارنة بالأسبوع السابق",
                      },
                      {
                        label: "تسجيلات اليوم",
                        value: stats.signupsToday,
                        trend: overviewTrends.signups,
                        tone: "violet",
                        trendHint: "حسابات جديدة خلال ٧ أيام مقارنة بالأسبوع السابق",
                      },
                      {
                        label: "عملاء مهتمين",
                        value: stats.totalLeads,
                        trend: overviewTrends.leads,
                        tone: "amber",
                        trendHint: "طلبات جديدة خلال ٧ أيام مقارنة بالأسبوع السابق",
                      },
                    ] as const
                  ).map(
                    (c: {
                      label: string;
                      value: string | number;
                      trend: ReturnType<typeof pctTrendVsPreviousWeek>;
                      tone: "emerald" | "sky" | "violet" | "amber";
                      trendHint: string;
                    }) => {
                    const ring =
                      c.tone === "emerald"
                        ? "ring-teal-500/25"
                        : c.tone === "sky"
                          ? "ring-sky-500/25"
                          : c.tone === "violet"
                            ? "ring-violet-500/25"
                            : "ring-amber-500/25";
                    return (
                      <div
                        key={c.label}
                        className={`relative overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-950/50 p-5 shadow-inner ring-1 ${ring}`}
                      >
                        <div className="relative text-xs font-bold tracking-wide text-slate-500">{c.label}</div>
                        <div className="relative mt-2 font-black tabular-nums tracking-tight text-white text-2xl">
                          {c.value}
                        </div>
                        <div
                          className={`relative mt-2 flex flex-wrap items-center gap-1 text-xs font-black tabular-nums ${
                            c.trend.muted ? "text-slate-500" : c.trend.up ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {c.trend.muted ? null : c.trend.up ? (
                            <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
                          ) : (
                            <ArrowDownRight className="size-3.5 shrink-0" aria-hidden />
                          )}
                          <span>{c.trend.text}</span>
                          <span className="font-semibold text-slate-500">أسبوع مقابل السابق</span>
                        </div>
                        <p className="relative mt-1.5 text-[10px] font-medium leading-relaxed text-slate-500">
                          {c.trendHint}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <section className="overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-950/40 shadow-lg ring-1 ring-violet-500/10">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Inbox className="size-5 text-violet-400" aria-hidden />
                      <h2 className="text-base font-black text-white">صندوق الطلبات</h2>
                    </div>
                    <span className="text-xs font-bold text-slate-500 tabular-nums">آخر ٥ طلبات</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm tabular-nums">
                      <thead>
                        <tr className="border-b border-slate-800 text-right text-[11px] font-black uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-2.5">المستخدم</th>
                          <th className="px-4 py-2.5">الإعلان</th>
                          <th className="px-4 py-2.5">التواصل</th>
                          <th className="px-4 py-2.5">الوقت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {leads.slice(0, 5).map((l) => (
                          <tr key={String(l.id)} className="hover:bg-slate-900/50">
                            <td className="px-4 py-2.5 font-bold text-white">{l.client_name}</td>
                            <td className="px-4 py-2.5">
                              <Link
                                href={propertyPathFromRecord({ id: l.property_id, slug: l.property_slug ?? null })}
                                className="line-clamp-2 text-xs font-semibold text-teal-300/95 underline-offset-2 hover:underline"
                              >
                                {l.property_title}
                              </Link>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs text-sky-300">{l.client_phone}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-400">
                              {new Date(l.created_at).toLocaleString("ar-EG", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {leads.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-slate-500">لا طلبات بعد.</p>
                    ) : null}
                  </div>
                </section>

                <div className="grid gap-6 lg:grid-cols-5">
                  <div className="rounded-2xl border border-slate-800/90 bg-slate-950/40 p-5 shadow-lg ring-1 ring-teal-500/10 lg:col-span-3">
                    <div className="mb-4 flex items-center gap-2">
                      <BarChart3 className="size-5 text-teal-400" aria-hidden />
                      <h2 className="text-base font-black text-white">أداء الوكالات حسب العملاء</h2>
                    </div>
                    {agencyLeadStats.length === 0 ? (
                      <p className="text-sm text-slate-500">لا توجد بيانات عملاء كافية.</p>
                    ) : (
                      <div className="h-72 w-full min-w-0" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={agencyLeadStats} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
                            <defs>
                              <linearGradient id="adminAgencyBar" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor={ADMIN_NEON.teal} />
                                <stop offset="100%" stopColor={ADMIN_NEON.purple} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="4 4" stroke={ADMIN_NEON.grid} horizontal={false} opacity={0.5} />
                            <XAxis type="number" stroke="#64748b" tick={{ fill: ADMIN_NEON.tick, fontSize: 11 }} />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={132}
                              stroke="#64748b"
                              tick={{ fill: "#e2e8f0", fontSize: 10 }}
                            />
                            <Tooltip {...chartTooltipStyle} />
                            <Bar dataKey="count" fill="url(#adminAgencyBar)" radius={[0, 8, 8, 0]} name="عملاء" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-slate-800/90 bg-slate-950/40 p-5 shadow-lg ring-1 ring-amber-500/10 lg:col-span-2">
                    <h2 className="mb-1 text-base font-black text-white">مصادر الإيراد</h2>
                    <p className="mb-3 text-[11px] font-medium text-slate-500">فرد / وسيط مقابل مالكي وكالات (حسب المستلم)</p>
                    {revenueSourceDonut.length === 0 ? (
                      <p className="text-sm text-slate-500">لا شحنات مؤكدة بعد.</p>
                    ) : (
                      <div className="h-64 w-full min-w-0" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={revenueSourceDonut}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={52}
                              outerRadius={82}
                              paddingAngle={2}
                              stroke="#020617"
                              strokeWidth={1}
                            >
                              {revenueSourceDonut.map((_, i) => (
                                <Cell key={String(i)} fill={REVENUE_DONUT_COLORS[i % REVENUE_DONUT_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              {...chartTooltipStyle}
                              formatter={(value) => {
                                const v = typeof value === "number" ? value : Number(value ?? 0);
                                return [`${v.toLocaleString("ar-EG")} ج.م`, "المبلغ"];
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/90 bg-slate-950/40 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-black text-white">شحنات معلقة</h2>
                    <p className="mt-1 text-3xl font-black tabular-nums text-rose-300">{stats.pendingTransactions}</p>
                    <p className="mt-1 text-sm text-slate-400">راجع تبويب «سجل المدفوعات» للموافقة السريعة.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab("ledger")}
                    className="shrink-0 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-950/30 hover:bg-emerald-500"
                  >
                    فتح السجل
                  </button>
                </div>
              </div>
            )}

            {tab === "queue" && (
              <div className="space-y-4">
                <h1 className="text-xl font-black text-white">طابور الموافقة</h1>
                {pendingQueue.length === 0 ? (
                  <p className="text-slate-500">لا توجد إعلانات بانتظار المراجعة.</p>
                ) : (
                  pendingQueue.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start">
                        <div className="min-w-0 flex-1">
                          <div className="font-black text-white">{p.title}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {p.profiles?.name} · #{p.id} · {listingCostLabel(p)}
                          </div>
                        </div>
                        <div className="w-full shrink-0 md:max-w-md">
                          <PropertyImagesAdmin
                            propertyId={p.id}
                            images={p.images ?? []}
                            editable
                            compact
                            onUpdated={(next) => patchPropertyImages(p.id, next)}
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={approvingPropertyId !== null}
                          onClick={() => void approveProperty(p)}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {approvingPropertyId === p.id ? (
                            <Loader2 className="inline size-4 animate-spin" />
                          ) : null}
                          موافقة فورية
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectId(p.id);
                            setRejectType("property");
                          }}
                          className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-2 text-sm font-black text-rose-200 hover:bg-rose-500/20"
                        >
                          رفض مع سبب
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditProperty(p)}
                          className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => void openAdminPreview(p.id)}
                          className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-bold text-sky-300 hover:bg-slate-800"
                        >
                          معاينة
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "listings" && (
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30">
                <div className="flex flex-col gap-3 border-b border-slate-800 p-4 md:flex-row md:items-center">
                  <h2 className="text-lg font-black text-white">الإعلانات ({filteredListings.length})</h2>
                  <select
                    value={propertyStatusFilter}
                    onChange={(e) =>
                      setPropertyStatusFilter(e.target.value as typeof propertyStatusFilter)
                    }
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white"
                  >
                    <option value="all">كل الحالات</option>
                    <option value="pending">معلق</option>
                    <option value="active">نشط</option>
                    <option value="rejected">مرفوض</option>
                  </select>
                  {ownerFilter ? (
                    <button
                      type="button"
                      onClick={() => setOwnerFilter(null)}
                      className="text-xs font-bold text-rose-300 underline"
                    >
                      إلغاء فلتر المالك
                    </button>
                  ) : null}
                </div>
                <div className="p-4">
                  <input
                    value={propertySearch}
                    onChange={(e) => setPropertySearch(e.target.value)}
                    placeholder="بحث بالعنوان أو المالك…"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold"
                  />
                </div>
                <div className="divide-y divide-slate-800">
                  {filteredListings.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-col gap-2 px-4 py-3 hover:bg-slate-800/40 md:flex-row md:items-center"
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-start"
                        onClick={() => openEditProperty(p)}
                      >
                        <div className="font-bold text-white">{p.title}</div>
                        <div className="text-xs text-slate-400">
                          <span
                            className="text-emerald-400 underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              filterByOwner(p.profiles?.id);
                            }}
                          >
                            {p.profiles?.name}
                          </span>
                          {" · "}
                          {p.price?.toLocaleString()} ج.م · {p.status}
                        </div>
                      </button>
                      <div className="flex flex-wrap gap-2">
                        {isAwaitingPropertyApproval(p.status) ? (
                          <button
                            type="button"
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white"
                            onClick={() => void approveProperty(p)}
                          >
                            موافقة
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-bold"
                          onClick={() => openEditProperty(p)}
                        >
                          تعديل إداري
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-sky-600/50 px-3 py-1.5 text-xs font-bold text-sky-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            void openAdminPreview(p.id);
                          }}
                        >
                          معاينة
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-rose-600/50 px-3 py-1.5 text-xs font-bold text-rose-300"
                          onClick={() => {
                            setDeletePropertyId(p.id);
                            setDeleteReason("");
                          }}
                        >
                          حذف نهائي
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "users" && (
              <div className="space-y-6">
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30">
                <div className="border-b border-slate-800 p-4">
                  <h2 className="mb-3 text-lg font-black">المستخدمون ({filteredUsers.length})</h2>
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="اسم، هاتف، أو معرف…"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold"
                  />
                  {profilesError ? (
                    <p className="mt-2 text-sm text-rose-300">{profilesError}</p>
                  ) : null}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-right text-xs font-black text-slate-500">
                        <th className="px-4 py-3">المستخدم</th>
                        <th className="px-4 py-3">النقاط</th>
                        <th className="px-4 py-3">تاريخ التسجيل</th>
                        <th className="px-4 py-3">الدور</th>
                        <th className="px-4 py-3">وكالة</th>
                        <th className="px-4 py-3">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredUsers.map((u) => {
                        const ag = agencies.find((a) => a.owner_id === u.id);
                        return (
                          <tr key={u.id} className="text-slate-200">
                            <td className="px-4 py-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-bold text-white">{u.name}</div>
                                  <div className="text-xs text-slate-500">{u.phone}</div>
                                </div>
                                <button
                                  type="button"
                                  disabled={u.role === "admin"}
                                  title="إشعار نظام يظهر في لوحة تحكم الوسيط"
                                  onClick={() => {
                                    setNotifyUserId(u.id);
                                    setNotifyTitle("إشعار من الإدارة");
                                    setNotifyBody("");
                                  }}
                                  className="shrink-0 rounded-lg border border-sky-600/60 bg-sky-950/50 px-2 py-1 text-[11px] font-black text-sky-200 hover:bg-sky-900/60 disabled:opacity-40"
                                >
                                  <span className="inline-flex items-center gap-1">
                                    <MessageSquare className="size-3.5" aria-hidden />
                                    إشعار
                                  </span>
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-emerald-300">{u.points ?? 0}</td>
                            <td className="px-4 py-3 text-xs text-slate-400">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString("ar-EG") : "—"}
                            </td>
                            <td className="px-4 py-3 text-xs font-bold text-sky-300">{u.role ?? "—"}</td>
                            <td className="px-4 py-3 text-xs">{ag ? ag.name : "—"}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-2">
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    type="button"
                                    disabled={u.role === "admin" || roleBusyId === u.id}
                                    onClick={() => void setUserRole(u.id, "broker")}
                                    className="rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-bold disabled:opacity-40"
                                  >
                                    {roleBusyId === u.id ? <Loader2 className="inline size-3 animate-spin" /> : null}
                                    وسيط
                                  </button>
                                  <button
                                    type="button"
                                    disabled={u.role === "admin" || roleBusyId === u.id}
                                    onClick={() => void setUserRole(u.id, "user")}
                                    className="rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-bold disabled:opacity-40"
                                  >
                                    مستخدم
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      u.role === "admin" ||
                                      Boolean(ag) ||
                                      bootstrapSubmitting ||
                                      bootstrapModalUserId !== null
                                    }
                                    onClick={() => {
                                      setBootstrapModalUserId(u.id);
                                      setBootstrapAgencyName((u.name ?? "").trim() || "وكالة عقارية");
                                      setBootstrapSlug("");
                                    }}
                                    className="rounded-lg bg-emerald-900/50 px-2 py-1 text-[11px] font-bold text-emerald-200 disabled:opacity-40"
                                  >
                                    وكالة
                                  </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-1">
                                  <input
                                    className="w-20 rounded border border-slate-700 bg-slate-950 px-1 py-1 text-center text-xs"
                                    placeholder="نقاط"
                                    value={pointsAdjustInputs[u.id] ?? ""}
                                    onChange={(e) =>
                                      setPointsAdjustInputs((prev) => ({ ...prev, [u.id]: e.target.value }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="rounded bg-emerald-800 px-2 py-1 text-[11px] font-bold"
                                    onClick={() => void adjustPoints(u.id, 1)}
                                  >
                                    +
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded bg-rose-900/60 px-2 py-1 text-[11px] font-bold"
                                    onClick={() => void adjustPoints(u.id, -1)}
                                  >
                                    −
                                  </button>
                                  <button
                                    type="button"
                                    disabled={u.role === "admin"}
                                    onClick={() => void toggleUserActive(u.id, u.is_active)}
                                    className="rounded border border-slate-600 px-2 py-1 text-[11px] font-bold disabled:opacity-40"
                                  >
                                    {u.is_active ? "حظر" : "رفع حظر"}
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30">
                <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-black text-white">الوكالات ({agencies.length})</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setPlatformAgencyModalOpen(true);
                      setPlatformAgencyName("دَورلي — وكالة المنصة الرسمية");
                      setPlatformAgencySlug("");
                    }}
                    className="rounded-xl border border-emerald-600/50 bg-emerald-950/40 px-4 py-2 text-sm font-black text-emerald-200 hover:bg-emerald-900/40"
                  >
                    وكالة منصة رسمية (حساب الإدارة)
                  </button>
                </div>
                <div className="overflow-x-auto p-4">
                  {agencies.length === 0 ? (
                    <p className="text-sm text-slate-500">لا توجد وكالات مسجّلة.</p>
                  ) : (
                    <table className="w-full min-w-[1040px] text-sm text-slate-200">
                      <thead>
                        <tr className="border-b border-slate-800 text-right text-xs font-black text-slate-500">
                          <th className="px-2 py-2">الاسم الرسمي</th>
                          <th className="px-2 py-2">slug</th>
                          <th className="px-2 py-2">موثّق</th>
                          <th className="px-2 py-2">ظهور</th>
                          <th className="px-2 py-2">المالك</th>
                          <th className="px-2 py-2">الدليل</th>
                          <th className="px-2 py-2">حفظ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {agencies.map((a) => {
                          const d =
                            agencyDrafts[a.id] ?? {
                              name: a.name,
                              slug: a.slug,
                              is_verified: a.is_verified !== false,
                              is_active: a.is_active !== false,
                            };
                          const owner = users.find((u) => u.id === a.owner_id);
                          return (
                            <tr key={a.id}>
                              <td className="px-2 py-2">
                                <input
                                  value={d.name}
                                  onChange={(e) =>
                                    setAgencyDrafts((prev) => ({
                                      ...prev,
                                      [a.id]: { ...d, name: e.target.value },
                                    }))
                                  }
                                  className="w-full min-w-[140px] rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  value={d.slug}
                                  onChange={(e) =>
                                    setAgencyDrafts((prev) => ({
                                      ...prev,
                                      [a.id]: { ...d, slug: e.target.value },
                                    }))
                                  }
                                  className="w-full min-w-[120px] rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs"
                                />
                              </td>
                              <td className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={d.is_verified}
                                  onChange={(e) =>
                                    setAgencyDrafts((prev) => ({
                                      ...prev,
                                      [a.id]: { ...d, is_verified: e.target.checked },
                                    }))
                                  }
                                  className="size-4"
                                />
                              </td>
                              <td className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={d.is_active}
                                  onChange={(e) =>
                                    setAgencyDrafts((prev) => ({
                                      ...prev,
                                      [a.id]: { ...d, is_active: e.target.checked },
                                    }))
                                  }
                                  title="is_active — يظهر في /agencies عندما يكون مفعّلاً"
                                  className="size-4"
                                />
                              </td>
                              <td className="px-2 py-2 text-xs text-slate-400">
                                {owner?.name ?? a.owner_id.slice(0, 8)}
                              </td>
                              <td className="px-2 py-2">
                                <button
                                  type="button"
                                  disabled={syncingAgencyId === a.id}
                                  onClick={() => void syncAgencyToDirectory(a.id)}
                                  title="Sync to Directory: is_active, is_verified, status=approved, slug"
                                  className="whitespace-nowrap rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-2 py-1 text-[11px] font-black text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-50"
                                >
                                  {syncingAgencyId === a.id ? (
                                    <Loader2 className="inline size-3 animate-spin" />
                                  ) : (
                                    "Sync to Directory"
                                  )}
                                </button>
                              </td>
                              <td className="px-2 py-2">
                                <button
                                  type="button"
                                  disabled={savingAgencyId === a.id}
                                  onClick={() => void submitSaveAgencyRow(a.id)}
                                  className="rounded-lg bg-sky-700 px-3 py-1 text-xs font-black text-white disabled:opacity-50"
                                >
                                  {savingAgencyId === a.id ? (
                                    <Loader2 className="inline size-3 animate-spin" />
                                  ) : null}
                                  حفظ
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                <p className="border-t border-slate-800 px-4 py-3 text-xs text-slate-500">
                  تغيير الـ slug يحدّث الرابط فوراً؛ الروابط القديمة لا تعيد التوجيه تلقائياً.
                </p>
              </div>
              </div>
            )}

            {tab === "ledger" && (
              <div className="space-y-4">
                <h1 className="text-xl font-black">سجل المدفوعات والنقاط</h1>
                <input
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  placeholder="بحث في السجل…"
                  className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold"
                />
                <div className="overflow-hidden rounded-2xl border border-slate-800">
                  <div className="divide-y divide-slate-800">
                    {filteredLedger.map((t) => (
                      <div key={t.id} className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-bold text-white">
                            #{t.id} · {t.amount?.toLocaleString("ar-EG")} ج.م
                          </div>
                          <div className="text-xs text-slate-400">
                            {t.profiles?.name} · {t.profiles?.phone} ·{" "}
                            <span
                              className={
                                t.status === "verified"
                                  ? "text-emerald-400"
                                  : t.status === "pending"
                                    ? "text-amber-300"
                                    : "text-rose-300"
                              }
                            >
                              {t.status}
                            </span>
                            {t.points_requested != null ? ` · ${t.points_requested} نقطة` : ""}
                            {t.package_name ? ` · ${t.package_name}` : ""}
                          </div>
                          {t.rejection_reason ? (
                            <div className="mt-1 text-xs text-rose-200">سبب الرفض: {t.rejection_reason}</div>
                          ) : null}
                          {t.created_at ? (
                            <div className="text-[11px] text-slate-500">
                              {new Date(t.created_at).toLocaleString("ar-EG")}
                            </div>
                          ) : null}
                        </div>
                        {t.status === "pending" ? (
                          <div className="flex flex-wrap gap-2">
                            <a
                              href={t.screenshot_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-bold"
                            >
                              إيصال
                            </a>
                            <button
                              type="button"
                              disabled={approvingTransactionId !== null}
                              onClick={() => void approveTransaction(t as Transaction)}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white"
                            >
                              تأكيد
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectId(t.id);
                                setRejectType("transaction");
                              }}
                              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-black text-white"
                            >
                              رفض
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {tab === "leads" && (
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30">
                <div className="border-b border-slate-800 p-4">
                  <h2 className="text-lg font-black">العملاء ({leads.length})</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-right text-xs font-black text-slate-500">
                        <th className="px-3 py-2">العميل</th>
                        <th className="px-3 py-2">الهاتف</th>
                        <th className="px-3 py-2">المالك</th>
                        <th className="px-3 py-2">الإعلان</th>
                        <th className="px-3 py-2">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {leads.map((l) => (
                        <tr key={String(l.id)}>
                          <td className="px-3 py-2 font-bold">{l.client_name}</td>
                          <td className="px-3 py-2 font-mono text-xs text-sky-300">{l.client_phone}</td>
                          <td className="px-3 py-2 text-xs">{l.owner_name}</td>
                          <td className="px-3 py-2 text-xs text-slate-400">{l.property_title}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">
                            {new Date(l.created_at).toLocaleDateString("ar-EG")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "vault" && (
              <div className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-slate-800/90 bg-slate-950/45 p-6 shadow-xl ring-1 ring-amber-500/15">
                <h2 className="flex items-center gap-2 text-lg font-black tracking-tight text-white">
                  <Vault className="size-5 text-amber-400" aria-hidden />
                  الخزنة — المالية
                </h2>
                {!vaultUnlocked ? (
                  <div className="max-w-md space-y-3">
                    <input
                      type="password"
                      value={vaultPassword}
                      onChange={(e) => setVaultPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && tryUnlockVault()}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm tabular-nums"
                      placeholder="كلمة المرور"
                    />
                    <button
                      type="button"
                      onClick={tryUnlockVault}
                      className="w-full rounded-xl bg-amber-600 py-2 text-sm font-black text-white hover:bg-amber-500"
                    >
                      فتح
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div>
                      <p className="text-sm font-semibold text-slate-400">إجمالي الشحنات المؤكدة</p>
                      <p className="mt-1 text-3xl font-black tabular-nums tracking-tight text-emerald-300">
                        {vaultTotalRevenue.toLocaleString("ar-EG")} ج.م
                      </p>
                    </div>

                    <section className="rounded-2xl border border-slate-800/90 bg-slate-900/35 p-4 ring-1 ring-teal-500/10">
                      <h3 className="mb-1 text-sm font-black text-white">إيراد يومي (آخر ١٤ يوماً)</h3>
                      <p className="mb-4 text-[11px] font-medium text-slate-500">
                        مرّر المؤشر لعرض التاريخ الكامل والمبلغ — المحور أفقي بتنسيق MM-DD
                      </p>
                      <div className="h-72 w-full min-w-0" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={vaultChartData} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
                            <defs>
                              <linearGradient id="vaultBarNeon" x1="0" y1="1" x2="0" y2="0">
                                <stop offset="0%" stopColor="#0f766e" />
                                <stop offset="55%" stopColor="#7c3aed" />
                                <stop offset="100%" stopColor="#2dd4bf" />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="4 4" stroke={ADMIN_NEON.grid} vertical={false} opacity={0.45} />
                            <XAxis
                              dataKey="labelShort"
                              tick={{ fill: ADMIN_NEON.tick, fontSize: 10, fontFamily: "ui-monospace, monospace" }}
                              axisLine={{ stroke: "#475569" }}
                            />
                            <YAxis
                              tick={{ fill: ADMIN_NEON.tick, fontSize: 11 }}
                              axisLine={{ stroke: "#475569" }}
                              tickFormatter={(v) => Number(v).toLocaleString("ar-EG")}
                            />
                            <Tooltip
                              contentStyle={chartTooltipStyle.contentStyle}
                              labelStyle={chartTooltipStyle.labelStyle}
                              labelFormatter={(_l, payload) =>
                                String((payload?.[0]?.payload as { labelFull?: string })?.labelFull ?? "")
                              }
                              formatter={(value) => [
                                `${Number(value).toLocaleString("ar-EG")} ج.م`,
                                "إجمالي اليوم",
                              ]}
                            />
                            <Bar dataKey="amount" fill="url(#vaultBarNeon)" radius={[6, 6, 0, 0]} name="إيراد" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </section>

                    <section className="overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/30 ring-1 ring-violet-500/10">
                      <div className="border-b border-slate-800/80 px-4 py-3">
                        <h3 className="text-sm font-black text-white">سجل المعاملات</h3>
                        <p className="mt-0.5 text-[11px] text-slate-500">آخر ٥٠ عملية مؤكدة — المصدر والوسم استنتاجية من البيانات المتاحة</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-sm tabular-nums">
                          <thead>
                            <tr className="border-b border-slate-800 text-right text-[11px] font-black uppercase tracking-wide text-slate-500">
                              <th className="px-3 py-2.5">التاريخ</th>
                              <th className="px-3 py-2.5">المبلغ</th>
                              <th className="px-3 py-2.5">المصدر</th>
                              <th className="px-3 py-2.5">طريقة الدفع</th>
                              <th className="px-3 py-2.5">الحالة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80">
                            {vaultTransactionLog.map((row) => (
                              <tr key={row.id} className="hover:bg-slate-900/40">
                                <td className="px-3 py-2.5 text-xs text-slate-300">
                                  {new Date(row.created_at).toLocaleString("ar-EG", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })}
                                </td>
                                <td className="px-3 py-2.5 font-black text-teal-200">
                                  {Number(row.amount).toLocaleString("ar-EG")} ج.م
                                </td>
                                <td className="px-3 py-2.5 text-xs font-semibold text-slate-200">{row.sourceLabel}</td>
                                <td className="px-3 py-2.5 text-xs text-slate-400">{row.paymentLabel}</td>
                                <td className="px-3 py-2.5">
                                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-black text-emerald-300 ring-1 ring-emerald-500/35">
                                    مؤكد
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {vaultTransactionLog.length === 0 ? (
                          <p className="px-4 py-8 text-center text-sm text-slate-500">لا معاملات مؤكدة بعد.</p>
                        ) : null}
                      </div>
                    </section>

                    <button
                      type="button"
                      onClick={() => setVaultUnlocked(false)}
                      className="text-sm font-bold text-slate-400 underline underline-offset-2 hover:text-slate-200"
                    >
                      قفل الخزنة
                    </button>
                  </div>
                )}
              </div>
            )}

            {tab === "settings" && (
              <div className="mx-auto max-w-2xl space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                  <h3 className="mb-1 text-base font-black text-white">جدول platform_settings (صف واحد id=1)</h3>
                  <p className="mb-3 text-xs text-slate-500">
                    تكلفة النقاط عند التفعيل، حد الإعلانات المجانية، ونسبة الخصم عند تفعيل وضع العروض — يُحفظ في
                    Supabase عند الضغط على «حفظ إعدادات المنصة».
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-bold text-slate-400">
                      ad_post_cost_rent — نقاط تفعيل إيجار
                      <input
                        type="number"
                        min={0}
                        value={platformSettings.ad_post_cost_rent}
                        onChange={(e) =>
                          setPlatformSettings((s) => ({
                            ...s,
                            ad_post_cost_rent: Number(e.target.value) || 0,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-400">
                      ad_post_cost_sale — نقاط تفعيل بيع
                      <input
                        type="number"
                        min={0}
                        value={platformSettings.ad_post_cost_sale}
                        onChange={(e) =>
                          setPlatformSettings((s) => ({
                            ...s,
                            ad_post_cost_sale: Number(e.target.value) || 0,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-400">
                      free_listing_limit — حد الإعلانات المجانية
                      <input
                        type="number"
                        min={0}
                        value={platformSettings.free_listing_limit}
                        onChange={(e) =>
                          setPlatformSettings((s) => ({
                            ...s,
                            free_listing_limit: Number(e.target.value) || 0,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-400">
                      promo_discount_percentage — خصم % على نقاط التفعيل (مع وضع العروض)
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={platformSettings.promo_discount_percentage}
                        onChange={(e) =>
                          setPlatformSettings((s) => ({
                            ...s,
                            promo_discount_percentage: Number(e.target.value) || 0,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => void savePlatformSettings()}
                    disabled={savingPlatformSettings}
                    className="mt-4 w-full rounded-xl bg-emerald-700 py-2.5 text-sm font-black text-white disabled:opacity-50"
                  >
                    {savingPlatformSettings ? "جاري الحفظ…" : "حفظ إعدادات المنصة (platform_settings)"}
                  </button>
                </div>

                <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-black text-amber-100">وضع العروض (Sale Mode)</h3>
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-amber-50">
                      <input
                        type="checkbox"
                        checked={platformSettings.sale_mode_enabled}
                        onChange={(e) =>
                          setPlatformSettings((s) => ({ ...s, sale_mode_enabled: e.target.checked }))
                        }
                        className="size-4 rounded border-amber-400"
                      />
                      تفعيل
                    </label>
                  </div>
                  <p className="mb-3 text-xs text-amber-200/90">
                    عند التفعيل: يُطبَّق <strong className="text-amber-100">promo_discount_percentage</strong> أعلاه
                    على نقاط تفعيل الإعلان (دالة handle_admin_approval)، وتُمنح{" "}
                    <strong className="text-amber-100">مكافأة إضافية</strong> كنسبة من نقاط شحن المحفظة عند تأكيد
                    الإدارة لطلب الشحن.
                  </p>
                  <label className="text-xs font-bold text-amber-200/80">
                    sale_mode_bonus_points_percent — مكافأة % على نقاط الشحن
                    <input
                      type="number"
                      min={0}
                      max={500}
                      step={1}
                      value={platformSettings.sale_mode_bonus_points_percent}
                      onChange={(e) =>
                        setPlatformSettings((s) => ({
                          ...s,
                          sale_mode_bonus_points_percent: Number(e.target.value) || 0,
                        }))
                      }
                      className="mt-1 w-full max-w-xs rounded-lg border border-amber-800/60 bg-slate-950 px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void savePlatformSettings()}
                    disabled={savingPlatformSettings}
                    className="mt-4 w-full rounded-xl bg-amber-600 py-2.5 text-sm font-black text-white disabled:opacity-50"
                  >
                    {savingPlatformSettings ? "جاري الحفظ…" : "حفظ وضع العروض + المكافأة"}
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                  <h3 className="mb-2 text-sm font-black text-slate-300">إعدادات قديمة (ج.م / بنر)</h3>
                  <label className="text-xs font-bold text-slate-400">تكلفة الإعلان (ج.م) — جدول settings</label>
                  <input
                    type="number"
                    value={listingCost}
                    onChange={(e) => setListingCost(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  />
                  <label className="mt-3 block text-xs font-bold text-slate-400">نص البنر</label>
                  <textarea
                    value={bannerText}
                    onChange={(e) => setBannerText(e.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void saveSettings()}
                    disabled={savingSettings}
                    className="mt-4 w-full rounded-xl bg-slate-700 py-2.5 text-sm font-black text-white disabled:opacity-50"
                  >
                    {savingSettings ? "جاري الحفظ…" : "حفظ البنر وتكلفة الإعلان القديمة"}
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Bootstrap agency: official name + optional slug */}
      {bootstrapModalUserId ? (
        <div
          className="fixed inset-0 z-[212] flex items-center justify-center bg-black/60 p-4"
          onClick={() => !bootstrapSubmitting && setBootstrapModalUserId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black text-white">تحويل إلى وكالة</h3>
            <p className="mt-1 text-xs text-slate-500">
              أدخل الاسم الرسمي للوكالة كما يظهر للجمهور. يُفعَّل الظهور في دليل الوكالات فوراً (موثّق + نشط).
            </p>
            <label className="mt-4 block text-xs font-bold text-slate-400">اسم الوكالة الرسمي *</label>
            <input
              value={bootstrapAgencyName}
              onChange={(e) => setBootstrapAgencyName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="مثال: وكالة النخيل العقارية"
            />
            <label className="mt-3 block text-xs font-bold text-slate-400">
              slug (اختياري — يُشتق من الاسم إن تُرك فارغاً)
            </label>
            <input
              value={bootstrapSlug}
              onChange={(e) => setBootstrapSlug(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm"
              placeholder="مثال: al-nakheel"
            />
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={bootstrapSubmitting || bootstrapAgencyName.trim().length < 2}
                onClick={() => void submitBootstrapAgencyModal()}
                className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                {bootstrapSubmitting ? <Loader2 className="mx-auto size-5 animate-spin" /> : "إنشاء الوكالة"}
              </button>
              <button
                type="button"
                disabled={bootstrapSubmitting}
                onClick={() => setBootstrapModalUserId(null)}
                className="flex-1 rounded-xl border border-slate-600 py-2 text-sm font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {platformAgencyModalOpen ? (
        <div
          className="fixed inset-0 z-[213] flex items-center justify-center bg-black/60 p-4"
          onClick={() => !platformAgencyBusy && setPlatformAgencyModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black text-white">وكالة المنصة الرسمية</h3>
            <p className="mt-1 text-xs text-slate-500">
              تُنشأ وكالة مملوكة لحسابك (الإدارة) لتنشر إعلانات باسم المنصة. يُسمح بوكالة واحدة لكل مالك.
            </p>
            <label className="mt-4 block text-xs font-bold text-slate-400">اسم الوكالة</label>
            <input
              value={platformAgencyName}
              onChange={(e) => setPlatformAgencyName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <label className="mt-3 block text-xs font-bold text-slate-400">slug (اختياري)</label>
            <input
              value={platformAgencySlug}
              onChange={(e) => setPlatformAgencySlug(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm"
            />
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={platformAgencyBusy || platformAgencyName.trim().length < 2}
                onClick={() => void submitPlatformAgency()}
                className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                {platformAgencyBusy ? <Loader2 className="mx-auto size-5 animate-spin" /> : "إنشاء"}
              </button>
              <button
                type="button"
                disabled={platformAgencyBusy}
                onClick={() => setPlatformAgencyModalOpen(false)}
                className="flex-1 rounded-xl border border-slate-600 py-2 text-sm font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Admin → user system notification */}
      {notifyUserId ? (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-4"
          onClick={() => !notifySending && setNotifyUserId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black text-white">إشعار للمستخدم</h3>
            <p className="mt-1 text-xs text-slate-500">سيظهر في لوحة تحكم الوسيط كتنبيه.</p>
            <label className="mt-3 block text-xs font-bold text-slate-400">العنوان</label>
            <input
              value={notifyTitle}
              onChange={(e) => setNotifyTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <label className="mt-3 block text-xs font-bold text-slate-400">النص</label>
            <textarea
              value={notifyBody}
              onChange={(e) => setNotifyBody(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm"
              placeholder="اكتب رسالة واضحة…"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={notifySending || !notifyBody.trim()}
                onClick={() => void sendUserNotification()}
                className="flex-1 rounded-xl bg-sky-600 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                {notifySending ? <Loader2 className="mx-auto size-5 animate-spin" /> : "إرسال"}
              </button>
              <button
                type="button"
                disabled={notifySending}
                onClick={() => setNotifyUserId(null)}
                className="flex-1 rounded-xl border border-slate-600 py-2 text-sm font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Reject modal */}
      {rejectId !== null ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            if (!rejectSubmitting) {
              setRejectId(null);
              setRejectReason("");
              setRejectAdminNotes("");
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black text-white">
              {rejectType === "transaction" ? "رفض المعاملة" : "رفض الإعلان"}
            </h3>
            {rejectType === "property" ? (
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                اختر سبباً جاهزاً (صور غير مناسبة، رقم هاتف على الصورة، سعر غير صحيح) أو اكتب سبباً مخصصاً. سيتم
                تحديث حالة الإعلان إلى «مرفوض» وإرسال إشعار نظام إلى لوحة تحكم المالك.
              </p>
            ) : null}
            {rejectType === "property" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {PROPERTY_REJECT_PRESETS.map((pr) => (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => setRejectReason(pr.text)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                      rejectReason === pr.text
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                        : "border-slate-600 bg-slate-800 text-slate-200 hover:border-slate-500"
                    }`}
                  >
                    {pr.label}
                  </button>
                ))}
              </div>
            ) : null}
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm"
              placeholder="سبب الرفض * (أو اختر سبباً جاهزاً أعلاه)"
            />
            {rejectType === "transaction" ? (
              <textarea
                value={rejectAdminNotes}
                onChange={(e) => setRejectAdminNotes(e.target.value)}
                rows={2}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm"
                placeholder="ملاحظات داخلية (اختياري)"
              />
            ) : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={!rejectReason.trim() || rejectSubmitting}
                onClick={() => void (rejectType === "property" ? rejectProperty() : rejectTransaction())}
                className="flex-1 rounded-xl bg-rose-600 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                تأكيد
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejectId(null);
                  setRejectReason("");
                  setRejectAdminNotes("");
                }}
                className="flex-1 rounded-xl border border-slate-600 py-2 text-sm font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Admin preview (by id — any status; video embedded when supported) */}
      {previewLoading || previewProperty !== null || previewError !== null ? (
        <div
          className="fixed inset-0 z-[205] flex items-center justify-center overflow-y-auto bg-black/70 p-4"
          onClick={() => !previewLoading && closeAdminPreview()}
        >
          <div
            className="my-4 w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-white">معاينة إدارية</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  بيانات مباشرة من Supabase حسب المعرف — دون الاعتماد على الرابط العام.
                </p>
              </div>
              <button
                type="button"
                disabled={previewLoading}
                onClick={closeAdminPreview}
                className="rounded-lg border border-slate-600 p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                aria-label="إغلاق"
              >
                <X className="size-5" />
              </button>
            </div>
            {previewLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
                <Loader2 className="size-8 animate-spin" aria-hidden />
                <span className="text-sm font-bold">جاري التحميل…</span>
              </div>
            ) : previewError && !previewProperty ? (
              <p className="py-10 text-center text-sm font-bold text-rose-300">{previewError}</p>
            ) : previewProperty ? (
              <div className="max-h-[calc(92vh-8rem)] space-y-4 overflow-y-auto pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-black text-slate-200">
                    #{previewProperty.id}
                  </span>
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-black text-amber-200">
                    {previewProperty.status}
                  </span>
                  {previewProperty.status === "active" ? (
                    <a
                      href={propertyPathFromRecord(previewProperty)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-sky-400 underline"
                    >
                      فتح الصفحة العامة (نشط)
                    </a>
                  ) : null}
                </div>
                <h4 className="text-xl font-black text-white">{previewProperty.title}</h4>
                {previewProperty.video_url?.trim() ? (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400">الفيديو</p>
                    {getEmbedUrl(previewProperty.video_url) ? (
                      <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-700">
                        <iframe
                          src={getEmbedUrl(previewProperty.video_url) as string}
                          className="absolute inset-0 size-full border-0"
                          title="معاينة الفيديو"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-800/50 bg-amber-950/30 p-3 text-sm text-amber-100">
                        <p className="mb-2 font-bold">لا تتوفر معاينة مدمجة لهذا الرابط.</p>
                        <a
                          href={previewProperty.video_url.trim()}
                          target="_blank"
                          rel="noreferrer"
                          className="font-black text-sky-300 underline"
                        >
                          فتح الرابط في تبويب جديد
                        </a>
                      </div>
                    )}
                  </div>
                ) : null}
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-950/80 p-2">
                    <dt className="text-[10px] font-black text-slate-500">السعر</dt>
                    <dd className="font-bold text-white">{previewProperty.price?.toLocaleString("ar-EG")} ج.م</dd>
                  </div>
                  <div className="rounded-lg bg-slate-950/80 p-2">
                    <dt className="text-[10px] font-black text-slate-500">الغرض / النوع</dt>
                    <dd className="font-bold text-slate-200">
                      {listingPurposeFromProperty(previewProperty) === "sale" ? "بيع" : "إيجار"}
                      {previewProperty.unit_type ? ` · ${previewProperty.unit_type}` : ""}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-950/80 p-2 sm:col-span-2">
                    <dt className="text-[10px] font-black text-slate-500">المحافظة · الحي · المنطقة</dt>
                    <dd className="text-slate-200">
                      {[previewProperty.governorate, previewProperty.district, previewProperty.area]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-950/80 p-2 sm:col-span-2">
                    <dt className="text-[10px] font-black text-slate-500">معلم / عنوان</dt>
                    <dd className="text-slate-200">
                      {(previewProperty.landmark ?? "").trim() || (previewProperty.address ?? "").trim() || "—"}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-950/80 p-2 sm:col-span-2">
                    <dt className="text-[10px] font-black text-slate-500">العنوان التفصيلي</dt>
                    <dd className="whitespace-pre-wrap text-slate-200">{previewProperty.address?.trim() || "—"}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-950/80 p-2 sm:col-span-2">
                    <dt className="text-[10px] font-black text-slate-500">المالك (جهة الاتصال)</dt>
                    <dd className="space-y-1 text-slate-200">
                      <div className="font-bold text-white">{previewProperty.profiles?.name || "—"}</div>
                      <div>هاتف: {previewProperty.profiles?.phone || "—"}</div>
                      {previewProperty.profiles?.email ? (
                        <div>بريد: {previewProperty.profiles.email}</div>
                      ) : null}
                      {previewProperty.profiles?.id ? (
                        <div className="font-mono text-[11px] text-slate-500">معرف: {previewProperty.profiles.id}</div>
                      ) : null}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-950/80 p-2 sm:col-span-2">
                    <dt className="text-[10px] font-black text-slate-500">التفعيل</dt>
                    <dd className="text-slate-200">{listingCostLabel(previewProperty)}</dd>
                  </div>
                  {previewProperty.rejection_reason ? (
                    <div className="rounded-lg border border-rose-900/40 bg-rose-950/30 p-2 sm:col-span-2">
                      <dt className="text-[10px] font-black text-rose-300">سبب الرفض (المسجل)</dt>
                      <dd className="whitespace-pre-wrap text-sm text-rose-100">{previewProperty.rejection_reason}</dd>
                    </div>
                  ) : null}
                </dl>
                <div>
                  <p className="mb-1 text-xs font-black text-slate-400">الوصف الكامل</p>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
                    {previewProperty.description?.trim() || "—"}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-black text-slate-400">الصور</p>
                  <PropertyImagesAdmin
                    propertyId={previewProperty.id}
                    images={previewProperty.images ?? []}
                    editable={false}
                  />
                </div>
                <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      closeAdminPreview();
                      const row = properties.find((x) => x.id === previewProperty.id);
                      openEditProperty(row ?? previewProperty);
                    }}
                    className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                  >
                    تعديل إداري
                  </button>
                  <button
                    type="button"
                    onClick={closeAdminPreview}
                    className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-bold text-white"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Property edit modal */}
      {selectedProperty ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/60 p-4"
          onClick={() => !savingPropertyEdit && setSelectedProperty(null)}
        >
          <div
            className="my-8 w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black text-white">تعديل إداري · {selectedProperty.title}</h3>
            <label className="mt-4 block text-xs font-bold text-slate-400">العنوان</label>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <label className="mt-3 block text-xs font-bold text-slate-400">السعر (ج.م)</label>
            <input
              type="number"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <label className="mt-3 block text-xs font-bold text-slate-400">الوكالة (ربط الإعلان)</label>
            <select
              value={editAgencyId}
              onChange={(e) => setEditAgencyId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="">— بدون وكالة (مالك مباشر) —</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.slug}
                </option>
              ))}
            </select>
            <label className="mt-3 block text-xs font-bold text-slate-400">الصور (الأولى = الغلاف)</label>
            <div className="mt-2">
              <PropertyImagesAdmin
                propertyId={selectedProperty.id}
                images={selectedProperty.images ?? []}
                editable
                onUpdated={(next) => patchPropertyImages(selectedProperty.id, next)}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="url"
                value={editNewImageUrl}
                onChange={(e) => setEditNewImageUrl(e.target.value)}
                placeholder="https://… رابط صورة جديدة"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={() => void appendEditImage()}
                className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white"
              >
                إضافة رابط
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              الغرض: {listingPurposeFromProperty(selectedProperty) === "sale" ? "بيع" : "إيجار"} ·{" "}
              {listingCostLabel(selectedProperty)}
            </p>
            {selectedProperty.video_url && getEmbedUrl(selectedProperty.video_url) ? (
              <div className="relative mt-4 aspect-video overflow-hidden rounded-xl border border-slate-700">
                <iframe
                  src={getEmbedUrl(selectedProperty.video_url) as string}
                  className="absolute inset-0 size-full border-0"
                  title="فيديو"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingPropertyEdit}
                onClick={() => void savePropertyEdit()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white"
              >
                {savingPropertyEdit ? <Loader2 className="size-4 animate-spin" /> : "حفظ التعديلات"}
              </button>
              {isAwaitingPropertyApproval(selectedProperty.status) ? (
                <>
                  <button
                    type="button"
                    onClick={() => void approveProperty(selectedProperty)}
                    className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-black text-white"
                  >
                    موافقة
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectId(selectedProperty.id);
                      setRejectType("property");
                      setSelectedProperty(null);
                    }}
                    className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-black text-white"
                  >
                    رفض
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => setSelectedProperty(null)}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Hard delete */}
      {deletePropertyId !== null ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setDeletePropertyId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-rose-900/50 bg-slate-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black text-rose-200">حذف نهائي من قاعدة البيانات</h3>
            <p className="mt-2 text-sm text-slate-400">لا يمكن التراجع. يجب تسجيل سبب الحذف للتوثيق الداخلي.</p>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              rows={3}
              className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm"
              placeholder="سبب الحذف *"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={deletingProperty || !deleteReason.trim()}
                onClick={() => void deletePropertyHard()}
                className="flex-1 rounded-xl bg-rose-600 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                {deletingProperty ? "جاري الحذف…" : "حذف نهائي"}
              </button>
              <button
                type="button"
                onClick={() => setDeletePropertyId(null)}
                className="flex-1 rounded-xl border border-slate-600 py-2 text-sm font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="alert"
          className={`fixed bottom-6 left-1/2 z-[400] w-[min(100vw-2rem,24rem)] -translate-x-1/2 rounded-2xl border px-4 py-3 text-center text-sm font-black ${
            toast.type === "success"
              ? "border-emerald-500/60 bg-emerald-950/90 text-emerald-100"
              : "border-rose-500/60 bg-rose-950/90 text-rose-100"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
