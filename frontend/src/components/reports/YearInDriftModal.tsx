import { useState, useEffect, useRef } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Flame,
  Activity,
  Moon,
  ShieldCheck,
  RefreshCw,
  Play,
  Pause,
  Calendar,
  Layers,
  Zap,
  Clock,
} from "lucide-react";
import { getYearInDrift, type WrappedData } from "@/services/analytics";

interface YearInDriftModalProps {
  isOpen: boolean;
  onClose: () => void;
  source?: string;
}

const SLIDE_DURATION = 8000; // ms per slide

export default function YearInDriftModal({
  isOpen,
  onClose,
  source,
}: YearInDriftModalProps) {
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (isOpen) {
      loadWrapped();
      setCurrentSlide(0);
    }
  }, [isOpen, source]);

  // Animated progress bar ticker
  useEffect(() => {
    if (!isOpen || !data || paused || loading) return;
    setProgress(0);
    startTimeRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / SLIDE_DURATION) * 100, 100);
      setProgress(pct);
      if (pct < 100) {
        progressRef.current = setTimeout(tick, 30);
      } else {
        if (currentSlide < data.slides.length - 1) {
          setCurrentSlide((p) => p + 1);
        }
      }
    };
    progressRef.current = setTimeout(tick, 30);
    return () => { if (progressRef.current) clearTimeout(progressRef.current); };
  }, [isOpen, data, currentSlide, paused, loading]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || !data) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") nextSlide();
      else if (e.key === "ArrowLeft") prevSlide();
      else if (e.key === "Escape") onClose();
      else if (e.key === "p" || e.key === "P") setPaused((p) => !p);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, data, currentSlide]);

  async function loadWrapped() {
    setLoading(true);
    setProgress(0);
    try {
      const res = await getYearInDrift(source);
      setData(res);
    } catch (err) {
      console.error("Failed to load wrapped data", err);
    } finally {
      setLoading(false);
    }
  }

  function nextSlide() {
    if (!data || currentSlide >= data.slides.length - 1) return;
    setCurrentSlide((p) => p + 1);
    setProgress(0);
  }

  function prevSlide() {
    if (currentSlide <= 0) return;
    setCurrentSlide((p) => p - 1);
    setProgress(0);
  }

  if (!isOpen) return null;

  const slide = data?.slides[currentSlide];
  const accentColor = slide?.accent ?? "#f2b56b";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl p-0 sm:p-4 animate-in fade-in duration-300">
      <div
        className="relative w-full h-full sm:max-w-[420px] sm:h-[88vh] sm:max-h-[800px] bg-[#07070a] sm:rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col select-none"
        style={{ boxShadow: `0 0 80px ${accentColor}18, 0 0 0 1px rgba(255,255,255,0.07)` }}
      >
        {/* DYNAMIC BG GLOW */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none transition-all duration-1000"
          style={{
            background: `radial-gradient(ellipse at 80% 10%, ${accentColor}55 0%, transparent 60%), radial-gradient(ellipse at 20% 90%, ${accentColor}22 0%, transparent 50%)`,
          }}
        />

        {/* STORY PROGRESS BARS */}
        <div className="absolute top-3 inset-x-3 z-30 flex gap-1">
          {data?.slides.map((s, idx) => (
            <div
              key={s.id}
              className="h-[3px] flex-1 bg-white/15 rounded-full overflow-hidden cursor-pointer"
              onClick={() => { setCurrentSlide(idx); setProgress(0); }}
            >
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{
                  width:
                    idx < currentSlide
                      ? "100%"
                      : idx === currentSlide
                      ? `${progress}%`
                      : "0%",
                  opacity: idx < currentSlide ? 0.6 : 1,
                  transition: idx < currentSlide ? "none" : undefined,
                }}
              />
            </div>
          ))}
        </div>

        {/* HEADER */}
        <div className="relative z-30 flex items-center justify-between px-5 pt-8 pb-2">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.2em] uppercase text-white/50">
            <Sparkles size={11} className="text-amber-400" />
            Year in Drift
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaused((p) => !p)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition"
              title={paused ? "Resume" : "Pause"}
            >
              {paused ? <Play size={12} /> : <Pause size={12} />}
            </button>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-7 py-4 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
                <RefreshCw size={28} className="text-amber-400 animate-spin relative" />
              </div>
              <p className="text-xs text-white/50 tracking-wider uppercase font-mono">
                Synthesizing your attention trajectory...
              </p>
            </div>
          ) : data ? (
            <div
              key={`slide-${currentSlide}`}
              className="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              {renderSlideContent(data.slides[currentSlide], data)}
            </div>
          ) : (
            <div className="text-center space-y-3">
              <p className="text-white/40 text-xs">No activity logs found.</p>
              <button onClick={loadWrapped} className="text-amber-400 text-xs underline">
                Retry
              </button>
            </div>
          )}
        </div>

        {/* TAP ZONES */}
        <div className="absolute inset-y-16 left-0 w-1/3 z-20 cursor-w-resize" onClick={prevSlide} />
        <div className="absolute inset-y-16 right-0 w-1/3 z-20 cursor-e-resize" onClick={nextSlide} />

        {/* BOTTOM NAV */}
        <div className="relative z-30 flex items-center justify-between px-6 pb-6 pt-3">
          <button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="flex items-center gap-1 text-xs text-white/40 hover:text-white disabled:opacity-20 transition"
          >
            <ChevronLeft size={15} /> Back
          </button>

          {/* Slide dots */}
          <div className="flex items-center gap-1.5">
            {data?.slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => { setCurrentSlide(idx); setProgress(0); }}
                className="rounded-full transition-all duration-300"
                style={{
                  width: idx === currentSlide ? 20 : 5,
                  height: 5,
                  backgroundColor: idx === currentSlide ? accentColor : "rgba(255,255,255,0.2)",
                }}
              />
            ))}
          </div>

          <button
            onClick={nextSlide}
            disabled={!data || currentSlide === data.slides.length - 1}
            className="flex items-center gap-1 text-xs text-white/80 hover:text-white disabled:opacity-20 transition font-medium"
          >
            Next <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatPill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.07] text-center gap-1">
      <div style={{ color }} className="opacity-80">{icon}</div>
      <p className="text-base font-bold text-white font-mono leading-none">{value}</p>
      <p className="text-[10px] text-white/35 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function renderSlideContent(slide: WrappedData["slides"][0], data: WrappedData) {
  switch (slide.id) {
    case "volume":
      return (
        <div className="space-y-6">
          <div className="space-y-1">
            <p className="text-[10px] uppercase font-mono tracking-[0.25em] text-amber-400">
              {slide.eyebrow}
            </p>
            <h1 className="text-[26px] font-bold tracking-tight text-white leading-tight">
              {slide.title}
            </h1>
            <p className="text-xs leading-relaxed text-white/55">{slide.subtitle}</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {slide.metrics?.map((m) => {
              const iconMap: Record<string, React.ReactNode> = {
                "Total Traces": <Zap size={15} />,
                "Active Days": <Calendar size={15} />,
                "Interest Clusters": <Layers size={15} />,
                "Longest Streak": <Flame size={15} />,
              };
              const colorMap: Record<string, string> = {
                "Total Traces": "#f2b56b",
                "Active Days": "#75d6c2",
                "Interest Clusters": "#a7b8ff",
                "Longest Streak": "#f28f9b",
              };
              return (
                <StatPill
                  key={m.label}
                  icon={iconMap[m.label] ?? <Sparkles size={15} />}
                  label={m.label}
                  value={m.value}
                  color={colorMap[m.label] ?? "#ffffff"}
                />
              );
            })}
          </div>
        </div>
      );

    case "dominant":
      return (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-[10px] uppercase font-mono tracking-[0.25em] text-emerald-400">
              {slide.eyebrow}
            </p>
            <h1 className="text-[24px] font-bold tracking-tight text-white leading-tight">
              {slide.title}
            </h1>
            <p className="text-xs text-white/55">{slide.subtitle}</p>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-white/30 font-mono">Top Realms</p>
            {slide.top_topics?.map((top, idx) => (
              <div key={top.topic} className="flex items-center gap-2.5 group">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold"
                  style={{
                    backgroundColor: idx === 0 ? "rgba(118,214,194,0.2)" : "rgba(255,255,255,0.05)",
                    color: idx === 0 ? "#75d6c2" : "rgba(255,255,255,0.4)",
                  }}
                >
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-white/80 font-medium truncate pr-2">{top.topic}</span>
                    <span className="text-[10px] font-mono font-bold shrink-0" style={{ color: idx === 0 ? "#75d6c2" : "rgba(255,255,255,0.4)" }}>
                      {Math.round(top.share * 100)}%
                    </span>
                  </div>
                  <div className="h-1 w-full bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(top.share * 100)}%`,
                        backgroundColor: idx === 0 ? "#75d6c2" : "rgba(255,255,255,0.2)",
                        transition: "width 1s ease",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "drift":
      return (
        <div className="space-y-5">
          <div className="space-y-1">
            <p className="text-[10px] uppercase font-mono tracking-[0.25em] text-indigo-400">
              {slide.eyebrow}
            </p>
            <h1 className="text-[24px] font-bold tracking-tight text-white leading-tight">
              {slide.title}
            </h1>
            <p className="text-xs leading-relaxed text-white/55">{slide.subtitle}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {slide.metrics?.map((m) => (
              <div key={m.label} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.07] text-center">
                <p className="text-base font-bold text-white font-mono">{m.value}</p>
                <p className="text-[9px] text-white/35 uppercase tracking-wider mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-indigo-500/[0.08] border border-indigo-500/20 space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
              <Activity size={14} /> Horizon Breakthrough
            </div>
            <p className="text-[11px] text-white/65 leading-relaxed">
              During this phase, your viewing velocity surged into novel semantic clusters — creating the steepest interest divergence of the period.
            </p>
          </div>
        </div>
      );

    case "rabbit_hole": {
      const session = (slide as any).deepest_session;
      const durationMin = session?.duration_minutes ? Math.round(session.duration_minutes) : null;
      const sessionTopic = session?.dominant_topic ?? "Unknown";
      const eventCount = session?.event_count ?? "—";
      return (
        <div className="space-y-5">
          <div className="space-y-1">
            <p className="text-[10px] uppercase font-mono tracking-[0.25em] text-rose-400">
              {slide.eyebrow}
            </p>
            <h1 className="text-[24px] font-bold tracking-tight text-white leading-tight">
              {slide.title}
            </h1>
            <p className="text-xs leading-relaxed text-white/55">{slide.subtitle}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-1">
              <div className="flex items-center gap-1.5 text-purple-400 text-[10px] font-semibold uppercase tracking-wider mb-1">
                <Moon size={12} /> Night Activity
              </div>
              <p className="text-2xl font-bold font-mono text-white">{slide.nocturnal_share}</p>
              <p className="text-[10px] text-white/35">Between 11PM – 5AM</p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-semibold uppercase tracking-wider mb-1">
                <Clock size={12} /> Deepest Session
              </div>
              <p className="text-2xl font-bold font-mono text-white">{durationMin ?? "—"}<span className="text-sm text-white/40 font-normal ml-0.5">m</span></p>
              <p className="text-[10px] text-white/35">{eventCount} traces continuous</p>
            </div>
          </div>

          {session && (
            <div className="p-3.5 rounded-xl bg-rose-500/[0.07] border border-rose-500/20 text-[11px] text-white/65 leading-relaxed">
              <span className="text-rose-300 font-semibold">Topic locked:</span>{" "}
              <span className="text-white/80">{sessionTopic}</span>
            </div>
          )}
        </div>
      );
    }

    case "archetype": {
      const arch = data.archetype;
      return (
        <div className="space-y-5 text-center flex flex-col items-center">
          <p className="text-[10px] uppercase font-mono tracking-[0.25em] text-amber-400">
            {slide.eyebrow}
          </p>

          <div className="relative my-1">
            <div
              className="absolute -inset-6 rounded-full blur-2xl animate-pulse opacity-40"
              style={{ background: `radial-gradient(circle, ${arch.accent_color}88 0%, transparent 70%)` }}
            />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.05] shadow-2xl text-amber-300">
              <ShieldCheck size={36} />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">{arch.title}</h1>
            <p className="text-xs leading-relaxed text-white/60 max-w-[280px]">{arch.tagline}</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {arch.key_traits.map((trait, i) => (
              <span
                key={trait}
                className="rounded-full border px-3 py-1 text-[11px] font-medium"
                style={{
                  borderColor: `${arch.accent_color}40`,
                  backgroundColor: `${arch.accent_color}12`,
                  color: i === 0 ? arch.accent_color : "rgba(255,255,255,0.7)",
                  animationDelay: `${i * 120}ms`,
                }}
              >
                {trait}
              </span>
            ))}
          </div>

          <div className="w-full p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
            <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">
              {data.summary?.total_events?.toLocaleString()} traces · {data.summary?.active_days} active days · {data.summary?.longest_streak}d streak
            </p>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
