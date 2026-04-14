function safeFilenameBase(s: string): string {
  const t = (s.trim() || "agency-report").replace(/[/\\?%*:|"<>]/g, "-");
  return t.slice(0, 100) || "agency-report";
}

const UNSAFE_COLOR_FN = /\b(lab|oklch|lch|color-mix)\s*\(/i;

/** Strip class names / unsafe inline color functions from the html2canvas clone (Tailwind v4 → lab/oklch). */
function sanitizeReportCloneForCanvas(_doc: Document, cloneRoot: HTMLElement): void {
  const nodes: HTMLElement[] = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll<HTMLElement>("*"))];
  for (const el of nodes) {
    el.removeAttribute("class");
    const st = el.getAttribute("style");
    if (st && UNSAFE_COLOR_FN.test(st)) {
      el.removeAttribute("style");
    }
  }
  cloneRoot.style.setProperty("background-color", "#f8fafc", "important");
  cloneRoot.style.setProperty("color", "#0f172a", "important");
}

function resolveReportCaptureRoot(host: HTMLElement): HTMLElement {
  if (host.id === "dashboard-report-content") return host;
  const inner = host.querySelector("#dashboard-report-content");
  if (inner instanceof HTMLElement) return inner;
  return host;
}

/**
 * Renders `#dashboard-report-content` to a single-page A4 PDF. Libraries load on demand (Turbopack-friendly).
 */
export async function downloadAgencyPerformancePdf(hostEl: HTMLElement, filenameBase: string): Promise<void> {
  const target = resolveReportCaptureRoot(hostEl);

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  const canvas = await html2canvas(target, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#f8fafc",
    scrollX: 0,
    scrollY: 0,
    windowWidth: target.scrollWidth,
    windowHeight: target.scrollHeight,
    onclone(doc, clonedElement) {
      if (clonedElement instanceof HTMLElement) {
        sanitizeReportCloneForCanvas(doc, clonedElement);
      }
    },
  });

  const imgData = canvas.toDataURL("image/png", 1.0);
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait", compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 32;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const scale = Math.min(maxW / canvas.width, maxH / canvas.height);
  const w = canvas.width * scale;
  const h = canvas.height * scale;
  const x = (pageW - w) / 2;
  const y = (pageH - h) / 2;
  pdf.addImage(imgData, "PNG", x, y, w, h);
  pdf.save(`${safeFilenameBase(filenameBase)}-performance.pdf`);
}
