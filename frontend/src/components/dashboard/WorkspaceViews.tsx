import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  Bot,
  Brain,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Compass,
  Dna,
  Download,
  ExternalLink,
  Filter,
  Flame,
  GitBranch,
  History,
  Layers,
  Map as MapIcon,
  Puzzle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";


import InterestMap from "@/components/InterestMap";
import InterestMomentum from "@/components/analytics/InterestMomentum";
import InterestEvolution from "@/components/analytics/InterestEvolution";
import TopicDistribution from "@/components/analytics/TopicDistribution";
import PredictionView from "@/components/prediction/PredictionView";
import CorrelationView from "@/components/analytics/CorrelationView";
import InterestDnaCard from "@/components/reports/InterestDnaCard";
import PlatformIntelligenceHub from "@/components/analytics/PlatformIntelligenceHub";
import CuriosityNexusView from "@/components/analytics/CuriosityNexusView";
import FocusPulseHeatmap from "@/components/analytics/FocusPulseHeatmap";
import NumberTicker from "@/components/ui/NumberTicker";
import type { DashboardData } from "@/services/analytics";
import { deleteHistoryEvent, clearHistory, type HistoryEvent } from "@/services/history";


export type WorkspaceView =
  | "overview"
  | "map"
  | "evolution"
  | "behavior"
  | "history"
  | "prediction"
  | "correlation"
  | "dna"
  | "nexus";

interface WorkspaceProps {
  dashboard: DashboardData;
  history: HistoryEvent[];
  historyLoading: boolean;
  onOpenView: (view: WorkspaceView) => void;
  onRefresh?: () => void;
  onOpenImport?: () => void;
  onOpenExtension?: () => void;
  onConnectSpotify?: () => void;
}


interface Assignment {
  event_id: number;
  timestamp: string;
  source: string;
  title: string;
  artist: string | null;
  topic: string;
}

interface TopicPoint {
  topic: string;
  count: number;
}

function assignmentsOf(dashboard: DashboardData): Assignment[] {
  return dashboard.assignments as Assignment[];
}

function topicColor(topic: string, index = 0) {
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
  for (const character of topic) hash = character.charCodeAt(0) + ((hash << 5) - hash);
  return palette[Math.abs(hash + index) % palette.length];
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`workspace-panel ${className}`}>{children}</section>;
}

function ViewIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="workspace-intro">
      <div>
        <p className="workspace-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="workspace-empty">
      <span>{message}</span>
    </div>
  );
}

function TopicList({ topics, onSelect }: { topics: TopicPoint[]; onSelect?: (topic: string) => void }) {
  const maximum = topics[0]?.count || 1;
  return (
    <div className="topic-list">
      {topics.slice(0, 8).map((topic, index) => (
        <button className="topic-list-row" key={topic.topic} onClick={() => onSelect?.(topic.topic)}>
          <span className="topic-index">{String(index + 1).padStart(2, "0")}</span>
          <span className="topic-name">{topic.topic}</span>
          <span className="topic-count">{topic.count}</span>
          <span className="topic-track">
            <span style={{ width: `${(topic.count / maximum) * 100}%`, background: topicColor(topic.topic, index) }} />
          </span>
        </button>
      ))}
    </div>
  );
}

