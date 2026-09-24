import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  CheckCircle2,
  PlugZap,
  UploadCloud,
  Puzzle,
  Activity,
  Radio,
  RefreshCw,
  Wifi,
} from "lucide-react";
import { MagicCard } from "@/components/ui/magic-card";
import { BorderBeam } from "@/components/ui/border-beam";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Meteors } from "@/components/ui/meteors";
import {
  GitHubConnectModal,
  RedditConnectModal,
  SteamKeyModal,
} from "@/components/analytics/PlatformConnectModals";

function YoutubeIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function SpotifyIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.308a.747.747 0 0 1-1.028.248c-2.813-1.718-6.353-2.107-10.523-1.155a.75.75 0 0 1-.334-1.462c4.562-1.042 8.483-.598 11.637 1.341.36.22.47.69.248 1.028zm1.47-3.267a.936.936 0 0 1-1.287.308c-3.22-1.979-8.13-2.552-11.94-1.396a.937.937 0 0 1-.548-1.792c4.354-1.32 9.774-.683 13.467 1.593.424.26.56.818.308 1.287zm.126-3.41c-3.86-2.293-10.228-2.505-13.896-1.391a1.124 1.124 0 0 1-.652-2.152c4.223-1.282 11.25-1.037 15.698 1.6c.49.29.65 1.022.25 1.691-.29.49-1.022.65-1.4.252z" />
    </svg>
  );
}

function GithubIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function RedditIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.688-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.197-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}

function NetflixIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M5.398 0v24c1.17-.428 2.37-.803 3.59-1.125V0H5.398zm9.614 0v19.467c1.23.33 2.44.71 3.59 1.135V0h-3.59zM8.988 0l6.024 20.377V0H8.988z" />
    </svg>
  );
}

function SteamIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.005.105.005.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 14.819C1.865 20.034 6.612 24 12.288 24c6.627 0 12-5.373 12-12S18.606 0 11.979 0zM7.544 14.975l-1.52-.628c.36-.613.98-1.053 1.706-1.186l1.621.67c-.361.614-.98 1.054-1.807 1.144zm8.396-8.324c1.27 0 2.302 1.033 2.302 2.305 0 1.27-1.032 2.303-2.302 2.303-1.273 0-2.306-1.033-2.306-2.303 0-1.272 1.033-2.305 2.306-2.305z" />
    </svg>
  );
}

function BrowserIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export type PlatformId =
  | "youtube"
  | "spotify"
  | "github"
  | "reddit"
  | "netflix"
  | "steam"
  | "browser";

interface PlatformDef {
  id: PlatformId;
  name: string;
  category: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bgGlow: string;
  ingestionType: "Extension" | "OAuth API" | "CSV / Export" | "Dual (API + Ext)";
  cognitiveRole: string;
  description: string;
  signalsCaptured: string[];
  defaultTopics: string[];
}

