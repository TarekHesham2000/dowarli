import type { AgencyLeadRow } from "./AgencyCRMTable";

function propertyTitle(p: AgencyLeadRow["properties"]): string {
  if (!p) return "";
  if (Array.isArray(p)) return p[0]?.title ?? "";
  return p.title ?? "";
}

function statusAr(s: string | null | undefined): string {
  if (s === "contacted") return "تم التواصل";
  if (s === "closed") return "مغلق";
  return "جديد";
}

function sourceAr(s: string | null | undefined): string {
  const m: Record<string, string> = {
    whatsapp: "واتساب",
    call: "مكالمة",
    message: "رسالة",
    website: "الموقع",
    other: "أخرى",
  };
  if (!s) return "";
  return m[s] ?? s;
}

function priorityAr(s: string | null | undefined): string {
  if (s === "high") return "عالية";
  if (s === "low") return "منخفضة";
  return "متوسطة";
}

function csvEscape(s: string): string {
  const t = s.replace(/"/g, '""');
  if (/[",\n\r]/.test(t)) return `"${t}"`;
  return t;
}

/** UTF-8 BOM + CSV for Excel (Arabic) */
export function buildLeadsCsv(leads: AgencyLeadRow[]): string {
  const headers = [
    "الاسم",
    "الهاتف",
    "العقار",
    "الحالة",
    "الملاحظات",
    "التاريخ",
    "المصدر",
    "المسؤول",
    "الأولوية",
  ];
  const lines = [headers.join(",")];
  for (const row of leads) {
    const d = new Date(row.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
    lines.push(
      [
        csvEscape(row.client_name ?? ""),
        csvEscape(row.client_phone ?? ""),
        csvEscape(propertyTitle(row.properties)),
        csvEscape(statusAr(row.crm_status)),
        csvEscape((row.agency_notes ?? "").replace(/\r\n/g, "\n")),
        csvEscape(d),
        csvEscape(sourceAr(row.lead_source)),
        csvEscape(row.assignee_display ?? ""),
        csvEscape(priorityAr(row.crm_priority)),
      ].join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

export function downloadLeadsCsv(leads: AgencyLeadRow[], filenameBase: string): void {
  const csv = buildLeadsCsv(leads);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameBase}-leads.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
