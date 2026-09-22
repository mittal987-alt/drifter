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
} from "lucide-react";
import { getPlatformCorrelation, type CorrelationData } from "@/services/analytics";

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

  // Filter pairings by search query
  const filteredCorrelations = data?.correlations?.filter((pair) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (pair.video_topic || "").toLowerCase().includes(q) ||
      (pair.audio_tag || "").toLowerCase().includes(q) ||
      (pair.synergy_type || "").toLowerCase().includes(q)
    );
  }) || [];

  // Find max hourly activity for chart scaling
  const maxHourlyCount = data?.hourly_distribution
    ? Math.max(...data.hourly_distribution.map((d) => Math.max(d.youtube, d.spotify, 1)))
    : 10;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* INTRO HEADER */}
      <header className="workspace-intro">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
            <p className="workspace-eyebrow">Multimodal Signal / Cross-Platform</p>
          </div>
          <h1>YouTube ✖️ Spotify Correlation</h1>
          <p>
            Mapping how your visual video inquiries align, co-occur, and synchronize with your audio listening habits.
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
            Correlating multimodal temporal activity...
          </p>
        </div>
      ) : data ? (
        <>
          {/* TOP METRICS & SYNERGY GAUGE */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* PLATFORM SPLIT */}
            <div className="p-5 rounded-2xl bg-[#0e0e12] border border-white/[0.08] space-y-3 relative overflow-hidden group hover:border-white/20 transition">
              <div className="flex items-center justify-between text-white/40 text-xs">
                <span className="uppercase tracking-wider text-[10px] font-mono">Volume Distribution</span>
                <Layers size={16} className="text-amber-400" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/15 border border-red-500/30 text-red-400">
                    <Video size={16} />
                  </div>
                  <div>
                    <p className="text-xs text-white/50">YouTube</p>
                    <p className="text-lg font-bold text-white font-mono">
                      {data.platform_split.youtube_pct}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    <Music size={16} />
                  </div>
                  <div>
                    <p className="text-xs text-white/50">Spotify</p>
                    <p className="text-lg font-bold text-white font-mono">
                      {data.platform_split.spotify_pct}%
                    </p>
                  </div>
                </div>
              </div>
              {/* Ratio visual bar */}
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden flex">
                <div
                  className="bg-red-500 transition-all duration-700"
                  style={{ width: `${data.platform_split.youtube_pct}%` }}
                />
                <div
                  className="bg-emerald-500 transition-all duration-700"
                  style={{ width: `${data.platform_split.spotify_pct}%` }}
                />
              </div>
              <p className="text-[10px] text-white/40 font-mono">
                {data.platform_split.youtube} YouTube videos · {data.platform_split.spotify} Spotify tracks
              </p>
            </div>

            {/* SYNERGY SCORE & RESONANCE TIER */}
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
                Degree of concurrent topic & genre alignment between services within 90-minute time windows.
              </p>
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

          {/* 24-HOUR CIRCADIAN DIURNAL OVERLAP CHART */}
          {data.hourly_distribution && data.hourly_distribution.length === 24 && (
            <div className="p-5 rounded-2xl bg-[#0c0c10] border border-white/[0.09] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-2 text-white font-semibold text-sm">
                  <Activity size={16} className="text-amber-400" />
                  <span>24-Hour Circadian Diurnal Overlap</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-white/60">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span>YouTube</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/60">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Spotify</span>
                  </div>
                </div>
              </div>

              {/* Hourly Chart Bars */}
              <div className="pt-2">
                <div className="flex items-end gap-1.5 h-36 w-full pt-4">
                  {data.hourly_distribution.map((d) => {
                    const ytHeight = Math.max(6, Math.round((d.youtube / maxHourlyCount) * 110));
                    const spHeight = Math.max(6, Math.round((d.spotify / maxHourlyCount) * 110));
                    const isHovered = hoveredHour === d.hour;

                    return (
                      <div
                        key={d.hour}
                        onMouseEnter={() => setHoveredHour(d.hour)}
                        onMouseLeave={() => setHoveredHour(null)}
                        className={`flex-1 flex flex-col items-center justify-end h-full group cursor-pointer transition-all ${
                          isHovered ? "opacity-100" : "opacity-80 hover:opacity-100"
                        }`}
                      >
                        {/* Bars Side by Side */}
                        <div className="flex items-end gap-0.5 w-full justify-center">
                          <div
                            className="w-1.5 sm:w-2 bg-red-500 rounded-t-sm transition-all duration-300 group-hover:bg-red-400"
                            style={{ height: `${ytHeight}px` }}
                          />
                          <div
                            className="w-1.5 sm:w-2 bg-emerald-500 rounded-t-sm transition-all duration-300 group-hover:bg-emerald-400"
                            style={{ height: `${spHeight}px` }}
                          />
                        </div>

                        {/* Hour Label */}
                        <span className="text-[9px] font-mono text-white/40 mt-2 block">
                          {d.hour % 3 === 0 ? `${d.hour}h` : "·"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Hover Detail Strip */}
                <div className="mt-3 p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.06] flex items-center justify-between text-xs text-white/60 font-mono">
                  {hoveredHour !== null ? (
                    <>
                      <span className="text-white font-semibold">
                        Hour {hoveredHour.toString().padStart(2, "0")}:00 – {(hoveredHour + 1).toString().padStart(2, "0")}:00
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-red-400 font-bold">
                          {data.hourly_distribution[hoveredHour].youtube} YouTube plays
                        </span>
                        <span className="text-emerald-400 font-bold">
                          {data.hourly_distribution[hoveredHour].spotify} Spotify streams
                        </span>
                      </div>
                    </>
                  ) : (
                    <span>Hover over any hour column to inspect temporal platform balance</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BEHAVIORAL MODES */}
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
                    <div className="pt-1 text-[10px] font-mono text-white/40">
                      {mode.primary}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SYNCHRONOUS CROSS-DOMAIN PAIRINGS */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                <Shuffle size={15} className="text-purple-400" />
                Synchronous Video ✖️ Audio Pairings
              </h2>
              {/* Search input */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Filter topic or audio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-xl bg-white/[0.04] border border-white/10 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400 w-48"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredCorrelations.map((pair, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-[#0c0c10] border border-white/[0.08] hover:border-purple-500/30 transition flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-white font-medium truncate">
                        <Video size={13} className="text-red-400 shrink-0" />
                        <span className="truncate">{pair.video_topic}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium truncate">
                        <Music size={13} className="text-emerald-400 shrink-0" />
                        <span className="truncate">{pair.audio_tag}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="rounded-full bg-white/[0.05] border border-white/10 px-2.5 py-1 text-[10px] font-mono text-white/80 font-bold">
                      {pair.co_occurrence_count} events
                    </span>
                    <p className="text-[9px] text-white/40 mt-1 font-mono">{pair.synergy_type}</p>
                  </div>
                </div>
              ))}
            </div>

            {!filteredCorrelations.length && (
              <div className="p-8 text-center text-white/40 text-xs rounded-2xl border border-white/[0.08]">
                {searchQuery
                  ? "No pairings match your search filter."
                  : "Connect both YouTube and Spotify to detect synchronous listening & watching patterns."}
              </div>
            )}
          </div>

          {/* DAYPART DOMINANCE TABLE */}
          {Object.keys(data.daypart_dominance).length > 0 && (
            <div className="p-5 rounded-2xl bg-[#0c0c10] border border-white/[0.08] space-y-4">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Clock size={16} className="text-amber-400" />
                <span>Daypart Platform Dominance</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Object.entries(data.daypart_dominance).map(([period, counts]) => (
                  <div
                    key={period}
                    className="p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.05] space-y-2 hover:border-white/10 transition"
                  >
                    <p className="text-[11px] font-medium text-white/80">{period}</p>
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-red-400 flex items-center gap-1">
                        <Video size={11} /> {counts.youtube}
                      </span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Music size={11} /> {counts.spotify}
                      </span>
                    </div>
                    {/* Tiny visual proportion bar */}
                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden flex">
                      <div
                        className="bg-red-500"
                        style={{
                          width: `${(counts.youtube / Math.max(counts.youtube + counts.spotify, 1)) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-emerald-500"
                        style={{
                          width: `${(counts.spotify / Math.max(counts.youtube + counts.spotify, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