const PLATFORMS: PlatformDef[] = [
  {
    id: "youtube",
    name: "YouTube",
    category: "Video & Learning",
    icon: YoutubeIcon,
    color: "#ff3e3e",
    bgGlow: "rgba(255, 62, 62, 0.12)",
    ingestionType: "Dual (API + Ext)",
    cognitiveRole: "Visual attention, tutorial learning & intellectual rabbit holes",
    description:
      "Captures long-form video knowledge, documentary deep-dives, coding walkthroughs, and visual entertainment trends over time.",
    signalsCaptured: [
      "Watch history timestamps",
      "Topic & channel clustering",
      "Playback velocity & duration",
      "Late-night video rabbit holes",
    ],
    defaultTopics: ["Machine Learning", "System Architecture", "Sci-Fi Lore", "Tech Documentaries", "Creative Coding"],
  },
  {
    id: "spotify",
    name: "Spotify",
    category: "Audio & Acoustic Taste",
    icon: SpotifyIcon,
    color: "#1db954",
    bgGlow: "rgba(29, 185, 84, 0.12)",
    ingestionType: "OAuth API",
    cognitiveRole: "Mood regulation, focus rhythms & acoustic genre evolution",
    description:
      "Syncs streaming audio history to understand emotional state, deep work music patterns, and musical artist affinity drift.",
    signalsCaptured: [
      "Track & Artist play counts",
      "Audio mood & energy attributes",
      "Focus sessions vs ambient listening",
      "Genre transition timelines",
    ],
    defaultTopics: ["Synthwave / Cyberpunk", "Lo-Fi Deep Focus", "Ambient Drone", "Post-Rock", "Electronic Beats"],
  },
  {
    id: "github",
    name: "GitHub",
    category: "Engineering & Craft",
    icon: GithubIcon,
    color: "#a371f7",
    bgGlow: "rgba(163, 113, 247, 0.12)",
    ingestionType: "OAuth API",
    cognitiveRole: "Technical curiosity, language migration & open-source exploration",
    description:
      "Monitors starred repositories, commit activity, language shifts (e.g. TypeScript → Rust → Python), and emerging tech libraries.",
    signalsCaptured: [
      "Starred repositories & topics",
      "Commit velocity by repo",
      "Language distribution changes",
      "Open-source dependency tracking",
    ],
    defaultTopics: ["Rust Systems", "AI Agent Frameworks", "Distributed Databases", "WebAssembly", "GPU Compute"],
  },
  {
    id: "reddit",
    name: "Reddit",
    category: "Niche Communities",
    icon: RedditIcon,
    color: "#ff5722",
    bgGlow: "rgba(255, 87, 34, 0.12)",
    ingestionType: "CSV / Export",
    cognitiveRole: "Subculture exploration, hobby deep-dives & informal debates",
    description:
      "Analyzes subreddits you browse and upvote to uncover hyper-specific interests, amateur hardware projects, and niche hobbies.",
    signalsCaptured: [
      "Subreddit participation score",
      "Upvoted threads & questions",
      "Hobby community emergence",
      "Discussion sentiment trajectory",
    ],
    defaultTopics: ["r/mechanicalkeyboards", "r/LocalLLaMA", "r/selfhosted", "r/cassetteculture", "r/homelab"],
  },
  {
    id: "netflix",
    name: "Netflix & Film",
    category: "Cinematic Narrative",
    icon: NetflixIcon,
    color: "#e50914",
    bgGlow: "rgba(229, 9, 20, 0.12)",
    ingestionType: "Extension",
    cognitiveRole: "Narrative taste, genre aesthetics & entertainment cycles",
    description:
      "Passive extension capture and viewing history CSV parsing to map changes in movie tastes, directorial preferences, and binge patterns.",
    signalsCaptured: [
      "Show & Film title logs",
      "Genre & Director clustering",
      "Weekend binge velocity",
      "Aesthetic taste shifts",
    ],
    defaultTopics: ["Psychological Thrillers", "Cyberpunk Noir", "Historical Epics", "Anime Series", "A24 Dramas"],
  },
  {
    id: "steam",
    name: "Steam Gaming",
    category: "Interactive Play",
    icon: SteamIcon,
    color: "#66c0f4",
    bgGlow: "rgba(102, 192, 244, 0.12)",
    ingestionType: "OAuth API",
    cognitiveRole: "Strategic thinking, escapism & interactive game genres",
    description:
      "Pulls playtime metrics and game genres to analyze how you relax, compete, and explore virtual worlds.",
    signalsCaptured: [
      "Recent playtime distribution",
      "Genre shifts (Strategy → Roguelike)",
      "Achievement velocity",
      "Focus vs sandbox game styles",
    ],
    defaultTopics: ["Grand Strategy", "Sci-Fi Roguelikes", "Tactical RPGs", "Automation Sims", "Indie Puzzlers"],
  },
  {
    id: "browser",
    name: "Web Browsing",
    category: "360° Curiosity Engine",
    icon: BrowserIcon,
    color: "#38bdf8",
    bgGlow: "rgba(56, 189, 248, 0.12)",
    ingestionType: "Extension",
    cognitiveRole: "Spontaneous curiosity, Wikipedia spirals & deep web research",
    description:
      "The ultimate cross-web layer. The Drifter extension safely captures search queries, documentation pages, and reading sessions.",
    signalsCaptured: [
      "Research session duration",
      "Search query topic extraction",
      "Documentation reading habits",
      "Cross-site curiosity trails",
    ],
    defaultTopics: ["Quantum Computing", "Philosophy of Mind", "Urban Planning", "Neuroscience", "Typography"],
  },
];

