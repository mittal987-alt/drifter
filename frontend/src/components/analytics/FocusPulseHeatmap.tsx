import { useState, useEffect, useMemo } from "react";
import {
  Flame,
  Calendar,
  Clock,
  Sparkles,
  Zap,
  TrendingUp,
  Moon,
  Coffee,
  CheckCircle2,
  ExternalLink,
  Layers,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  getFocusPulse,
  type FocusPulseData,
  type HeatmapCell,
} from "@/services/analytics";
import NumberTicker from "@/components/ui/NumberTicker";

interface FocusPulseHeatmapProps {
  source?: string;
  onSelectDate?: (date: string) => void;
}

function topicColor(topic?: string | null): string {
  if (!topic) return "#34d399";
  const palette = [
    "#f2b56b",
    "#75d6c2",
    "#a7b8ff",
    "#f28f9b",
    "#d4a7f5",
    "#c8d46b",
    "#78b9e8",
    "#f3d27a",
  ];
  let hash = 0;
  for (const char of topic) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

export default function FocusPulseHeatmap({ source, onSelectDate }: FocusPulseHeatmapProps) {
  const [data, setData] = useState<FocusPulseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [colorMode, setColorMode] = useState<"intensity" | "topic">("intensity");
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);

  useEffect(() => {
    loadPulse();
  }, [source]);

  async function loadPulse() {
    setLoading(true);
    try {
      const res = await getFocusPulse(112, source);
      setData(res);
    } catch (err) {
      console.error("Failed to load Focus Pulse heatmap", err);
    } finally {
      setLoading(false);
    }
  }

  // Organize cells into 7 rows (Mon-Sun) across N weeks
  const { weekColumns, monthLabels } = useMemo(() => {
    if (!data?.heatmap || data.heatmap.length === 0) {
      return { weekColumns: [], monthLabels: [] };
    }

    const cols: HeatmapCell[][] = [];
    let currentWeek: HeatmapCell[] = [];

    data.heatmap.forEach((cell, idx) => {
      currentWeek.push(cell);
      if (currentWeek.length === 7 || idx === data.heatmap.length - 1) {
        cols.push(currentWeek);
        currentWeek = [];
      }
    });

    // Compute month label offsets
    const months: { label: string; colIndex: number }[] = [];
    let lastMonth = "";
    cols.forEach((col, cIdx) => {
      const firstDay = col[0];
      if (firstDay) {
        const m = new Date(firstDay.date).toLocaleDateString(undefined, { month: "short" });
        if (m !== lastMonth) {
          months.push({ label: m, colIndex: cIdx });
          lastMonth = m;
        }
      }
    });

    return { weekColumns: cols, monthLabels: months };
  }, [data]);

  // Color mapping based on mode
  function getCellBg(cell: HeatmapCell): string {
    if (cell.count === 0) return "rgba(255, 255, 255, 0.03)";

    if (colorMode === "topic" && cell.dominant_topic) {
      const base = topicColor(cell.dominant_topic);
      const opacities = ["0.2", "0.45", "0.75", "1.0"];
      const op = opacities[Math.min(cell.level - 1, 3)];
      return `${base}${Math.round(parseFloat(op) * 255).toString(16).padStart(2, "0")}`;
    }

    // Default Emerald Intensity mode
    switch (cell.level) {
      case 1:
        return "rgba(52, 211, 153, 0.25)";
      case 2:
        return "rgba(52, 211, 153, 0.5)";
      case 3:
        return "rgba(52, 211, 153, 0.75)";
      case 4:
        return "#10b981";
      default:
        return "rgba(255, 255, 255, 0.03)";
    }
  }

  const dayLabels = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

  return (
    <div className="space-y-6">
      {/* SECTION HEADER & TELEMETRY */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="workspace-eyebrow">Curiosity Rhythm & Consistency</span>
            <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-400/20">
              FOCUS PULSE
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mt-1">
            Weekly Activity & Curiosity Heatmap
          </h2>
          <p className="text-xs text-white/50 mt-1">
            Visualizing daily inquiry density, active streaks, and diurnal learning patterns across your connected streams.
          </p>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-1 text-xs">
            <button
              onClick={() => setColorMode("intensity")}
              className={`rounded-lg px-2.5 py-1 font-medium transition ${
                colorMode === "intensity"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Density
            </button>
            <button
              onClick={() => setColorMode("topic")}
              className={`rounded-lg px-2.5 py-1 font-medium transition ${
                colorMode === "topic"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Topic Palette
            </button>
          </div>
        </div>
      </div>

      {/* METRICS HUD TILES */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* CURRENT STREAK */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-400 text-xs font-semibold mb-1">
            <span>Streak</span>
            <Flame size={14} className="fill-amber-400 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-1 text-2xl font-extrabold text-white">
            <NumberTicker value={data?.current_streak || 0} />
            <span className="text-xs font-medium text-white/50">days</span>
          </div>
          <span className="text-[10px] text-white/40 block mt-0.5">Consecutive active days</span>
        </div>

        {/* LONGEST STREAK */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
          <div className="flex items-center justify-between text-white/40 text-xs font-semibold mb-1">
            <span>Best Streak</span>
            <Sparkles size={14} className="text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-1 text-2xl font-extrabold text-white">
            <NumberTicker value={data?.longest_streak || 0} />
            <span className="text-xs font-medium text-white/50">days</span>
          </div>
          <span className="text-[10px] text-white/40 block mt-0.5">All-time record</span>
        </div>

        {/* ACTIVE DAYS DENSITY */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
          <div className="flex items-center justify-between text-white/40 text-xs font-semibold mb-1">
            <span>Active Days</span>
            <Calendar size={14} className="text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1 text-2xl font-extrabold text-white">
            <NumberTicker value={data?.active_days_count || 0} />
            <span className="text-xs font-medium text-white/50">/ 112d</span>
          </div>
          <span className="text-[10px] text-white/40 block mt-0.5">
            {data ? `${Math.round((data.active_days_count / 112) * 100)}% consistency` : "Past 16 weeks"}
          </span>
        </div>

        {/* PEAK FOCUS DAY */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
          <div className="flex items-center justify-between text-white/40 text-xs font-semibold mb-1">
            <span>Peak Day</span>
            <TrendingUp size={14} className="text-purple-400" />
          </div>
          <div className="text-lg font-bold text-white truncate mt-1">
            {data?.peak_focus_day || "Midweek"}
          </div>
          <span className="text-[10px] text-white/40 block mt-0.5">Highest event volume</span>
        </div>

        {/* PEAK TIME BLOCK */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
          <div className="flex items-center justify-between text-white/40 text-xs font-semibold mb-1">
            <span>Peak Window</span>
            <Clock size={14} className="text-amber-300" />
          </div>
          <div className="text-xs font-bold text-white truncate mt-1">
            {data?.peak_focus_block?.split("(")[0]?.trim() || "Evening"}
          </div>
          <span className="text-[10px] text-white/40 block mt-0.5">
            {data?.peak_focus_block?.split("(")[1]?.replace(")", "") || "5 PM - 9 PM"}
          </span>
        </div>

        {/* NOCTURNAL QUOTIENT */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
          <div className="flex items-center justify-between text-white/40 text-xs font-semibold mb-1">
            <span>Nocturnal</span>
            <Moon size={14} className="text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-1 text-2xl font-extrabold text-white">
            <NumberTicker value={data?.nocturnal_percentage || 0} />
            <span className="text-xs font-medium text-white/50">%</span>
          </div>
          <span className="text-[10px] text-white/40 block mt-0.5">11 PM – 5 AM exploration</span>
        </div>
      </div>

      {/* HEATMAP CALENDAR MATRIX */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-white/70">
            {data?.total_events || 0} total events logged across past 16 weeks
          </span>
          {/* LEGEND */}
          <div className="flex items-center gap-1.5 text-[11px] text-white/40">
            <span>Less</span>
            <span className="h-2.5 w-2.5 rounded-sm bg-white/[0.03] border border-white/10" />
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/25" />
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/50" />
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/75" />
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400 shadow-sm shadow-emerald-400/50" />
            <span>More</span>
          </div>
        </div>

        {/* MATRIX SCROLL CONTAINER */}
        <div className="overflow-x-auto pb-2">
          <div className="inline-block min-w-full">
            {/* MONTH LABELS */}
            <div className="flex text-[10px] font-semibold text-white/40 mb-1 pl-7">
              {weekColumns.map((_, colIdx) => {
                const month = monthLabels.find((m) => m.colIndex === colIdx);
                return (
                  <div key={colIdx} className="w-3.5 mr-1 text-left shrink-0">
                    {month ? month.label : ""}
                  </div>
                );
              })}
            </div>

            {/* GRID BODY: 7 ROWS */}
            <div className="flex items-start">
              {/* Day Labels Column */}
              <div className="flex flex-col gap-1 pr-2 select-none shrink-0">
                {dayLabels.map((lbl, rIdx) => (
                  <div key={rIdx} className="h-3.5 text-[9px] font-medium text-white/35 flex items-center">
                    {lbl}
                  </div>
                ))}
              </div>

              {/* Weeks Columns */}
              <div className="flex items-center gap-1">
                {weekColumns.map((col, colIdx) => (
                  <div key={colIdx} className="flex flex-col gap-1">
                    {col.map((cell) => {
                      const isHovered = hoveredCell?.date === cell.date;
                      const isSelected = selectedCell?.date === cell.date;
                      const bg = getCellBg(cell);

                      return (
                        <button
                          key={cell.date}
                          type="button"
                          onMouseEnter={() => setHoveredCell(cell)}
                          onMouseLeave={() => setHoveredCell(null)}
                          onClick={() => {
                            setSelectedCell(cell);
                            onSelectDate?.(cell.date);
                          }}
                          className={`h-3.5 w-3.5 rounded-[3px] transition-all cursor-pointer relative ${
                            isSelected
                              ? "ring-2 ring-white scale-125 z-20"
                              : isHovered
                              ? "scale-125 z-10 brightness-125 ring-1 ring-white/50"
                              : ""
                          }`}
                          style={{
                            background: bg,
                            boxShadow:
                              cell.level === 4
                                ? "0 0 8px rgba(52, 211, 153, 0.4)"
                                : "none",
                          }}
                          aria-label={`${cell.count} events on ${cell.date}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ACTIVE INSPECTOR CALLOUT ON HOVER/CLICK */}
        {(hoveredCell || selectedCell) && (
          <div className="mt-4 pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-3">
              <div
                className="h-3.5 w-3.5 rounded-[3px] shrink-0"
                style={{ background: getCellBg(hoveredCell || selectedCell!) }}
              />
              <div>
                <strong className="text-white font-semibold">
                  {new Date((hoveredCell || selectedCell)!.date).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </strong>
                <span className="text-white/40 ml-2">
                  · {(hoveredCell || selectedCell)!.count} traces recorded
                </span>
                {(hoveredCell || selectedCell)!.dominant_topic && (
                  <span
                    className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold border"
                    style={{
                      borderColor: `${topicColor((hoveredCell || selectedCell)!.dominant_topic)}40`,
                      background: `${topicColor((hoveredCell || selectedCell)!.dominant_topic)}15`,
                      color: topicColor((hoveredCell || selectedCell)!.dominant_topic),
                    }}
                  >
                    {(hoveredCell || selectedCell)!.dominant_topic}
                  </span>
                )}
              </div>
            </div>

            {/* Platform Badges */}
            <div className="flex items-center gap-1.5">
              {Object.entries((hoveredCell || selectedCell)!.sources || {}).map(([src, count]) => (
                <span
                  key={src}
                  className="rounded-md bg-white/[0.04] border border-white/10 px-2 py-0.5 text-[10px] text-white/60 capitalize"
                >
                  {src}: {count}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* DIURNAL FOCUS MATRIX (7 DAYS x 4 TIME BLOCKS) */}
      {data?.matrix && data.matrix.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock size={16} className="text-amber-400" />
                Diurnal Focus Matrix
              </h3>
              <p className="text-xs text-white/45 mt-0.5">
                Activity distribution mapping hour-blocks against each day of the week.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/[0.06] text-white/40 uppercase text-[10px] tracking-wider">
                  <th className="py-2 pr-4 font-semibold">Day</th>
                  <th className="py-2 px-3 font-semibold text-center">Morning (5-12)</th>
                  <th className="py-2 px-3 font-semibold text-center">Afternoon (12-17)</th>
                  <th className="py-2 px-3 font-semibold text-center">Evening (17-21)</th>
                  <th className="py-2 px-3 font-semibold text-center">Night (21-5)</th>
                  <th className="py-2 pl-4 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.matrix.map((row) => {
                  const maxVal = Math.max(
                    ...data.matrix.map((r) => Math.max(r.morning, r.afternoon, r.evening, r.night)),
                    1
                  );
                  return (
                    <tr key={row.day} className="hover:bg-white/[0.02] transition">
                      <td className="py-2.5 pr-4 font-bold text-white/80">{row.day}</td>
                      {(["morning", "afternoon", "evening", "night"] as const).map((block) => {
                        const val = row[block];
                        const intensity = val / maxVal;
                        return (
                          <td key={block} className="py-2 px-3 text-center">
                            <div
                              className="rounded-lg py-1 px-2 text-[11px] font-mono font-medium transition"
                              style={{
                                background:
                                  val > 0
                                    ? `rgba(52, 211, 153, ${Math.max(0.12, intensity * 0.7)})`
                                    : "transparent",
                                color: val > 0 ? "#ffffff" : "rgba(255, 255, 255, 0.2)",
                              }}
                            >
                              {val}
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-2.5 pl-4 font-mono font-semibold text-right text-white/60">
                        {row.total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