export function OverviewView({
  dashboard,
  onOpenView,
  onRefresh,
  onOpenImport,
  onOpenExtension,
  onConnectSpotify,
}: WorkspaceProps) {
  const overview = dashboard.overview;
  const assignments = assignmentsOf(dashboard);
  const latest = assignments.slice(-6).reverse();
  const dominant = overview.dominant_topic || "No dominant topic yet";
  const eventCount = typeof overview.events === "number" ? overview.events : Array.isArray(overview.events) ? (overview.events as unknown[]).length : Number(overview.events) || assignments.length;

  return (
    <>
      <ViewIntro
        eyebrow="Personal Signal / Neural Intelligence Engine"
        title="Your attention has a shape."
        description="A real-time readout of what you explore, how curiosities connect across platforms, and where your focus is drifting next."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {onRefresh && (
              <button
                className="workspace-action hover:border-amber-500/50 hover:text-amber-400 transition"
                onClick={onRefresh}
                title="Re-cluster with clean topic labels"
              >
                <RefreshCw size={14} /> Re-analyze Topics
              </button>
            )}
            {onOpenImport && (
              <button
                className="workspace-action hover:border-purple-500/50 hover:text-purple-400 transition"
                onClick={onOpenImport}
              >
                <Upload size={14} /> Import History
              </button>
            )}
            <button className="workspace-action bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 transition" onClick={() => onOpenView("map")}>
              <MapIcon size={15} /> Open 3D Map
            </button>
          </div>
        }
      />

      {/* QUICK FEATURE LAUNCHPAD */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <button
          onClick={() => onOpenView("map")}
          className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left backdrop-blur-md transition-all hover:-translate-y-1 hover:border-amber-400/40 hover:bg-white/[0.05] hover:shadow-xl hover:shadow-amber-500/10"
        >
          <div className="flex items-center justify-between w-full mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 group-hover:scale-110 transition">
              <MapIcon size={18} />
            </div>
            <ArrowUpRight size={16} className="text-white/30 group-hover:text-amber-400 transition" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white group-hover:text-amber-400 transition">Interest Map</h3>
            <p className="mt-1 text-xs text-white/50 leading-relaxed">2D semantic cluster vector space</p>
          </div>
        </button>

        <button
          onClick={() => onOpenView("nexus")}
          className="group relative flex flex-col justify-between rounded-2xl border border-amber-400/30 bg-amber-500/[0.04] p-4 text-left backdrop-blur-md transition-all hover:-translate-y-1 hover:border-amber-400 hover:bg-amber-500/[0.08] hover:shadow-xl hover:shadow-amber-500/15"
        >
          <div className="flex items-center justify-between w-full mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300 group-hover:scale-110 transition">
              <Sparkles size={18} />
            </div>
            <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-400/30">NEW</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white group-hover:text-amber-300 transition">Curiosity Nexus</h3>
            <p className="mt-1 text-xs text-white/50 leading-relaxed">AI cross-disciplinary bridges</p>
          </div>
        </button>

        <button
          onClick={() => onOpenView("prediction")}
          className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left backdrop-blur-md transition-all hover:-translate-y-1 hover:border-purple-400/40 hover:bg-white/[0.05] hover:shadow-xl hover:shadow-purple-500/10"
        >
          <div className="flex items-center justify-between w-full mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-400/10 text-purple-400 group-hover:scale-110 transition">
              <Brain size={18} />
            </div>
            <ArrowUpRight size={16} className="text-white/30 group-hover:text-purple-400 transition" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white group-hover:text-purple-400 transition">AI Predictions</h3>
            <p className="mt-1 text-xs text-white/50 leading-relaxed">Markov horizon forecasts</p>
          </div>
        </button>

        <button
          onClick={() => onOpenView("dna")}
          className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left backdrop-blur-md transition-all hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-white/[0.05] hover:shadow-xl hover:shadow-cyan-500/10"
        >
          <div className="flex items-center justify-between w-full mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400 group-hover:scale-110 transition">
              <Dna size={18} />
            </div>
            <ArrowUpRight size={16} className="text-white/30 group-hover:text-cyan-400 transition" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition">Interest DNA</h3>
            <p className="mt-1 text-xs text-white/50 leading-relaxed">Entropy & cognitive archetype</p>
          </div>
        </button>

        <button
          onClick={() => onOpenView("correlation")}
          className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left backdrop-blur-md transition-all hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-white/[0.05] hover:shadow-xl hover:shadow-emerald-500/10"
        >
          <div className="flex items-center justify-between w-full mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 group-hover:scale-110 transition">
              <Zap size={18} />
            </div>
            <ArrowUpRight size={16} className="text-white/30 group-hover:text-emerald-400 transition" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition">Platform Synergy</h3>
            <p className="mt-1 text-xs text-white/50 leading-relaxed">Audio/video media correlation</p>
          </div>
        </button>
      </div>

      {/* SIGNAL METRICS HUD */}
      <div className="signal-grid mt-6">
        <div className="signal-card signal-card-featured relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
            <Flame size={72} className="text-amber-400" />
          </div>
          <span className="signal-label">Current center of gravity</span>
          <strong className="text-2xl font-bold tracking-tight text-white">{dominant}</strong>
          <p className="mt-2 text-xs text-white/60">
            <span className="font-semibold text-white/90">
              <NumberTicker value={eventCount} />
            </span>{" "}
            total events indexed across{" "}
            <span className="font-semibold text-white/90">
              <NumberTicker value={overview.topics || 0} />
            </span>{" "}
            distinct topic clusters.
          </p>
          <button onClick={() => onOpenView("map")} className="text-action mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300">
            Explore cluster in vector space <ArrowUpRight size={14} />
          </button>
        </div>

        <div className="signal-card relative overflow-hidden group">
          <span className="signal-label">Latest drift velocity</span>
          <strong className="text-2xl font-bold tracking-tight text-white">
            <NumberTicker value={overview.current_drift || 0} decimals={3} />
          </strong>
          <p className="mt-2 text-xs text-white/60">
            Rate of change in your interest distribution over recent timeline windows.
          </p>
          <button onClick={() => onOpenView("evolution")} className="text-action mt-3 inline-flex items-center gap-1 text-xs font-semibold text-purple-400 hover:text-purple-300">
            View trajectory chart <ArrowUpRight size={14} />
          </button>
        </div>

        <div className="signal-card relative overflow-hidden group">
          <span className="signal-label">Emerging focus paths</span>
          <strong className="text-2xl font-bold tracking-tight text-white">
            <NumberTicker value={dashboard.evolution?.emerging?.length || 0} />
          </strong>
          <p className="mt-2 text-xs text-white/60">
            Newly detected curiosity directions in your media streams.
          </p>
          <button onClick={() => onOpenView("evolution")} className="text-action mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300">
            Inspect emerging topics <ArrowUpRight size={14} />
          </button>
        </div>
      </div>

      {/* TOPIC LANDSCAPE & ACTIVITY FEED */}
      <div className="workspace-two-column mt-6">
        <Panel>
          <div className="panel-heading">
            <div>
              <span className="workspace-eyebrow">Most Explored</span>
              <h2>Topic Landscape</h2>
            </div>
            <button className="icon-action" title="Open interest map" onClick={() => onOpenView("map")}>
              <MapIcon size={16} />
            </button>
          </div>
          <TopicList topics={dashboard.top_topics} onSelect={() => onOpenView("map")} />
        </Panel>

        <Panel>
          <div className="panel-heading">
            <div>
              <span className="workspace-eyebrow">Recent Traces</span>
              <h2>Latest Activity</h2>
            </div>
            <button className="icon-action" title="Open history" onClick={() => onOpenView("history")}>
              <History size={16} />
            </button>
          </div>
          <div className="trace-list">
            {latest.map((event) => (
              <div className="trace-row" key={event.event_id}>
                <span className="trace-dot" style={{ background: topicColor(event.topic) }} />
                <div className="min-w-0 flex-1">
                  <strong className="truncate block text-xs font-medium text-white">{event.title}</strong>
                  <span className="text-[11px] text-white/40">
                    {event.topic} · <span className="uppercase text-amber-400/80 font-semibold">{event.source}</span>
                  </span>
                </div>
                <time className="text-[11px] text-white/35">
                  {new Date(event.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </time>
              </div>
            ))}
            {!latest.length && <Empty message="Import history or connect platforms to reveal your digital traces." />}
          </div>
        </Panel>
      </div>

      {/* PLATFORM INTELLIGENCE & DISTRIBUTION */}
      <div className="mt-6 space-y-6">
        <PlatformIntelligenceHub
          assignments={assignments}
          onOpenImport={onOpenImport}
          onOpenExtension={onOpenExtension}
          onConnectSpotify={onConnectSpotify}
        />
        <TopicDistribution topics={dashboard.top_topics} />
        <InterestMomentum
          rising={dashboard.evolution.rising}
          fading={dashboard.evolution.fading}
          assignments={dashboard.assignments}
        />
      </div>
    </>
  );
}

export function MapView({ dashboard, onOpenView }: WorkspaceProps) {
  const interestMap = dashboard?.visualizations?.interest_map || { points: [], topic_centers: [] };

  return (
    <>
      <ViewIntro
        eyebrow="Spatial index / interest map"
        title="Where your attention lives."
        description="Nearby points share a semantic neighborhood. Explore your attention clusters and interactive constellations."
        action={
          <button className="workspace-action" onClick={() => onOpenView("history")}>
            <History size={15} /> Browse events
          </button>
        }
      />
      <div className="mt-4">
        <InterestMap data={interestMap} />
      </div>
      <div className="workspace-three-column mt-6">
        <MovementMini
          title="Rising"
          items={(dashboard.evolution?.rising || []).map((i) => i.topic)}
          icon={<TrendingUp size={16} />}
          tone="positive"
        />
        <MovementMini
          title="Fading"
          items={(dashboard.evolution?.fading || []).map((i) => i.topic)}
          icon={<TrendingDown size={16} />}
          tone="muted"
        />
        <MovementMini
          title="Emerging"
          items={(dashboard.evolution?.emerging || []).map((i) => i.topic)}
          icon={<Sparkles size={16} />}
          tone="warm"
        />
      </div>
    </>
  );
}

export function EvolutionView({ dashboard, onOpenView }: WorkspaceProps) {
  const chartData = Object.entries(dashboard.evolution.monthly_drift).map(([month, drift]) => ({ month, drift }));
  const momentumByTopic = dashboard.evolution?.momentum || {};
  const momentumEntries = useMemo(() => {
    const entries: { topic: string; value: number }[] = [];
    for (const [topic, val] of Object.entries(momentumByTopic)) {
      if (typeof val === "number") {
        entries.push({ topic, value: val });
      } else if (val && typeof val === "object") {
        const subVals = Object.values(val as Record<string, number>);
        const latestVal = subVals.length ? subVals[subVals.length - 1] : 0;
        entries.push({ topic, value: latestVal });
      }
    }
    return entries.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }, [momentumByTopic]);

  return (
    <>
      <ViewIntro eyebrow="Temporal signal / evolution" title="Your interests are in motion." description="Trace the moments when one curiosity gave way to another." action={<button className="workspace-action" onClick={() => onOpenView("map")}><MapIcon size={15} /> See the map</button>} />
      <InterestEvolution monthlyProportions={dashboard.evolution.monthly_proportions} />
      <Panel className="chart-panel mt-6"><div className="panel-heading"><div><span className="workspace-eyebrow">Movement</span><h2>Interest drift</h2></div><strong className="panel-stat">{dashboard.overview.current_drift.toFixed(3)}</strong></div><div className="large-chart">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="workspaceDrift" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2b56b" stopOpacity={0.34} /><stop offset="100%" stopColor="#f2b56b" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(255,255,255,0.07)" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,.4)", fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,.4)", fontSize: 11 }} /><Tooltip contentStyle={{ background: "#151512", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, color: "#fff" }} /><Area type="monotone" dataKey="drift" stroke="#f2b56b" fill="url(#workspaceDrift)" strokeWidth={2} /></AreaChart></ResponsiveContainer> : <Empty message="Import more history to see change over time." />}</div></Panel>
      <div className="workspace-two-column mt-6"><Panel><div className="panel-heading"><div><span className="workspace-eyebrow">Momentum</span><h2>Fastest-moving topics</h2></div><Activity size={16} /></div><div className="momentum-list">{momentumEntries.slice(0, 6).map((item, index) => <div className="momentum-row" key={item.topic}><i style={{ background: topicColor(item.topic, index) }} /><span>{item.topic}</span><strong className={item.value >= 0 ? "positive" : "negative"}>{item.value >= 0 ? "+" : ""}{item.value.toFixed(2)}</strong></div>)}{!momentumEntries.length && <Empty message="No topic momentum changes recorded yet." />}</div></Panel><Panel><div className="panel-heading"><div><span className="workspace-eyebrow">Direction</span><h2>What is changing</h2></div><CalendarDays size={16} /></div><div className="direction-stack"><DirectionRow label="Rising" items={dashboard.evolution.rising.map((i) => i.topic)} icon={<ArrowUpRight size={15} />} /><DirectionRow label="Fading" items={dashboard.evolution.fading.map((i) => i.topic)} icon={<ArrowDownRight size={15} />} /><DirectionRow label="Emerging" items={dashboard.evolution.emerging.map((i) => i.topic)} icon={<Sparkles size={15} />} /></div></Panel></div>
    </>
  );
}


interface RabbitHoleEvent {
  title: string;
  source: string;
  timestamp: string;
  topic?: string;
  artist?: string | null;
  url?: string | null;
}

interface RabbitHoleItem {
  start?: string;
  end?: string;
  duration_minutes?: number;
  event_count?: number;
  count?: number;
  dominant_topic?: string;
  topic?: string;
  name?: string;
  topic_count?: number;
  events?: RabbitHoleEvent[];
}

export function BehaviorView({ dashboard, onOpenView }: WorkspaceProps) {
  const [selectedHole, setSelectedHole] = useState<RabbitHoleItem | null>(null);

  const behavior = dashboard?.behavior || {
    time_of_day: {},
    day_of_week: {},
    topic_transitions: [],
    rabbit_holes: [],
    interest_concentration: {},
  };

  const concentration = (behavior.interest_concentration || {}) as Record<string, any>;
  const concentrationVal = concentration.dominant_share
    ? `${(concentration.dominant_share * 100).toFixed(0)}%`
    : concentration.topic_count
    ? `${concentration.topic_count} topics`
    : "0%";

  // Parse time_of_day properly
  const timeEntries = Object.entries(behavior.time_of_day || {}).map(([period, topicMap]) => {
    let count = 0;
    let topTopic = "";
    if (typeof topicMap === "number") {
      count = topicMap;
    } else if (topicMap && typeof topicMap === "object") {
      const entries = Object.entries(topicMap as Record<string, number>);
      count = entries.reduce((s, [, c]) => s + c, 0);
      if (entries.length > 0) {
        entries.sort((a, b) => b[1] - a[1]);
        topTopic = entries[0][0];
      }
    }
    return { period, count, topTopic };
  });

  const maxCount = Math.max(...timeEntries.map((t) => t.count), 1);
  const timeRows = timeEntries.sort((a, b) => b.count - a.count);

  return (
    <>
      <ViewIntro
        eyebrow="Behavioral signal / patterns"
        title="How you explore."
        description="Your habits are part of the map too: loops, transitions, and the hours when curiosity is most active."
        action={
          <button className="workspace-action" onClick={() => onOpenView("history")}>
            <History size={15} /> Inspect history
          </button>
        }
      />
      <div className="signal-grid">
        <div className="signal-card">
          <span className="signal-label">Rabbit holes</span>
          <strong className="text-2xl font-bold tracking-tight text-white">
            <NumberTicker value={behavior.rabbit_holes?.length || 0} />
          </strong>
          <p>Deep sessions where one thread kept pulling you onward.</p>
        </div>
        <div className="signal-card">
          <span className="signal-label">Topic transitions</span>
          <strong className="text-2xl font-bold tracking-tight text-white">
            <NumberTicker value={behavior.topic_transitions?.length || 0} />
          </strong>
          <p>Moves between different interest neighborhoods.</p>
        </div>
        <div className="signal-card">
          <span className="signal-label">Concentration</span>
          <strong className="text-2xl font-bold tracking-tight text-white">{concentrationVal}</strong>
          <p>
            {concentration.dominant_topic
              ? `Main focus: ${concentration.dominant_topic}`
              : "Measured focus of your activity."}
          </p>
        </div>
      </div>

      {/* WEEKLY ACTIVITY HEATMAP & FOCUS PULSE */}
      <div className="mt-6">
        <FocusPulseHeatmap onSelectDate={() => onOpenView("history")} />
      </div>

      <div className="workspace-two-column mt-6">
        <Panel>
          <div className="panel-heading">
            <div>
              <span className="workspace-eyebrow">When it happens</span>
              <h2>Active hours</h2>
            </div>
            <Clock3 size={16} />
          </div>
          <div className="bar-list">
            {timeRows.filter((r) => r.count > 0).map((row, index) => (
              <div className="bar-row" key={row.period}>
                <span className="capitalize">{row.period}</span>
                <div>
                  <i
                    style={{
                      width: `${Math.min(100, (row.count / maxCount) * 100)}%`,
                      background: topicColor(row.period, index),
                    }}
                  />
                </div>
                <strong>
                  {row.count} {row.count === 1 ? "event" : "events"}
                  {row.topTopic ? ` (${row.topTopic})` : ""}
                </strong>
              </div>
            ))}
            {!timeRows.some((r) => r.count > 0) && <Empty message="No time pattern yet." />}
          </div>
        </Panel>
        <Panel>
          <div className="panel-heading">
            <div>
              <span className="workspace-eyebrow">Behavioral loops</span>
              <h2>Rabbit holes</h2>
            </div>
            <GitBranch size={16} />
          </div>
          <div className="trace-list">
            {(behavior.rabbit_holes as Array<Record<string, unknown>> || []).slice(0, 8).map((hole, index) => {
              const domTopic = String(hole.dominant_topic || hole.topic || hole.name || "Exploration loop");
              const evCount = hole.event_count || hole.count || "";
              const duration = hole.duration_minutes ? `${Math.round(Number(hole.duration_minutes))}m` : "";
              return (
                <button
                  type="button"
                  key={index}
                  onClick={() => setSelectedHole(hole as RabbitHoleItem)}
                  className="trace-row group w-full text-left transition hover:bg-white/[0.04] cursor-pointer"
                  title="Click to view full rabbit hole session timeline"
                >
                  <span className="trace-number group-hover:text-amber-400 transition">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="group-hover:text-amber-300 transition truncate">{domTopic}</strong>
                      <ChevronRight size={14} className="text-white/30 group-hover:translate-x-0.5 group-hover:text-amber-400 transition shrink-0" />
                    </div>
                    <span>
                      {[
                        evCount ? `${evCount} events` : null,
                        duration ? `${duration} session` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                </button>
              );
            })}
            {!behavior.rabbit_holes?.length && <Empty message="No rabbit holes detected yet." />}
          </div>
        </Panel>
      </div>

      {/* RABBIT HOLE INTERACTIVE DEEP DIVE MODAL */}
      {selectedHole && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-md"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedHole(null);
          }}
        >
          <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0c] shadow-[0_0_60px_rgba(0,0,0,0.85)]">
            {/* Ambient background glow */}
            <div
              className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-44 w-96 rounded-full blur-3xl opacity-25"
              style={{ background: topicColor(selectedHole.dominant_topic || selectedHole.topic || "Exploration") }}
            />

            {/* Header */}
            <div className="relative flex items-start justify-between border-b border-white/[0.08] p-6">
              <div className="flex items-start gap-3.5">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border"
                  style={{
                    borderColor: `${topicColor(selectedHole.dominant_topic || "Exploration")}40`,
                    background: `${topicColor(selectedHole.dominant_topic || "Exploration")}15`,
                    color: topicColor(selectedHole.dominant_topic || "Exploration"),
                  }}
                >
                  <GitBranch size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                      Rabbit Hole Deep Dive
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold border"
                      style={{
                        borderColor: `${topicColor(selectedHole.dominant_topic || "Exploration")}50`,
                        background: `${topicColor(selectedHole.dominant_topic || "Exploration")}20`,
                        color: topicColor(selectedHole.dominant_topic || "Exploration"),
                      }}
                    >
                      {selectedHole.dominant_topic || selectedHole.topic || "Exploration"}
                    </span>
                  </div>
                  <h2 className="mt-1 text-lg font-bold text-white">
                    {selectedHole.dominant_topic || selectedHole.name || "Curiosity Loop"}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/60">
                    <span className="flex items-center gap-1.5 font-medium text-white/80">
                      <Clock3 size={13} className="text-amber-400" />
                      {selectedHole.duration_minutes
                        ? `${Math.round(selectedHole.duration_minutes)} minutes`
                        : "Continuous session"}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1.5 font-medium text-white/80">
                      <Flame size={13} className="text-rose-400" />
                      <NumberTicker value={selectedHole.event_count || selectedHole.count || selectedHole.events?.length || 0} /> traces captured
                    </span>
                    {selectedHole.start && (
                      <>
                        <span>·</span>
                        <span className="text-white/40">
                          {new Date(selectedHole.start).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedHole(null)}
                className="rounded-xl p-2 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Events timeline body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedHole.events && selectedHole.events.length > 0 ? (
                <div className="relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-white/10 space-y-4">
                  {selectedHole.events.map((ev, i) => (
                    <div key={i} className="relative flex items-start gap-3 group">
                      {/* Timeline node */}
                      <div
                        className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-[#0c0c0c] transition group-hover:scale-125"
                        style={{
                          backgroundColor: topicColor(ev.topic || selectedHole.dominant_topic || "Exploration", i),
                        }}
                      />
                      <div className="min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-white/15 hover:bg-white/[0.05]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-white/60">
                            {ev.source}
                          </span>
                          <time className="text-[10px] text-white/40">
                            {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </time>
                        </div>
                        <h4 className="mt-1 text-sm font-medium text-white/90 truncate">
                          {ev.title}
                        </h4>
                        {ev.artist && (
                          <p className="text-xs text-white/50 truncate mt-0.5">{ev.artist}</p>
                        )}
                        {ev.url && (
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300"
                          >
                            Open event link <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 space-y-2">
                  <p className="text-sm text-white/60">
                    This rabbit hole spanned {selectedHole.duration_minutes ? `${Math.round(selectedHole.duration_minutes)} minutes` : "a focused session"} with {selectedHole.event_count || selectedHole.count || 0} events.
                  </p>
                  <p className="text-xs text-white/40">
                    Sequential flow detected in your interest cluster. Re-analyzing or refreshing data updates live event traces.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/[0.06] bg-white/[0.02] px-6 py-3 flex items-center justify-between text-xs text-white/40">
              <span>Clustered by temporal continuity and semantic density</span>
              <button
                onClick={() => setSelectedHole(null)}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function HistoryView({ dashboard, history, historyLoading, onRefresh }: WorkspaceProps) {
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [localHistory, setLocalHistory] = useState<HistoryEvent[]>(history);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearSource, setClearSource] = useState<string>("all");
  const [clearing, setClearing] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    setLocalHistory(history);
  }, [history]);

  const topicMap = useMemo(() => {
    const map = new Map<number | string, string>();
    (dashboard?.assignments || []).forEach((a) => {
      if (a.event_id && a.topic && a.topic !== "Other" && a.topic !== "Unassigned") {
        map.set(a.event_id, a.topic);
      }
    });
    return map;
  }, [dashboard?.assignments]);

  const historyWithTopics = useMemo(() => {
    return localHistory.map((event) => {
      const topic = topicMap.get(event.id) || (event.topic && event.topic !== "Unassigned" ? event.topic : "General Exploration");
      return { ...event, resolvedTopic: topic };
    });
  }, [localHistory, topicMap]);

  // Unique topic list for dropdown
  const uniqueTopics = useMemo(() => {
    const counts = new Map<string, number>();
    historyWithTopics.forEach((e) => {
      counts.set(e.resolvedTopic, (counts.get(e.resolvedTopic) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [historyWithTopics]);

  // Source counts
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = { all: localHistory.length };
    localHistory.forEach((e) => {
      const s = (e.source || "youtube").toLowerCase();
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [localHistory]);

  const filtered = useMemo(() => {
    return historyWithTopics
      .filter((event) => {
        // Source filter
        if (sourceFilter !== "all" && event.source.toLowerCase() !== sourceFilter) {
          return false;
        }
        // Topic filter
        if (topicFilter !== "all" && event.resolvedTopic !== topicFilter) {
          return false;
        }
        // Search query
        if (query) {
          const combined = `${event.title} ${event.artist || ""} ${event.source} ${event.resolvedTopic}`.toLowerCase();
          return combined.includes(query.toLowerCase());
        }
        return true;
      })
      .sort((a, b) => {
        const tA = new Date(a.timestamp).getTime();
        const tB = new Date(b.timestamp).getTime();
        return sortOrder === "desc" ? tB - tA : tA - tB;
      });
  }, [historyWithTopics, sourceFilter, topicFilter, query, sortOrder]);

  function handleExportCsv() {
    if (!filtered.length) return;
    const headers = ["ID", "Timestamp", "Source", "Title", "Artist", "Topic", "URL"];
    const rows = filtered.map((e) => [
      e.id,
      `"${new Date(e.timestamp).toISOString()}"`,
      `"${e.source || ""}"`,
      `"${(e.title || "").replace(/"/g, '""')}"`,
      `"${(e.artist || "").replace(/"/g, '""')}"`,
      `"${(e.resolvedTopic || e.topic || "").replace(/"/g, '""')}"`,
      `"${(e.url || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `drifter_history_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportNotice("Exported CSV successfully!");
    setTimeout(() => setExportNotice(null), 2500);
  }

  function handleExportJson() {
    if (!filtered.length) return;
    const cleanItems = filtered.map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      source: e.source,
      title: e.title,
      artist: e.artist || null,
      topic: e.resolvedTopic || e.topic || "Other",
      url: e.url || null,
    }));
    const blob = new Blob([JSON.stringify(cleanItems, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `drifter_history_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportNotice("Exported JSON successfully!");
    setTimeout(() => setExportNotice(null), 2500);
  }

  async function handleDeleteEvent(eventId: number) {
    if (deletingId) return;
    setDeletingId(eventId);
    try {
      await deleteHistoryEvent(eventId);
      setLocalHistory((prev) => prev.filter((e) => e.id !== eventId));
      onRefresh?.();
    } catch (err) {
      console.error("Failed to delete event", err);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleClearHistory() {
    setClearing(true);
    try {
      const src = clearSource === "all" ? undefined : clearSource;
      await clearHistory(src);
      if (clearSource === "all") {
        setLocalHistory([]);
      } else {
        setLocalHistory((prev) => prev.filter((e) => e.source.toLowerCase() !== clearSource));
      }
      setShowClearModal(false);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to clear history", err);
    } finally {
      setClearing(false);
    }
  }

  return (
    <>
      <ViewIntro
        eyebrow="Raw signal / history"
        title="Every trace behind the map."
        description="Filter, inspect, export, or manage the individual events that shaped your attention topology."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="workspace-action"
              onClick={handleExportCsv}
              disabled={historyLoading || !filtered.length}
              title="Download filtered events as CSV"
            >
              <Download size={13} />
              CSV
            </button>
            <button
              className="workspace-action"
              onClick={handleExportJson}
              disabled={historyLoading || !filtered.length}
              title="Download filtered events as JSON"
            >
              <Download size={13} />
              JSON
            </button>
            {onRefresh && (
              <button
                className="workspace-action"
                onClick={onRefresh}
                disabled={historyLoading}
                title="Reload history events from server"
              >
                <RefreshCw size={13} className={historyLoading ? "animate-spin" : ""} />
                Refresh
              </button>
            )}
            <button
              className="workspace-action text-rose-400 hover:text-rose-300 hover:border-rose-500/40"
              onClick={() => setShowClearModal(true)}
              disabled={historyLoading || !localHistory.length}
              title="Clear imported history"
            >
              <Trash2 size={13} />
              Clear
            </button>
          </div>
        }
      />

      {exportNotice && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-300 animate-in fade-in duration-200">
          <Check size={14} />
          <span>{exportNotice}</span>
        </div>
      )}

      <Panel>
        {/* TOP TOOLBAR: SEARCH & STATS */}
        <div className="history-toolbar">
          <div className="search-box flex-1">
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles, artists, topics, sources..."
            />
          </div>
          <span className="history-count">
            <NumberTicker value={filtered.length} /> of <NumberTicker value={localHistory.length} /> events
          </span>
        </div>

        {/* SECONDARY TOOLBAR: FILTERS & SORTS */}
        <div className="mt-3.5 pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* SOURCE PILLS */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-white/35 font-medium mr-1">Source:</span>
            <button
              onClick={() => setSourceFilter("all")}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition ${
                sourceFilter === "all"
                  ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                  : "border-white/[0.08] bg-white/[0.02] text-white/50 hover:text-white"
              }`}
            >
              All ({sourceCounts.all || 0})
            </button>
            {Object.entries(sourceCounts)
              .filter(([k]) => k !== "all")
              .map(([src, count]) => {
                const isSelected = sourceFilter === src;
                return (
                  <button
                    key={src}
                    onClick={() => setSourceFilter(src)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium capitalize transition ${
                      isSelected
                        ? "border-white/40 bg-white/[0.1] text-white"
                        : "border-white/[0.08] bg-white/[0.02] text-white/50 hover:text-white"
                    }`}
                  >
                    {src} ({count})
                  </button>
                );
              })}
          </div>

          {/* TOPIC SELECT & SORT */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-white/35 font-medium">Topic:</span>
              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className="rounded-lg border border-white/[0.1] bg-[#121216] px-2.5 py-1 text-[11px] text-white/80 focus:outline-none focus:border-amber-400/50"
              >
                <option value="all">All Topics ({uniqueTopics.length})</option>
                {uniqueTopics.map(([tName, tCount]) => (
                  <option key={tName} value={tName}>
                    {tName} ({tCount})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-white/55 hover:text-white transition"
              title="Toggle sort direction"
            >
              <ArrowUpDown size={12} />
              <span>{sortOrder === "desc" ? "Newest First" : "Oldest First"}</span>
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="history-table mt-4">
          <div className="history-table-head">
            <span>Event</span>
            <span>Topic</span>
            <span>Source</span>
            <span>Date</span>
            <span className="text-right">Actions</span>
          </div>

          {historyLoading ? (
            <Empty message="Loading history..." />
          ) : (
            filtered.map((event) => {
              const color = topicColor(event.resolvedTopic);
              const isDeleting = deletingId === event.id;
              return (
                <div className={`history-row ${isDeleting ? "opacity-30 pointer-events-none" : ""}`} key={event.id}>
                  <div>
                    <strong>{event.title}</strong>
                    <span>{event.artist || "Untitled activity"}</span>
                  </div>

                  <span
                    className="topic-pill"
                    style={{
                      color: color,
                      backgroundColor: `${color}1A`,
                      borderColor: `${color}33`,
                    }}
                  >
                    {event.resolvedTopic}
                  </span>

                  <span className="source-label capitalize">{event.source}</span>

                  <time>
                    {new Date(event.timestamp).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>

                  <div className="flex items-center justify-end gap-2">
                    {event.url && (
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-white/40 hover:text-white transition p-1"
                        title="Open source"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      disabled={isDeleting}
                      className="text-white/30 hover:text-rose-400 transition p-1 rounded hover:bg-rose-500/10"
                      title="Delete this event"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {!historyLoading && !filtered.length && (
            <Empty message="No matching events found for the active filters." />
          )}
        </div>
      </Panel>

      <p className="workspace-footnote">
        Showing {filtered.length.toLocaleString()} of {localHistory.length.toLocaleString()} history events categorized across your analyzed topics.
      </p>

      {/* CLEAR HISTORY CONFIRMATION MODAL */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0e0e12] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-400">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Clear History Events</h3>
                <p className="text-xs text-white/45">This action permanently removes traces from your database.</p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/[0.07]">
              <label className="text-xs font-medium text-white/70 block">Select Scope to Clear:</label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setClearSource("all")}
                  className={`rounded-xl border p-2.5 text-center text-xs font-medium transition col-span-4 ${
                    clearSource === "all"
                      ? "border-rose-500/50 bg-rose-500/15 text-rose-200"
                      : "border-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white"
                  }`}
                >
                  All Platforms ({sourceCounts.all || 0})
                </button>
                {(["youtube", "spotify", "github", "steam", "twitter", "browser"] as const).map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setClearSource(src)}
                    className={`rounded-xl border p-2 text-center text-[10px] font-medium capitalize transition ${
                      clearSource === src
                        ? "border-rose-500/50 bg-rose-500/15 text-rose-200"
                        : "border-white/[0.08] bg-white/[0.02] text-white/50 hover:text-white"
                    }`}
                  >
                    {src === "twitter" ? "X / Twitter" : src === "browser" ? "Browser" : src.charAt(0).toUpperCase() + src.slice(1)}<br />
                    <span className="text-white/35">({sourceCounts[src] || 0})</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.07]">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-white/60 hover:text-white hover:bg-white/[0.04] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                disabled={clearing}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition flex items-center gap-1.5"
              >
                {clearing && <RefreshCw size={12} className="animate-spin" />}
                {clearing ? "Clearing..." : "Confirm & Clear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MovementMini({ title, items, icon, tone }: { title: string; items: string[]; icon: ReactNode; tone: string }) {
  return <Panel className={`movement-mini ${tone}`}><div className="mini-heading">{icon}<span>{title}</span></div><div className="mini-items">{items.slice(0, 4).map((item) => <span key={item}>{item}</span>)}{!items.length && <small>Nothing detected yet.</small>}</div></Panel>;
}

function DirectionRow({ label, items, icon }: { label: string; items: string[]; icon: ReactNode }) {
  return <div className="direction-row"><span>{icon}</span><div><strong>{label}</strong><p>{items.slice(0, 3).join(" · ") || "Nothing detected yet."}</p></div></div>;
}

export function PredictionWorkspaceView({ source }: { source?: string }) {
  return <PredictionView source={source} />;
}

export function CorrelationWorkspaceView() {
  return <CorrelationView />;
}

export function DnaWorkspaceView({ source }: { source?: string }) {
  return <InterestDnaCard source={source} />;
}

export function NexusWorkspaceView({ source }: { source?: string }) {
  return <CuriosityNexusView source={source} />;
}


