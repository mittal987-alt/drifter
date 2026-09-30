import type { DashboardData } from "./analytics";

/**
 * Trigger browser print dialog to save as PDF.
 * The page's print CSS should be minimal / white.
 */
export function exportAsPDF() {
  window.print();
}

/**
 * Download dashboard data as a JSON file.
 */
export function exportAsJSON(data: DashboardData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `drifter-export-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Trigger print dialog as capture fallback.
 */
export async function exportElementAsPNG(
  _selector?: string,
  _filename = "drifter-capture.png"
) {
  window.print();
}



/**
 * Export top topics as a simple CSV.
 */
export function exportTopicsCSV(
  topics: { topic: string; count: number; share?: number }[]
) {
  const header = "Topic,Count,Share %\n";
  const rows = topics
    .map(
      (t) =>
        `"${t.topic.replace(/"/g, '""')}",${t.count},${((t.share ?? 0) * 100).toFixed(1)}`
    )
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `drifter-topics-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
