import { useState, useEffect } from "react";
import {
  Sparkles,
  Shuffle,
  Compass,
  ArrowRight,
  ExternalLink,
  BookOpen,
  Tv,
  Wrench,
  Headphones,
  Flame,
  Check,
  Copy,
  Layers,
  RefreshCw,
  Orbit,
  Zap,
} from "lucide-react";
import {
  getCuriosityNexus,
  type NexusData,
  type NexusPreset,
} from "@/services/analytics";
import NumberTicker from "@/components/ui/NumberTicker";

interface CuriosityNexusViewProps {
  source?: string;
  onExploreTopic?: (topic: string) => void;
}

function topicColor(topic: string, offset = 0): string {
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
  return palette[Math.abs(hash + offset) % palette.length];
}

export default function CuriosityNexusView({ source }: CuriosityNexusViewProps) {
  const [data, setData] = useState<NexusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedA, setSelectedA] = useState<string>("");
  const [selectedB, setSelectedB] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"all" | "watch" | "read" | "build">("all");
  const [copied, setCopied] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);

  useEffect(() => {
    fetchNexus();
  }, [source]);

  async function fetchNexus(topicA?: string, topicB?: string) {
    setLoading(true);
    try {
      const res = await getCuriosityNexus(topicA, topicB, source);
      setData(res);
      setSelectedA(res.topic_a);
      setSelectedB(res.topic_b);
    } catch (err) {
      console.error("Failed to load Curiosity Nexus", err);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectA(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setSelectedA(val);
    if (val && selectedB && val !== selectedB) {
      fetchNexus(val, selectedB);
    }
  }

  function handleSelectB(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setSelectedB(val);
    if (val && selectedA && val !== selectedA) {
      fetchNexus(selectedA, val);
    }
  }

  function handleSurpriseMe() {
    if (!data?.available_topics || data.available_topics.length < 2) return;
    setDiceRolling(true);
    setTimeout(() => setDiceRolling(false), 600);

    const topics = data.available_topics.map((t) => t.topic);
    const idx1 = Math.floor(Math.random() * topics.length);
    let idx2 = Math.floor(Math.random() * topics.length);
    while (idx2 === idx1) {
      idx2 = Math.floor(Math.random() * topics.length);
    }
    const tA = topics[idx1];
    const tB = topics[idx2];
    setSelectedA(tA);
    setSelectedB(tB);
    fetchNexus(tA, tB);
  }

  function handlePresetClick(preset: NexusPreset) {
    setSelectedA(preset.topic_a);
    setSelectedB(preset.topic_b);
    fetchNexus(preset.topic_a, preset.topic_b);
  }

  function handleCopyShare() {
    if (!data) return;
    const shareText = `🌀 Drifter Curiosity Nexus: "${data.bridge_title}" (${data.topic_a} × ${data.topic_b}) — Serendipity Score: ${data.serendipity_score}%. Exploring uncharted crossover horizons!`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleToggleBookmark() {
    setBookmarked(!bookmarked);
  }

  const colorA = selectedA ? topicColor(selectedA) : "#f2b56b";
  const colorB = selectedB ? topicColor(selectedB, 3) : "#75d6c2";

  return (
    <div className="space-y-6">
      {/* HEADER INTRO */}
      <header className="workspace-intro">
        <div>
          <div className="flex items-center gap-2">
            <span className="workspace-eyebrow">Novelty Synthesis Engine</span>
            <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-400/20">
              NEW FEATURE
            </span>
          </div>
          <h1>Curiosity Nexus</h1>
          <p>
            Uncover the hidden bridges connecting your most divergent interests. Discover cross-disciplinary books, projects, and documentaries waiting at the intersection.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSurpriseMe}
            disabled={loading}
            className="workspace-action bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 transition flex items-center gap-1.5"
            title="Randomly pair two distant interest clusters"
          >
            <Shuffle size={14} className={diceRolling ? "animate-spin" : ""} />
            Surprise Me
          </button>
          <button
            onClick={handleCopyShare}
            className="workspace-action hover:border-white/20 transition flex items-center gap-1.5"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copied ? "Copied Link" : "Share Bridge"}
          </button>
        </div>
      </header>

      {/* QUICK PRESETS CHIPS */}
      {data?.suggested_presets && data.suggested_presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40 flex items-center gap-1">
            <Sparkles size={12} className="text-amber-400" /> Auto-Detected Nexuses:
          </span>
          {data.suggested_presets.map((p, idx) => {
            const isCurrent =
              (p.topic_a === selectedA && p.topic_b === selectedB) ||
              (p.topic_a === selectedB && p.topic_b === selectedA);
            return (
              <button
                key={idx}
                onClick={() => handlePresetClick(p)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5 border ${
                  isCurrent
                    ? "bg-amber-400/15 border-amber-400/40 text-amber-300 shadow-md shadow-amber-500/10"
                    : "bg-white/[0.03] border-white/10 text-white/70 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                <span>{p.topic_a}</span>
                <span className="text-white/30">×</span>
                <span>{p.topic_b}</span>
                <span className="text-[10px] font-mono opacity-60">({p.serendipity_score}%)</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ORBITAL NEXUS CONSTELLATION HERO CARD */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6 sm:p-8 backdrop-blur-xl">
        {/* Ambient atmospheric glows */}
        <div
          className="pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full blur-3xl opacity-20 transition-all duration-700"
          style={{ background: colorA }}
        />
        <div
          className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full blur-3xl opacity-20 transition-all duration-700"
          style={{ background: colorB }}
        />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/[0.08] pb-8">
          {/* Dual Cluster Selector & Orbital Visualizer */}
          <div className="flex flex-1 flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 w-full">
            {/* NODE A */}
            <div className="relative flex flex-col items-center group">
              <div
                className="h-20 w-20 rounded-2xl flex items-center justify-center border shadow-2xl transition-all group-hover:scale-105"
                style={{
                  background: `${colorA}15`,
                  borderColor: `${colorA}40`,
                  boxShadow: `0 0 30px ${colorA}20`,
                }}
              >
                <Orbit size={32} style={{ color: colorA }} />
              </div>
              <div className="mt-3 text-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-white/40 block mb-1">
                  Origin Vector A
                </span>
                <select
                  value={selectedA}
                  onChange={handleSelectA}
                  className="rounded-xl border border-white/10 bg-[#121215] px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-amber-400"
                >
                  {data?.available_topics?.map((t) => (
                    <option key={t.topic} value={t.topic}>
                      {t.topic} ({t.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* CONNECTING BEAM & NEXUS CORE */}
            <div className="flex flex-col items-center justify-center shrink-0">
              <div className="relative flex items-center justify-center">
                {/* Pulsing Energy Rings */}
                <div className="absolute h-16 w-16 rounded-full border border-amber-400/30 animate-ping opacity-25" />
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-400/10 text-amber-400 shadow-xl shadow-amber-400/20 z-10">
                  <Zap size={20} />
                </div>
              </div>
              <span className="mt-2 text-[10px] uppercase tracking-widest font-extrabold text-amber-400/90">
                Nexus Gateway
              </span>
            </div>

            {/* NODE B */}
            <div className="relative flex flex-col items-center group">
              <div
                className="h-20 w-20 rounded-2xl flex items-center justify-center border shadow-2xl transition-all group-hover:scale-105"
                style={{
                  background: `${colorB}15`,
                  borderColor: `${colorB}40`,
                  boxShadow: `0 0 30px ${colorB}20`,
                }}
              >
                <Compass size={32} style={{ color: colorB }} />
              </div>
              <div className="mt-3 text-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-white/40 block mb-1">
                  Target Vector B
                </span>
                <select
                  value={selectedB}
                  onChange={handleSelectB}
                  className="rounded-xl border border-white/10 bg-[#121215] px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400"
                >
                  {data?.available_topics?.map((t) => (
                    <option key={t.topic} value={t.topic}>
                      {t.topic} ({t.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* TELEMETRY HUD GAUGE */}
          <div className="flex flex-col items-center sm:items-end justify-center rounded-2xl border border-white/10 bg-white/[0.02] p-5 shrink-0 min-w-[210px] text-center sm:text-right">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-white/40">
              Serendipity Index
            </span>
            <div className="mt-1 flex items-baseline gap-1 text-3xl font-extrabold text-white">
              <NumberTicker value={data?.serendipity_score || 85} />
              <span className="text-sm font-semibold text-amber-400">%</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {data?.friction || "Harmonic Synergy"}
            </div>
            <button
              onClick={handleToggleBookmark}
              className={`mt-3 w-full rounded-xl px-3 py-1.5 text-xs font-medium transition flex items-center justify-center gap-1.5 border ${
                bookmarked
                  ? "border-amber-400/40 bg-amber-400/15 text-amber-300"
                  : "border-white/10 bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08]"
              }`}
            >
              <Flame size={12} className={bookmarked ? "text-amber-400 fill-amber-400" : ""} />
              {bookmarked ? "Bookmarked to Horizon" : "Save to Exploration"}
            </button>
          </div>
        </div>

        {/* NARRATIVE THESIS */}
        <div className="pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Synthesized Hypothesis
            </span>
            <span className="text-white/20">·</span>
            <span className="text-xs text-white/40">{data?.tagline}</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {data?.bridge_title || `${selectedA} × ${selectedB} Nexus`}
          </h2>
          <p className="text-sm leading-relaxed text-white/70 max-w-4xl">
            {data?.narrative}
          </p>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
        <button
          onClick={() => setActiveTab("all")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === "all" ? "bg-white text-black" : "text-white/60 hover:text-white"
          }`}
        >
          All Recommendations
        </button>
        <button
          onClick={() => setActiveTab("watch")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
            activeTab === "watch" ? "bg-white text-black" : "text-white/60 hover:text-white"
          }`}
        >
          <Tv size={13} /> Screen & Watch
        </button>
        <button
          onClick={() => setActiveTab("read")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
            activeTab === "read" ? "bg-white text-black" : "text-white/60 hover:text-white"
          }`}
        >
          <BookOpen size={13} /> Foundational Texts
        </button>
        <button
          onClick={() => setActiveTab("build")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
            activeTab === "build" ? "bg-white text-black" : "text-white/60 hover:text-white"
          }`}
        >
          <Wrench size={13} /> Hands-on Project
        </button>
      </div>

      {/* RECOMMENDATION DECK GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. WATCH & SCREEN PROMPTS */}
        {(activeTab === "all" || activeTab === "watch") &&
          data?.recommendations?.watch?.map((w, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-col justify-between hover:border-amber-400/40 hover:bg-white/[0.04] transition group"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-white/40 mb-3">
                  <span className="flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider text-amber-400">
                    <Tv size={12} /> Deep Dive Video
                  </span>
                  <span className="font-mono text-[11px]">{w.duration}</span>
                </div>
                <h4 className="text-base font-semibold text-white group-hover:text-amber-300 transition">
                  {w.title}
                </h4>
                <p className="mt-2 text-xs text-white/50 leading-relaxed">
                  Explores the conceptual boundary where {selectedA} tools synthesize {selectedB} concepts.
                </p>
              </div>
              <a
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(w.query)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300"
              >
                Search on YouTube <ExternalLink size={12} />
              </a>
            </div>
          ))}

        {/* 2. READ & SYNTHESIZE */}
        {(activeTab === "all" || activeTab === "read") &&
          data?.recommendations?.read?.map((r, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-col justify-between hover:border-cyan-400/40 hover:bg-white/[0.04] transition group"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-white/40 mb-3">
                  <span className="flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider text-cyan-400">
                    <BookOpen size={12} /> {r.type}
                  </span>
                </div>
                <h4 className="text-base font-semibold text-white group-hover:text-cyan-300 transition">
                  {r.title}
                </h4>
                <p className="mt-2 text-xs text-white/50 leading-relaxed">By {r.author}</p>
              </div>
              <a
                href={`https://scholar.google.com/scholar?q=${encodeURIComponent(r.title)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
              >
                Find Paper / Book <ExternalLink size={12} />
              </a>
            </div>
          ))}

        {/* 3. EXPERIMENT & BUILD */}
        {(activeTab === "all" || activeTab === "build") && data?.recommendations?.build && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-col justify-between hover:border-emerald-400/40 hover:bg-white/[0.04] transition group">
            <div>
              <div className="flex items-center justify-between text-xs text-white/40 mb-3">
                <span className="flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider text-emerald-400">
                  <Wrench size={12} /> Weekend Micro-Project
                </span>
                <span className="rounded-md bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-400/20">
                  {data.recommendations.build.difficulty}
                </span>
              </div>
              <h4 className="text-base font-semibold text-white group-hover:text-emerald-300 transition">
                {data.recommendations.build.title}
              </h4>
              <p className="mt-2 text-xs text-white/50 leading-relaxed">
                {data.recommendations.build.description}
              </p>
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <Zap size={12} /> Cross-Domain Prototype
            </div>
          </div>
        )}

        {/* 4. SOUNDTRACK / SONIC AMBIENCE */}
        {data?.recommendations?.sonic_vibe && (
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/10 to-transparent p-5 flex flex-col justify-between hover:border-purple-400/40 transition">
            <div>
              <div className="flex items-center justify-between text-xs text-white/40 mb-3">
                <span className="flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider text-purple-400">
                  <Headphones size={12} /> Ideal Sonic Vibe
                </span>
              </div>
              <h4 className="text-base font-semibold text-white">
                {data.recommendations.sonic_vibe}
              </h4>
              <p className="mt-2 text-xs text-white/50 leading-relaxed">
                Atmospheric background frequency tuned to foster lateral thinking across {selectedA} and {selectedB}.
              </p>
            </div>
            <a
              href={`https://open.spotify.com/search/${encodeURIComponent(data.recommendations.sonic_vibe)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-purple-400 hover:text-purple-300"
            >
              Explore on Spotify <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
