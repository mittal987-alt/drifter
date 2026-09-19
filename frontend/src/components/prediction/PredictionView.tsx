import { useState, useEffect } from "react";
import {
  Compass,
  TrendingUp,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Search,
  Check,
  GitBranch,
  Zap,
} from "lucide-react";
import { getInterestPredictions, type PredictionData } from "@/services/analytics";

interface PredictionViewProps {
  source?: string;
}

export default function PredictionView({ source }: PredictionViewProps) {
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedHorizon, setSelectedHorizon] = useState<string>("all");
  const [simulatedTopic, setSimulatedTopic] = useState<string>("");
  const [copiedSeed, setCopiedSeed] = useState<string | null>(null);

  useEffect(() => {
    loadPredictions();
  }, [source]);

  async function loadPredictions() {
    setLoading(true);
    try {
      const res = await getInterestPredictions(source);
      setData(res);
      if (res.current_focus) {
        setSimulatedTopic(res.current_focus);
      }
    } catch (err) {
      console.error("Failed to load predictions", err);
    } finally {
      setLoading(false);
    }
  }

  function handleCopySeed(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedSeed(text);
    setTimeout(() => setCopiedSeed(null), 2000);
  }

  // Filter predictions by selected horizon
  const filteredPredictions = data?.predictions.filter((pred) => {
    if (selectedHorizon === "all") return true;
    if (selectedHorizon === "short") return pred.horizon.includes("7-14");
    if (selectedHorizon === "mid") return pred.horizon.includes("2-4") || pred.horizon.includes("weeks");
    if (selectedHorizon === "long") return pred.horizon.includes("month") || pred.horizon.includes("Emerging");
    return true;
  }) || [];

  // Available topics for Markov simulation
  const simulationSources = data?.transition_matrix ? Object.keys(data.transition_matrix) : [];
  const activeSimTargets = (data?.transition_matrix && simulatedTopic && data.transition_matrix[simulatedTopic])
    ? Object.entries(data.transition_matrix[simulatedTopic])
    : [];
  const simTotal = activeSimTargets.reduce((acc, [, val]) => acc + val, 0) || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* INTRO HEADER */}
      <header className="workspace-intro">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="workspace-eyebrow">Predictive Signal / Future Horizon</p>
          </div>
          <h1>Next Interest Predictor</h1>
          <p>
            Markov forward transitions and semantic velocity models projecting your next curiosity vectors and rabbit holes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadPredictions}
            disabled={loading}
            className="workspace-action"
            title="Recalculate predictions"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Forecast
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 rounded-2xl border border-white/10 bg-[#0b0b0e] space-y-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
            <Compass size={20} className="text-amber-400 absolute inset-0 m-auto" />
          </div>
          <p className="text-xs text-white/50 font-mono uppercase tracking-wider">
            Calculating forward Markov state probabilities...
          </p>
        </div>
      ) : data ? (
        <>
          {/* CURRENT ANCHOR & TOP STAT CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-[#0e0e12] border border-white/[0.08] relative overflow-hidden group hover:border-amber-500/30 transition">
              <div className="absolute top-0 right-0 h-28 w-28 bg-amber-500/5 blur-2xl rounded-full pointer-events-none" />
              <div className="flex items-center justify-between text-white/40 text-xs mb-2">
                <span className="uppercase tracking-wider text-[10px] font-mono">Current Focal Point</span>
                <Compass size={16} className="text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight">{data.current_focus}</p>
              <p className="text-[11px] text-white/50 mt-1">
                Highest frequency attention cluster in your recent timeline.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0e0e12] border border-white/[0.08] relative overflow-hidden group hover:border-cyan-500/30 transition">
              <div className="absolute top-0 right-0 h-28 w-28 bg-cyan-500/5 blur-2xl rounded-full pointer-events-none" />
              <div className="flex items-center justify-between text-white/40 text-xs mb-2">
                <span className="uppercase tracking-wider text-[10px] font-mono">Forecast Horizon</span>
                <Sparkles size={16} className="text-cyan-400" />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight">{data.projection_horizon}</p>
              <p className="text-[11px] text-white/50 mt-1">
                Projection window calibrated to your historical drift velocity.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0e0e12] border border-white/[0.08] relative overflow-hidden group hover:border-emerald-500/30 transition">
              <div className="absolute top-0 right-0 h-28 w-28 bg-emerald-500/5 blur-2xl rounded-full pointer-events-none" />
              <div className="flex items-center justify-between text-white/40 text-xs mb-2">
                <span className="uppercase tracking-wider text-[10px] font-mono">Detected Pathways</span>
                <TrendingUp size={16} className="text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight font-mono">
                {data.predictions.length} High-Probability Vectors
              </p>
              <p className="text-[11px] text-white/50 mt-1">
                Forward candidate topics with elevated transition likelihood.
              </p>
            </div>
          </div>

          {/* SIMULATION SANDBOX: MARKOV STATE TRANSITION EXPLORER */}
          {simulationSources.length > 0 && (
            <div className="p-5 rounded-2xl bg-[#0b0b0f] border border-white/[0.09] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <GitBranch size={16} className="text-amber-400" />
                  <h2 className="text-sm font-semibold text-white tracking-tight">
                    Markov Transition Pathway Explorer
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/40 font-mono">Simulate Drift From:</span>
                  <select
                    value={simulatedTopic}
                    onChange={(e) => setSimulatedTopic(e.target.value)}
                    className="rounded-lg bg-white/[0.06] border border-white/10 px-3 py-1 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {simulationSources.map((t) => (
                      <option key={t} value={t} className="bg-[#121216] text-white">
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {activeSimTargets.length > 0 ? (
                <div className="space-y-2.5">
                  <p className="text-xs text-white/60">
                    When your attention anchors on <strong className="text-amber-300">{simulatedTopic}</strong>, your attention historically branches into:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                    {activeSimTargets.map(([target, count]) => {
                      const pct = Math.round((count / simTotal) * 100);
                      return (
                        <div
                          key={target}
                          className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between space-y-2 hover:bg-white/[0.05] transition"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-white truncate">{target}</span>
                            <span className="text-xs font-mono font-bold text-amber-400 shrink-0">{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-white/40 font-mono">
                            <span>{count} observed shifts</span>
                            <span className="flex items-center gap-1 text-white/60">
                              Branch <ArrowRight size={10} />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-white/40 italic">
                  Select a topic above to inspect forward Markov transition branches.
                </p>
              )}
            </div>
          )}

          {/* PREDICTIONS SECTION WITH HORIZON FILTERS */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                <Zap size={15} className="text-amber-400" />
                Forecasted Vectors & Gateway Seeds
              </h2>

              {/* HORIZON FILTER TABS */}
              <div className="flex items-center gap-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] p-1">
                {[
                  { id: "all", label: "All Horizons" },
                  { id: "short", label: "Next 7-14 Days" },
                  { id: "mid", label: "Next 2-4 Weeks" },
                  { id: "long", label: "1-2 Months" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedHorizon(tab.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                      selectedHorizon === tab.id
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPredictions.map((pred, idx) => {
                // Determine confidence color
                const confColor =
                  pred.confidence >= 80
                    ? "emerald"
                    : pred.confidence >= 65
                    ? "amber"
                    : "cyan";

                return (
                  <div
                    key={pred.topic}
                    className="p-5 rounded-2xl bg-[#0c0c10] border border-white/[0.09] hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-500/5 transition-all space-y-4 group relative overflow-hidden"
                  >
                    {/* Top ambient highlight */}
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

                    {/* CARD HEADER */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/90 font-semibold">
                            Vector #{idx + 1}
                          </span>
                          <span className="text-[10px] rounded-full bg-white/[0.05] border border-white/10 px-2 py-0.5 text-white/50">
                            {pred.horizon}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-white tracking-tight mt-1 group-hover:text-amber-200 transition">
                          {pred.topic}
                        </h3>
                      </div>

                      {/* CONFIDENCE PILL */}
                      <div className="flex flex-col items-end shrink-0">
                        <div
                          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono font-bold ${
                            confColor === "emerald"
                              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                              : confColor === "amber"
                              ? "bg-amber-500/15 border border-amber-500/30 text-amber-300"
                              : "bg-cyan-500/15 border border-cyan-500/30 text-cyan-300"
                          }`}
                        >
                          <Sparkles size={11} />
                          {pred.confidence}%
                        </div>
                        <span className="text-[9px] text-white/30 mt-0.5 font-mono">Transition Likelihood</span>
                      </div>
                    </div>

                    {/* TRANSITION PATHWAY */}
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.025] border border-white/[0.06] text-xs">
                      <span className="text-white/50 truncate max-w-[45%] font-medium">{pred.transition_from}</span>
                      <ArrowRight size={13} className="text-amber-400 shrink-0 animate-pulse" />
                      <span className="text-amber-200 font-semibold truncate max-w-[45%]">{pred.topic}</span>
                    </div>

                    {/* RATIONALE */}
                    <p className="text-xs text-white/70 leading-relaxed font-normal">{pred.rationale}</p>

                    {/* SEED EXPLORATION PROMPTS */}
                    <div className="pt-3 border-t border-white/[0.06] space-y-2">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/40 font-mono">
                        <span className="flex items-center gap-1">
                          <Search size={11} className="text-amber-400" /> Gateway Seeds (Click to Copy)
                        </span>
                        {copiedSeed && (
                          <span className="text-emerald-400 flex items-center gap-1 lowercase">
                            <Check size={11} /> copied!
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {pred.seed_keywords.map((kw) => (
                          <button
                            key={kw}
                            onClick={() => handleCopySeed(kw)}
                            title="Click to copy exploration query"
                            className="flex items-center gap-1 rounded-lg bg-white/[0.04] hover:bg-amber-500/15 hover:border-amber-500/30 border border-white/[0.08] px-2.5 py-1 text-[11px] text-white/80 hover:text-amber-200 font-mono transition text-left"
                          >
                            <span>{kw}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!filteredPredictions.length && (
              <div className="p-12 text-center text-white/40 text-xs rounded-2xl border border-white/[0.08] bg-white/[0.01]">
                No predictions matching this timeframe horizon. Try selecting "All Horizons".
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