interface PlatformIntelligenceHubProps {
  assignments?: Array<{
    event_id: number;
    title: string;
    topic: string;
    source: string;
    timestamp: string;
  }>;
  onOpenImport?: () => void;
  onOpenExtension?: () => void;
  onConnectSpotify?: () => void;
  onRefresh?: () => void;
  githubConnected?: boolean;
  redditConnected?: boolean;
}

export default function PlatformIntelligenceHub({
  assignments = [],
  onOpenImport,
  onOpenExtension,
  onConnectSpotify,
  onRefresh,
  githubConnected = false,
  redditConnected = false,
}: PlatformIntelligenceHubProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId>("youtube");
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [redditModalOpen, setRedditModalOpen] = useState(false);
  const [steamModalOpen, setSteamModalOpen] = useState(false);

  const platformDataCounts = useMemo(() => {
    const counts: Record<string, number> = {
      youtube: 0,
      spotify: 0,
      github: 0,
      reddit: 0,
      netflix: 0,
      steam: 0,
      browser: 0,
    };
    for (const a of assignments) {
      const src = (a.source || "").toLowerCase();
      if (counts[src] !== undefined) {
        counts[src]++;
      }
    }
    return counts;
  }, [assignments]);

  const activeDef = useMemo(
    () => PLATFORMS.find((p) => p.id === selectedPlatform) || PLATFORMS[0],
    [selectedPlatform],
  );

  const platformEvents = useMemo(() => {
    return assignments.filter(
      (a) => (a.source || "").toLowerCase() === selectedPlatform,
    );
  }, [assignments, selectedPlatform]);

  const activeTopics = useMemo(() => {
    if (platformEvents.length > 0) {
      const topicFreq: Record<string, number> = {};
      for (const e of platformEvents) {
        topicFreq[e.topic] = (topicFreq[e.topic] || 0) + 1;
      }
      return Object.entries(topicFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([t]) => t);
    }
    return activeDef.defaultTopics;
  }, [platformEvents, activeDef]);

  const isLiveConnected = (platformDataCounts[selectedPlatform] || 0) > 0;

  return (
    <>
    <div className="mt-8 overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7 backdrop-blur-xl">
      {/* SECTION HEADER */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.06] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300">
              <Radio size={11} className="animate-pulse text-purple-400" />
              Multi-Source Ecosystem
            </span>
            <span className="text-xs text-white/30">7 Dimensions</span>
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
            Platform Intelligence Hub
          </h2>
          <p className="text-xs leading-relaxed text-white/45 max-w-xl mt-1">
            Drifter aggregates your attention signals across video, audio, code, discussions, cinema, and web research into a unified interest continuum.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2 sm:pt-0">
          <button
            onClick={onOpenExtension}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white"
          >
            <Puzzle size={14} className="text-purple-400" />
            Extension Sync
          </button>
          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white"
          >
            <UploadCloud size={14} className="text-amber-400" />
            Import Data
          </button>
        </div>
      </div>

      {/* PLATFORM CARDS SELECTOR */}
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
        {PLATFORMS.map((plat) => {
          const Icon = plat.icon;
          const isSelected = selectedPlatform === plat.id;
          const count = platformDataCounts[plat.id] || 0;
          const hasData = count > 0;

          return (
            <button
              key={plat.id}
              onClick={() => setSelectedPlatform(plat.id)}
              type="button"
              className={`group relative flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all duration-300 ${
                isSelected
                  ? "border-white/30 bg-white/[0.08] shadow-[0_0_20px_rgba(255,255,255,0.06)]"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="active-platform-glow"
                  className="absolute inset-0 rounded-2xl border border-white/20 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}

              <div className="flex w-full items-center justify-between">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
                  style={{
                    background: `${plat.color}1f`,
                    color: plat.color,
                    border: `1px solid ${plat.color}3f`,
                  }}
                >
                  <Icon size={16} />
                </div>
                {hasData ? (
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                )}
              </div>

              <span className="mt-3 text-xs font-semibold text-white group-hover:text-white">
                {plat.name}
              </span>
              <span className="text-[10px] text-white/35 truncate w-full">
                {hasData ? `${count.toLocaleString()} traces` : plat.category}
              </span>
            </button>
          );
        })}
      </div>

      {/* DEDICATED PLATFORM CONTENT PANEL */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeDef.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="mt-6"
        >
          <MagicCard
            className="relative overflow-hidden rounded-2xl border border-white/10 p-6 sm:p-8"
            gradientColor={activeDef.color}
            gradientOpacity={0.15}
          >
            <BorderBeam size={180} duration={10} borderWidth={1.2} colorFrom={activeDef.color} colorTo="#ffffff" />
            <Meteors number={6} className="opacity-20" />

            <div className="relative z-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              {/* LEFT: PLATFORM OVERVIEW & COGNITIVE ROLE */}
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{
                      background: `${activeDef.color}25`,
                      color: activeDef.color,
                      border: `1px solid ${activeDef.color}50`,
                    }}
                  >
                    <activeDef.icon size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white">{activeDef.name}</h3>
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/60">
                        {activeDef.category}
                      </span>
                    </div>
                    <p className="text-xs text-white/40 font-mono mt-0.5">
                      Ingestion: <span className="text-white/80">{activeDef.ingestionType}</span>
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                    Cognitive Dimension
                  </span>
                  <p className="mt-1 text-sm font-medium text-white/90">
                    {activeDef.cognitiveRole}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-white/45">
                    {activeDef.description}
                  </p>
                </div>

                {/* SIGNALS CAPTURED */}
                <div>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                    Signals Ingested & Analyzed
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeDef.signalsCaptured.map((sig, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2 text-xs text-white/70"
                      >
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        <span className="truncate">{sig}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ACTION ROW */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  {/* Spotify */}
                  {activeDef.id === "spotify" && (
                    <ShimmerButton
                      onClick={onConnectSpotify}
                      shimmerColor="#1db954"
                      background="rgba(29, 185, 84, 0.15)"
                      className="border-[#1db954]/40 text-xs text-emerald-300 h-9 px-4"
                    >
                      <span className="flex items-center gap-1.5">
                        <PlugZap size={14} />
                        <span>Connect Spotify Account</span>
                      </span>
                    </ShimmerButton>
                  )}

                  {/* YouTube */}
                  {activeDef.id === "youtube" && (
                    <ShimmerButton
                      onClick={onOpenExtension}
                      shimmerColor="#ff3e3e"
                      background="rgba(255, 62, 62, 0.15)"
                      className="border-rose-500/40 text-xs text-rose-200 h-9 px-4"
                    >
                      <span className="flex items-center gap-1.5">
                        <Puzzle size={14} />
                        <span>Sync via Extension</span>
                      </span>
                    </ShimmerButton>
                  )}

                  {/* GitHub — OAuth */}
                  {activeDef.id === "github" && (
                    <ShimmerButton
                      onClick={() => setGithubModalOpen(true)}
                      shimmerColor="#a371f7"
                      background="rgba(163,113,247,0.15)"
                      className="border-[#a371f7]/40 text-xs text-purple-200 h-9 px-4"
                    >
                      <span className="flex items-center gap-1.5">
                        {githubConnected ? <RefreshCw size={13} /> : <PlugZap size={14} />}
                        <span>{githubConnected ? "Manage GitHub" : "Connect GitHub"}</span>
                      </span>
                    </ShimmerButton>
                  )}

                  {/* Reddit — OAuth */}
                  {activeDef.id === "reddit" && (
                    <ShimmerButton
                      onClick={() => setRedditModalOpen(true)}
                      shimmerColor="#ff5722"
                      background="rgba(255,87,34,0.15)"
                      className="border-[#ff5722]/40 text-xs text-orange-200 h-9 px-4"
                    >
                      <span className="flex items-center gap-1.5">
                        {redditConnected ? <RefreshCw size={13} /> : <PlugZap size={14} />}
                        <span>{redditConnected ? "Manage Reddit" : "Connect Reddit"}</span>
                      </span>
                    </ShimmerButton>
                  )}

                  {/* Steam — API Key */}
                  {activeDef.id === "steam" && (
                    <ShimmerButton
                      onClick={() => setSteamModalOpen(true)}
                      shimmerColor="#66c0f4"
                      background="rgba(102,192,244,0.15)"
                      className="border-[#66c0f4]/40 text-xs text-sky-200 h-9 px-4"
                    >
                      <span className="flex items-center gap-1.5">
                        <PlugZap size={14} />
                        <span>Enter Steam API Key</span>
                      </span>
                    </ShimmerButton>
                  )}

                  {/* Netflix — extension passive */}
                  {activeDef.id === "netflix" && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                        <Wifi size={13} />
                        <span>Extension captures passively</span>
                      </div>
                      <button
                        onClick={onOpenExtension}
                        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60 hover:text-white hover:bg-white/[0.07] transition"
                      >
                        <Puzzle size={13} /> Extension Settings
                      </button>
                    </div>
                  )}

                  {/* Browser — extension passive */}
                  {activeDef.id === "browser" && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-300">
                        <Wifi size={13} />
                        <span>Extension captures passively</span>
                      </div>
                      <button
                        onClick={onOpenExtension}
                        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60 hover:text-white hover:bg-white/[0.07] transition"
                      >
                        <Puzzle size={13} /> Extension Settings
                      </button>
                    </div>
                  )}

                  {/* Fallback upload button for platforms that also support CSV */}
                  {["youtube", "spotify", "reddit", "netflix"].includes(activeDef.id) && (
                    <button
                      onClick={onOpenImport}
                      className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      <UploadCloud size={13} />
                      <span>Upload CSV / Export</span>
                    </button>
                  )}
                </div>
              </div>

              {/* RIGHT: DETECTED TOPICS & RECENT TRACE STREAM */}
              <div className="flex flex-col justify-between rounded-xl border border-white/[0.07] bg-black/40 p-5">
                <div>
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <span className="text-xs font-semibold text-white flex items-center gap-2">
                      <Sparkles size={13} className="text-amber-400" />
                      {isLiveConnected ? "Detected Clusters" : "Target Topic Clusters"}
                    </span>
                    <span className="font-mono text-[10px] text-white/30 uppercase">
                      {isLiveConnected ? "Live" : "Profile Model"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {activeTopics.map((topic, i) => (
                      <span
                        key={i}
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/80 transition hover:border-white/20 hover:text-white"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>

                {/* RECENT TRACE STREAM */}
                <div className="mt-6 border-t border-white/[0.06] pt-4">
                  <div className="flex items-center justify-between text-xs text-white/40 mb-2.5">
                    <span>Recent Stream Log</span>
                    <span className="font-mono text-[10px]">
                      {platformEvents.length > 0
                        ? `${platformEvents.length} events logged`
                        : "Ready for sync"}
                    </span>
                  </div>

                  {platformEvents.length > 0 ? (
                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
                      {platformEvents.slice(-4).reverse().map((ev) => (
                        <div
                          key={ev.event_id}
                          className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] p-2 text-xs"
                        >
                          <span className="truncate max-w-[200px] text-white/80 font-medium">
                            {ev.title}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-white/35">
                            {ev.topic}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.01] py-6 text-center">
                      <Activity size={18} className="text-white/20" />
                      <p className="mt-2 text-xs text-white/40">
                        No active traces yet for {activeDef.name}.
                      </p>
                      <p className="text-[10px] text-white/20 mt-0.5">
                        Sync through the Chrome Extension or import your history export file.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </MagicCard>
        </motion.div>
      </AnimatePresence>
    </div>

    {/* ── Platform Connect Modals ── */}
    <GitHubConnectModal
      open={githubModalOpen}
      onClose={() => setGithubModalOpen(false)}
      isConnected={githubConnected}
      onRefresh={onRefresh}
    />
    <RedditConnectModal
      open={redditModalOpen}
      onClose={() => setRedditModalOpen(false)}
      isConnected={redditConnected}
      onRefresh={onRefresh}
    />
    <SteamKeyModal
      open={steamModalOpen}
      onClose={() => setSteamModalOpen(false)}
      onRefresh={onRefresh}
    />
  </>
  );
}

