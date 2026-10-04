import { useState, useEffect } from "react";
import {
  Shuffle,
  RefreshCw,
  Video,
  Music,
  Clock,
  Layers,
  Sparkles,
  Zap,
  Activity,
  Search,
  Globe,
  GitBranch,
  Monitor,
  Joystick,
  AtSign,
  Hash,
} from "lucide-react";
import { getPlatformCorrelation, type CorrelationData } from "@/services/analytics";

// ─── Source colour + icon registry ─────────────────────────────────────────
const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  youtube:  { label: "YouTube",  color: "#ef4444", bg: "bg-red-500/15",     border: "border-red-500/30",     icon: <Video     size={14} /> },
  spotify:  { label: "Spotify",  color: "#22c55e", bg: "bg-emerald-500/15", border: "border-emerald-500/30", icon: <Music     size={14} /> },
  browser:  { label: "Browser",  color: "#60a5fa", bg: "bg-blue-500/15",    border: "border-blue-500/30",    icon: <Globe     size={14} /> },
  github:   { label: "GitHub",   color: "#a78bfa", bg: "bg-violet-500/15",  border: "border-violet-500/30",  icon: <GitBranch size={14} /> },
  steam:    { label: "Steam",    color: "#38bdf8", bg: "bg-sky-500/15",     border: "border-sky-500/30",     icon: <Joystick  size={14} /> },
  twitter:  { label: "Twitter",  color: "#93c5fd", bg: "bg-blue-400/15",    border: "border-blue-400/30",    icon: <AtSign    size={14} /> },
};

function srcCfg(src: string) {
  return SOURCE_CONFIG[src?.toLowerCase()] ?? {
    label: src ?? "Other",
    color: "#94a3b8",
    bg: "bg-slate-500/15",
    border: "border-slate-500/30",
    icon: <Globe size={14} />,
  };
}

