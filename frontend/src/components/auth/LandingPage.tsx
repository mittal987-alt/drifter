import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Brain,
  Compass,
  Dna,
  Music,
  Play,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Spotlight } from "@/components/ui/spotlight";
import { BorderBeam } from "@/components/ui/border-beam";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Meteors } from "@/components/ui/meteors";
import { MagicCard } from "@/components/ui/magic-card";

function YouTubeIcon({ className = "h-5 w-5 fill-[#FF0000]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function SpotifyIcon({ className = "h-5 w-5 fill-[#1DB954]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.308a.747.747 0 0 1-1.028.248c-2.813-1.718-6.353-2.107-10.523-1.155a.75.75 0 0 1-.334-1.462c4.562-1.042 8.483-.598 11.637 1.341.36.22.47.69.248 1.028zm1.47-3.267a.936.936 0 0 1-1.287.308c-3.22-1.979-8.13-2.552-11.94-1.396a.937.937 0 0 1-.548-1.792c4.354-1.32 9.774-.683 13.467 1.593.424.26.56.818.308 1.287zm.126-3.41c-3.86-2.293-10.228-2.505-13.896-1.391a1.124 1.124 0 0 1-.652-2.152c4.223-1.282 11.25-1.037 15.698 1.6.49.29.65 1.022.25 1.691-.29.49-1.022.65-1.4.252z" />
    </svg>
  );
}

function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const duration = 2000;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target]);

  return <>{value.toLocaleString()}{suffix}</>;
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}

function FeatureCard({ icon, title, description, gradient }: FeatureCardProps) {
  return (
    <MagicCard
      className="cursor-pointer rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-6"
      gradientColor="#1a1a2e"
      gradientOpacity={0.9}
    >
      <div className={`mb-4 inline-flex items-center justify-center rounded-xl p-2.5 ${gradient}`}>
        {icon}
      </div>
      <h3 className="mb-2 text-sm font-semibold text-white">{title}</h3>
      <p className="text-xs leading-relaxed text-white/50">{description}</p>
    </MagicCard>
  );
}

interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navOpacity = Math.min(scrollY / 80, 1);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050507] text-white font-sans">
      {/* Ambient layers */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-purple-600/10 blur-[120px]" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-amber-500/5 blur-[100px]" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[100px]" />
      </div>
      <Spotlight className="fixed -top-40 left-0 md:left-60" fill="rgba(168,85,247,0.18)" />
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <Meteors number={22} />
      </div>

      {/* NAVBAR */}
      <nav
        className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300 md:px-12"
        style={{
          background: `rgba(5,5,7,${navOpacity * 0.9})`,
          backdropFilter: `blur(${navOpacity * 16}px)`,
          borderBottom: navOpacity > 0.5 ? "1px solid rgba(255,255,255,0.05)" : "1px solid transparent",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-purple-600 shadow-lg shadow-purple-500/30">
            <Compass size={16} className="text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-white">Drifter</span>
          <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400 border border-amber-400/20">
            Beta
          </span>
        </div>

        <div className="hidden items-center gap-8 md:flex">
          {["Features", "How it works", "About"].map((label) => (
            <a key={label} href="#" className="text-xs font-medium text-white/50 transition hover:text-white">
              {label}
            </a>
          ))}
        </div>

        <button
          id="nav-sign-in"
          onClick={onGetStarted}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/10 hover:border-white/20"
        >
          Sign in <ArrowRight size={12} />
        </button>
      </nav>

      {/* HERO */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-20 pb-16 text-center">
        <AnimatedGradientText className="mb-8 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/70">
          <Sparkles size={13} className="text-amber-400" />
          <span>Personal Interest Intelligence — v0.1 Beta</span>
        </AnimatedGradientText>

        <h1 className="mx-auto max-w-4xl text-5xl font-black tracking-tight leading-[1.1] sm:text-7xl">
          Your media attention,{" "}
          <span className="bg-gradient-to-r from-amber-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            decoded.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/55 sm:text-lg">
          Drifter transforms your YouTube watch history, Spotify streams, and browsing traces into an
          interactive AI intelligence map of your mind — revealing who you really are.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-300 font-medium">? 2D Vector Embedding Map</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-purple-300 font-medium">?? Markov Interest Forecasts</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-cyan-300 font-medium">?? Generative Curiosity DNA</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300 font-medium">? Multi-Platform Sync</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-rose-300 font-medium">?? AI Chat about Your Tastes</span>
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <ShimmerButton
            id="hero-get-started"
            onClick={onGetStarted}
            shimmerColor="#f59e0b"
            background="linear-gradient(135deg, #f59e0b, #d97706)"
            className="px-8 py-4 text-sm font-bold text-black shadow-xl shadow-amber-500/25"
          >
            <span className="flex items-center gap-2">
              Get Started Free <ArrowRight size={15} />
            </span>
          </ShimmerButton>

          <button className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-7 py-4 text-sm font-semibold text-white/80 backdrop-blur transition hover:bg-white/[0.08] hover:text-white">
            <Play size={14} className="fill-white/80" />
            Watch Demo
          </button>
        </div>

        <p className="mt-8 text-xs text-white/30">
          Built for curious minds · Powered by local AI · Your data stays private
        </p>

        {/* Dashboard Preview */}
        <div className="relative mt-16 w-full max-w-4xl">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c10]/80 p-2 shadow-2xl backdrop-blur-xl">
            <BorderBeam size={320} duration={10} borderWidth={1.5} colorFrom="#a855f7" colorTo="#f59e0b" />
            <div className="overflow-hidden rounded-2xl bg-[#080810]">
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                </div>
                <div className="mx-auto flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[10px] text-white/30">
                  <Compass size={9} />
                  drifter.app / dashboard
                </div>
              </div>
              <div className="grid grid-cols-12 gap-4 p-5">
                <div className="col-span-2 space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className={`h-7 rounded-lg ${i === 0 ? "bg-purple-500/20 border border-purple-500/30" : "bg-white/[0.03]"}`} />
                  ))}
                </div>
                <div className="col-span-7 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Topics", val: "142", color: "text-amber-400" },
                      { label: "Events", val: "8.4k", color: "text-purple-400" },
                      { label: "Drift", val: "73%", color: "text-cyan-400" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                        <p className="text-[10px] text-white/40">{label}</p>
                        <p className={`mt-1 text-xl font-bold ${color}`}>{val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="h-28 rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden relative">
                    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 112">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M0 80 C40 60 80 90 120 50 S200 20 240 45 S320 75 360 30 L400 20 L400 112 L0 112 Z" fill="url(#chartGrad)" />
                      <path d="M0 80 C40 60 80 90 120 50 S200 20 240 45 S320 75 360 30 L400 20" fill="none" stroke="#a855f7" strokeWidth="2" />
                    </svg>
                  </div>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                      <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-gradient-to-br from-amber-400/20 to-purple-500/20" />
                      <div className="flex-1 space-y-1">
                        <div className="h-2 w-3/4 rounded bg-white/10" />
                        <div className="h-1.5 w-1/3 rounded bg-white/[0.06]" />
                      </div>
                      <div className="h-5 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20" />
                    </div>
                  ))}
                </div>
                <div className="col-span-3 space-y-3">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                    <p className="mb-2 text-[10px] text-white/40">Interest DNA</p>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="mb-1.5 flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-purple-400/60" />
                        <div className="h-1.5 flex-1 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-amber-400" style={{ width: `${65 - i * 12}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="h-20 rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden relative">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute rounded-full"
                        style={{
                          width: `${4 + (i % 4) * 2}px`,
                          height: `${4 + (i % 4) * 2}px`,
                          left: `${10 + (i * 17) % 80}%`,
                          top: `${15 + (i * 23) % 70}%`,
                          background: ["#a855f7", "#f59e0b", "#06b6d4", "#10b981"][i % 4],
                          opacity: 0.5,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-20 rounded-full bg-purple-600/20 blur-3xl" />
        </div>
      </section>

      {/* STATS */}
      <section className="relative z-10 border-y border-white/[0.06] bg-white/[0.015] py-14">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 sm:grid-cols-4">
          {[
            { target: 10000, suffix: "+", label: "Events Tracked" },
            { target: 142, suffix: "", label: "Interest Topics" },
            { target: 4, suffix: "", label: "Platforms Integrated" },
            { target: 100, suffix: "%", label: "Private & Secure" },
          ].map(({ target, suffix, label }) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-black text-white sm:text-4xl">
                <Counter target={target} suffix={suffix} />
              </p>
              <p className="mt-1 text-xs text-white/40 font-medium">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 text-center">
          <AnimatedGradientText className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/70">
            <Zap size={12} className="text-amber-400" />
            <span>Core Features</span>
          </AnimatedGradientText>
          <h2 className="text-3xl font-black text-white sm:text-5xl">
            Everything you need to{" "}
            <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              understand yourself
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/50">
            Drifter ingests your media consumption data and turns it into actionable self-insight using
            state-of-the-art embedding models and probabilistic forecasting.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={<Brain size={20} className="text-amber-300" />} title="Interest Embedding Map" description="A live 2D UMAP visualization of every topic cluster in your media history. Zoom, filter, and explore your intellectual fingerprint." gradient="bg-amber-500/10" />
          <FeatureCard icon={<TrendingUp size={20} className="text-purple-300" />} title="Markov Interest Forecast" description="Probabilistic prediction of where your curiosity drifts next, powered by a hidden Markov model trained on your own history." gradient="bg-purple-500/10" />
          <FeatureCard icon={<Dna size={20} className="text-cyan-300" />} title="Curiosity DNA" description="A unique generative report — your personal interest genome that shows the depth, breadth, and evolution of your knowledge graph." gradient="bg-cyan-500/10" />
          <FeatureCard icon={<YouTubeIcon className="h-5 w-5 fill-[#FF0000]" />} title="YouTube Watch History" description="Import via Google Takeout or live OAuth sync. Drifter reads every video you've watched and builds semantic topic clusters." gradient="bg-red-500/10" />
          <FeatureCard icon={<SpotifyIcon className="h-5 w-5 fill-[#1DB954]" />} title="Spotify Listening History" description="Connect your Spotify account and unlock music-to-interest correlations. Find how your listening shapes your thinking." gradient="bg-emerald-500/10" />
          <FeatureCard icon={<Music size={20} className="text-rose-300" />} title="AI Chat & Analysis" description='Ask Drifter anything about your data. "What am I most curious about?" or "How has my taste evolved?" — get AI-powered answers.' gradient="bg-rose-500/10" />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative z-10 border-t border-white/[0.06] bg-white/[0.01] py-24">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black text-white sm:text-4xl">Three steps to self-discovery</h2>
            <p className="mt-3 text-sm text-white/45">Simple to start. Endlessly insightful.</p>
          </div>
          <div className="relative">
            <div className="absolute left-7 top-0 h-full w-px bg-gradient-to-b from-amber-400/40 via-purple-400/40 to-transparent hidden sm:block" />
            <div className="space-y-10">
              {[
                { step: "01", title: "Connect your accounts", description: "Link YouTube via Google OAuth or upload a Google Takeout export. Add Spotify for music data. Takes less than 60 seconds.", color: "amber" },
                { step: "02", title: "Let the AI analyze", description: "Drifter runs your history through an embedding model, clusters topics with UMAP/HDBSCAN, and builds your personal interest graph.", color: "purple" },
                { step: "03", title: "Explore your mind", description: "Browse the interactive interest map, read your Curiosity DNA, forecast your next obsession, and chat with your data.", color: "cyan" },
              ].map(({ step, title, description, color }) => (
                <div key={step} className="flex items-start gap-6">
                  <div className={`relative flex-shrink-0 flex h-14 w-14 items-center justify-center rounded-2xl border border-${color}-500/30 bg-${color}-500/10 text-${color}-400 font-black text-sm z-10`}>
                    {step}
                  </div>
                  <div className="pt-2">
                    <h3 className="text-base font-bold text-white mb-1">{title}</h3>
                    <p className="text-sm leading-relaxed text-white/50">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 py-28 px-6">
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c10] p-10 text-center shadow-2xl">
          <BorderBeam size={250} duration={12} borderWidth={1.5} colorFrom="#f59e0b" colorTo="#a855f7" />
          <Spotlight className="-top-20 left-1/2 -translate-x-1/2" fill="rgba(168,85,247,0.15)" />

          <AnimatedGradientText className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/70">
            <Sparkles size={13} className="text-amber-400" />
            <span>Start Free — No credit card required</span>
          </AnimatedGradientText>

          <h2 className="text-4xl font-black text-white sm:text-5xl leading-tight">
            Ready to meet{" "}
            <span className="bg-gradient-to-r from-amber-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              your mind?
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/55">
            Join Drifter and turn your media consumption into genuine self-knowledge. Your data is
            processed locally, stays private, and always belongs to you.
          </p>

          <ShimmerButton
            id="cta-create-account"
            onClick={onGetStarted}
            shimmerColor="#f59e0b"
            background="linear-gradient(135deg, #f59e0b, #d97706)"
            className="mt-8 px-10 py-4 text-sm font-bold text-black shadow-xl shadow-amber-500/25"
          >
            <span className="flex items-center gap-2">
              Create Free Account <ArrowRight size={15} />
            </span>
          </ShimmerButton>

          <p className="mt-5 text-xs text-white/25">
            Your data never leaves your device · Cryptographically signed tokens · 100% private
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/[0.06] px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-amber-400 to-purple-600">
              <Compass size={12} className="text-white" />
            </div>
            <span className="text-sm font-bold text-white/70">Drifter</span>
          </div>
          <p className="text-xs text-white/25">© {new Date().getFullYear()} Drifter · Personal Interest Intelligence</p>
          <div className="flex gap-6">
            {["Privacy", "Terms", "GitHub"].map((l) => (
              <a key={l} href="#" className="text-xs text-white/35 transition hover:text-white">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