export default function CorrelationView() {
  const [data, setData] = useState<CorrelationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadCorrelation();
  }, []);

  async function loadCorrelation() {
    setLoading(true);
    try {
      const res = await getPlatformCorrelation();
      setData(res);
    } catch (err) {
      console.error("Failed to load platform correlation", err);
    } finally {
      setLoading(false);
    }
  }

  // Active sources from backend, falling back to platform_split keys
  const activeSources: string[] = data?.active_sources?.length
    ? data.active_sources
    : Object.keys(data?.platform_split ?? {}).filter(
        (k) => !k.endsWith("_pct") && (data?.platform_split[k] ?? 0) > 0,
      );

  // Filtered pairings
  const filteredCorrelations = data?.correlations?.filter((pair) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (pair.topic_a || pair.video_topic || "").toLowerCase().includes(q) ||
      (pair.topic_b || pair.audio_tag || "").toLowerCase().includes(q) ||
      (pair.source_a || "").toLowerCase().includes(q) ||
      (pair.source_b || "").toLowerCase().includes(q) ||
      (pair.synergy_type || "").toLowerCase().includes(q)
    );
  }) || [];

  // Max hourly value across all active sources for bar scaling
  const maxHourlyCount = data?.hourly_distribution
    ? Math.max(
        ...data.hourly_distribution.map((d) =>
          Math.max(1, ...activeSources.map((s) => d[s] ?? 0)),
        ),
      )
    : 10;

  const totalEvents = activeSources.reduce(
    (acc, s) => acc + (data?.platform_split[s] ?? 0),
    0,
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* INTRO HEADER */}
      <header className="workspace-intro">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
            <p className="workspace-eyebrow">Multimodal Signal / Cross-Platform</p>
          </div>
          <h1>
            {activeSources.length > 0
              ? activeSources.map((s) => srcCfg(s).label).join(" ✖️ ") + " Correlation"
              : "Cross-Platform Correlation"}
          </h1>
          <p>
            Mapping how your activity across{" "}
            <strong className="text-white/80">
              {activeSources.length > 0
                ? activeSources.map((s) => srcCfg(s).label).join(", ")
                : "all platforms"}
            </strong>{" "}
            co-occurs and synchronises within 90-minute session windows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadCorrelation}
            disabled={loading}
            className="workspace-action"
            title="Recalculate cross-platform correlation"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Correlation
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 rounded-2xl border border-white/10 bg-[#0b0b0e] space-y-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-purple-500/20 border-t-purple-400 animate-spin" />
            <Shuffle size={20} className="text-purple-400 absolute inset-0 m-auto" />
          </div>
          <p className="text-xs text-white/50 font-mono uppercase tracking-wider">
            Correlating multimodal temporal activity…
          </p>
        </div>
      ) : data ? (
        <>
          {/* ── TOP METRICS ROW ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* PLATFORM VOLUME DISTRIBUTION */}
            <div className="p-5 rounded-2xl bg-[#0e0e12] border border-white/[0.08] space-y-3 relative overflow-hidden group hover:border-white/20 transition">
              <div className="flex items-center justify-between text-white/40 text-xs">
                <span className="uppercase tracking-wider text-[10px] font-mono">Volume Distribution</span>
                <Layers size={16} className="text-amber-400" />
              </div>

              {/* Per-source rows */}
              <div className="space-y-2">
                {activeSources.map((src) => {
                  const cfg = srcCfg(src);
                  const count = data.platform_split[src] ?? 0;
                  const pct = totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0;
                  return (
                    <div key={src} className="flex items-center gap-2">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-lg ${cfg.bg} border ${cfg.border} shrink-0`}
                        style={{ color: cfg.color }}
                      >
                        {cfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="text-white/70">{cfg.label}</span>
                          <span className="font-mono text-white font-bold">{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, backgroundColor: cfg.color }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-white/30 font-mono">{totalEvents} total events · {activeSources.length} platforms</p>
            </div>

            {/* SYNERGY SCORE */}
            <div className="p-5 rounded-2xl bg-[#0e0e12] border border-white/[0.08] space-y-2 relative overflow-hidden group hover:border-purple-500/30 transition">
              <div className="absolute top-0 right-0 h-28 w-28 bg-purple-500/10 blur-2xl rounded-full pointer-events-none" />
              <div className="flex items-center justify-between text-white/40 text-xs">
                <span className="uppercase tracking-wider text-[10px] font-mono">Cross-Platform Synergy</span>
                <Shuffle size={16} className="text-purple-400" />
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold font-mono text-purple-300 tracking-tight">
                  {data.synergy_score}%
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {data.resonance_tier || "Harmonic Alignment"}
                </span>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed">
                Degree of concurrent topic alignment across all your platforms within 90-minute time windows.
              </p>
              {/* Active source pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {activeSources.map((src) => {
                  const cfg = srcCfg(src);
                  return (
                    <span
                      key={src}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${cfg.bg} border ${cfg.border}`}
                      style={{ color: cfg.color }}
                    >
                      {cfg.icon} {cfg.label}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* SYNTHESIS INSIGHT */}
            <div className="p-5 rounded-2xl bg-[#0e0e12] border border-white/[0.08] space-y-2 relative overflow-hidden group hover:border-cyan-500/30 transition">
              <div className="absolute top-0 right-0 h-28 w-28 bg-cyan-500/5 blur-2xl rounded-full pointer-events-none" />
              <div className="flex items-center justify-between text-white/40 text-xs">
                <span className="uppercase tracking-wider text-[10px] font-mono">Synthesis Insight</span>
                <Sparkles size={16} className="text-cyan-400" />
              </div>
              <p className="text-xs font-normal text-white/85 leading-relaxed pt-1">
                "{data.insight}"
              </p>
            </div>
          </div>

          {/* ── 24-HOUR CIRCADIAN CHART ───────────────────────────────── */}
          {data.hourly_distribution && data.hourly_distribution.length === 24 && (
            <div className="p-5 rounded-2xl bg-[#0c0c10] border border-white/[0.09] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-2 text-white font-semibold text-sm">
                  <Activity size={16} className="text-amber-400" />
                  <span>24-Hour Circadian Diurnal Overlap</span>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {activeSources.map((src) => {
                    const cfg = srcCfg(src);
                    return (
                      <div key={src} className="flex items-center gap-1.5 text-white/60">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                        <span>{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bars */}
              <div className="pt-2">
                <div className="flex items-end gap-0.5 h-36 w-full pt-4">
                  {data.hourly_distribution.map((d) => {
                    const isHovered = hoveredHour === d.hour;
                    return (
                      <div
                        key={d.hour}
                        onMouseEnter={() => setHoveredHour(d.hour)}
                        onMouseLeave={() => setHoveredHour(null)}
                        className={`flex-1 flex flex-col items-center justify-end h-full group cursor-pointer transition-all ${
                          isHovered ? "opacity-100" : "opacity-75 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-end gap-px w-full justify-center">
                          {activeSources.map((src) => {
                            const cfg = srcCfg(src);
                            const h = Math.max(3, Math.round(((d[src] ?? 0) / maxHourlyCount) * 110));
                            return (
                              <div
                                key={src}
                                className="rounded-t-sm transition-all duration-300"
                                style={{
                                  height: `${h}px`,
                                  width: `${Math.max(3, Math.floor(14 / activeSources.length))}px`,
                                  backgroundColor: cfg.color,
                                  opacity: isHovered ? 1 : 0.8,
                                }}
                              />
                            );
                          })}
                        </div>
                        <span className="text-[9px] font-mono text-white/40 mt-2 block">
                          {d.hour % 3 === 0 ? `${d.hour}h` : "·"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Hover strip */}
                <div className="mt-3 p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs text-white/60 font-mono">
                  {hoveredHour !== null ? (
                    <>
                      <span className="text-white font-semibold">
                        Hour {hoveredHour.toString().padStart(2, "0")}:00 – {(hoveredHour + 1).toString().padStart(2, "0")}:00
                      </span>
                      <div className="flex flex-wrap gap-3">
                        {activeSources.map((src) => {
                          const cfg = srcCfg(src);
                          const val = data.hourly_distribution![hoveredHour][src] ?? 0;
                          return val > 0 ? (
                            <span key={src} className="font-bold flex items-center gap-1" style={{ color: cfg.color }}>
                              {cfg.icon} {val} {cfg.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </>
                  ) : (
                    <span>Hover over any hour column to inspect temporal platform balance</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── BEHAVIORAL MODES ─────────────────────────────────────── */}
          {data.modes && data.modes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Zap size={16} className="text-amber-400" />
                <span>Detected Cross-Platform Modes</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {data.modes.map((mode, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-[#0c0c10] border border-white/[0.08] hover:border-white/15 transition space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-white tracking-tight">{mode.title}</h3>
                      <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[10px] font-mono text-amber-300">
                        {mode.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/60 leading-relaxed">{mode.description}</p>
                    <div className="pt-1 text-[10px] font-mono text-white/40">{mode.primary}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CROSS-PLATFORM PAIRINGS ───────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                <Shuffle size={15} className="text-purple-400" />
                Synchronous Cross-Platform Pairings
              </h2>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Filter topic, platform…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-xl bg-white/[0.04] border border-white/10 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400 w-52"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredCorrelations.map((pair, idx) => {
                const srcA = pair.source_a ?? "youtube";
                const srcB = pair.source_b ?? "spotify";
                const cfgA = srcCfg(srcA);
                const cfgB = srcCfg(srcB);
                const topicA = pair.topic_a || pair.video_topic;
                const topicB = pair.topic_b || pair.audio_tag;
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#0c0c10] border border-white/[0.08] hover:border-purple-500/30 transition flex items-center justify-between gap-3 group"
                  >
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-white font-medium truncate">
                        <span style={{ color: cfgA.color }} className="shrink-0">{cfgA.icon}</span>
                        <span className="truncate">{topicA}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium truncate" style={{ color: cfgB.color }}>
                        <span className="shrink-0">{cfgB.icon}</span>
                        <span className="truncate">{topicB}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="rounded-full bg-white/[0.05] border border-white/10 px-2.5 py-1 text-[10px] font-mono text-white/80 font-bold">
                        {pair.co_occurrence_count} events
                      </span>
                      <p className="text-[9px] text-white/40 mt-1 font-mono">{pair.synergy_type}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {!filteredCorrelations.length && (
              <div className="p-8 text-center text-white/40 text-xs rounded-2xl border border-white/[0.08]">
                {searchQuery
                  ? "No pairings match your search filter."
                  : "Use the extension on more platforms to detect synchronous cross-source patterns."}
              </div>
            )}
          </div>

          {/* ── DAYPART DOMINANCE TABLE ───────────────────────────────── */}
          {Object.keys(data.daypart_dominance).length > 0 && (
            <div className="p-5 rounded-2xl bg-[#0c0c10] border border-white/[0.08] space-y-4">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Clock size={16} className="text-amber-400" />
                <span>Daypart Platform Dominance</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Object.entries(data.daypart_dominance).map(([period, counts]) => {
                  const periodTotal = Object.values(counts).reduce((a, b) => a + b, 0);
                  const topSources = Object.entries(counts)
                    .filter(([s]) => activeSources.includes(s))
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3);
                  return (
                    <div
                      key={period}
                      className="p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.05] space-y-2 hover:border-white/10 transition"
                    >
                      <p className="text-[11px] font-medium text-white/80">{period}</p>
                      <div className="space-y-1.5">
                        {topSources.map(([src, count]) => {
                          const cfg = srcCfg(src);
                          const pct = periodTotal > 0 ? Math.round((count / periodTotal) * 100) : 0;
                          return (
                            <div key={src} className="flex items-center gap-1.5">
                              <span className="shrink-0" style={{ color: cfg.color }}>{cfg.icon}</span>
                              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${pct}%`, backgroundColor: cfg.color }}
                                />
                              </div>
                              <span className="text-[9px] font-mono text-white/40 shrink-0 w-6 text-right">{count}</span>
                            </div>
                          );
                        })}
                        {topSources.length === 0 && (
                          <p className="text-[10px] text-white/30 font-mono">No activity</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
