import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  ExternalLink,
  Filter,
  GitBranch,
  History,
  Map,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
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
import { useMemo, useState } from "react";
import type { ReactNode } from "react";


import InterestMap from "@/components/InterestMap";
import InterestMomentum from "@/components/analytics/InterestMomentum";
import InterestEvolution from "@/components/analytics/InterestEvolution";
import TopicDistribution from "@/components/analytics/TopicDistribution";
import PredictionView from "@/components/prediction/PredictionView";
import CorrelationView from "@/components/analytics/CorrelationView";
import InterestDnaCard from "@/components/reports/InterestDnaCard";
import type { DashboardData } from "@/services/analytics";
import type { HistoryEvent } from "@/services/history";


export type WorkspaceView =
  | "overview"
  | "map"
  | "evolution"
  | "behavior"
  | "history"
  | "prediction"
  | "correlation"
  | "dna";

import { RefreshCw } from "lucide-react";

interface WorkspaceProps {
  dashboard: DashboardData;
  history: HistoryEvent[];
  historyLoading: boolean;
  onOpenView: (view: WorkspaceView) => void;
  onRefresh?: () => void;
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

export function OverviewView({ dashboard, onOpenView, onRefresh }: WorkspaceProps) {
  const overview = dashboard.overview;
  const assignments = assignmentsOf(dashboard);
  const latest = assignments.slice(-5).reverse();
  const dominant = overview.dominant_topic || "No dominant topic yet";
  const eventCount = typeof overview.events === "number" ? overview.events : Array.isArray(overview.events) ? (overview.events as unknown[]).length : Number(overview.events) || assignments.length;

  return (
    <>
      <ViewIntro
        eyebrow="Personal signal / overview"
        title="Your attention has a shape."
        description="A living readout of what you explore, how it connects, and where it is moving next."
        action={
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button className="workspace-action" onClick={onRefresh} title="Re-cluster with clean topic labels">
                <RefreshCw size={14} /> Re-analyze Topics
              </button>
            )}
            <button className="workspace-action" onClick={() => onOpenView("map")}><Map size={15} /> Open map</button>
          </div>
        }
      />


      <div className="signal-grid">
        <div className="signal-card signal-card-featured">
          <span className="signal-label">Current center of gravity</span>
          <strong>{dominant}</strong>
          <p>{eventCount.toLocaleString()} events across {overview.topics} discovered topics.</p>
          <button onClick={() => onOpenView("map")} className="text-action">Explore the cluster <ArrowUpRight size={14} /></button>
        </div>
        <div className="signal-card">
          <span className="signal-label">Latest drift</span>
          <strong>{overview.current_drift.toFixed(3)}</strong>
          <p>Change in your interest distribution over the latest period.</p>
        </div>
        <div className="signal-card">
          <span className="signal-label">New directions</span>
          <strong>{dashboard.evolution.emerging.length}</strong>
          <p>Emerging interests detected in your recent history.</p>
        </div>
      </div>

      <div className="workspace-two-column">
        <Panel>
          <div className="panel-heading"><div><span className="workspace-eyebrow">Most explored</span><h2>Topic landscape</h2></div><button className="icon-action" title="Open interest map" onClick={() => onOpenView("map")}><Map size={16} /></button></div>
          <TopicList topics={dashboard.top_topics} onSelect={() => onOpenView("map")} />
        </Panel>
        <Panel>
          <div className="panel-heading"><div><span className="workspace-eyebrow">Recent traces</span><h2>Latest activity</h2></div><button className="icon-action" title="Open history" onClick={() => onOpenView("history")}><History size={16} /></button></div>
          <div className="trace-list">
            {latest.map((event) => <div className="trace-row" key={event.event_id}><span className="trace-dot" style={{ background: topicColor(event.topic) }} /><div><strong>{event.title}</strong><span>{event.topic} · {event.source}</span></div><time>{new Date(event.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></div>)}
            {!latest.length && <Empty message="Import history to reveal your traces." />}
          </div>
        </Panel>
      </div>

      <div className="mt-6 space-y-6">
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
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const interestMap = dashboard.visualizations.interest_map;
  const points = interestMap.points;
  const topics = [...new Set(points.map((point) => point.topic || "Unknown"))];
  const filteredPoints = selectedTopic ? points.filter((point) => (point.topic || "Unknown") === selectedTopic) : points;
  const mapData: typeof interestMap = { ...interestMap, points: filteredPoints };

  return (
    <>
      <ViewIntro eyebrow="Spatial index / interest map" title="Where your attention lives." description="Nearby points share a semantic neighborhood. Select a topic to isolate one thread of your curiosity." action={<button className="workspace-action" onClick={() => onOpenView("history")}><History size={15} /> Browse events</button>} />
      <Panel className="map-workspace-panel">
        <div className="map-toolbar"><div className="map-toolbar-title"><Map size={17} /><span>{selectedTopic || "All interests"}</span><small>{filteredPoints.length} points</small></div><div className="topic-filters"><button className={!selectedTopic ? "active" : ""} onClick={() => setSelectedTopic(null)}><Filter size={13} /> All</button>{topics.slice(0, 10).map((topic, index) => <button key={topic} className={selectedTopic === topic ? "active" : ""} onClick={() => setSelectedTopic(topic)}><i style={{ background: topicColor(topic, index) }} />{topic}</button>)}</div></div>
        <div className="full-map"><InterestMap data={mapData} /></div>
      </Panel>
      <div className="workspace-three-column"><MovementMini title="Rising" items={dashboard.evolution.rising.map((i) => i.topic)} icon={<TrendingUp size={16} />} tone="positive" /><MovementMini title="Fading" items={dashboard.evolution.fading.map((i) => i.topic)} icon={<TrendingDown size={16} />} tone="muted" /><MovementMini title="Emerging" items={dashboard.evolution.emerging.map((i) => i.topic)} icon={<Sparkles size={16} />} tone="warm" /></div>
    </>
  );
}

export function EvolutionView({ dashboard, onOpenView }: WorkspaceProps) {
  const chartData = Object.entries(dashboard.evolution.monthly_drift).map(([month, drift]) => ({ month, drift }));
  const momentumByTopic = dashboard.evolution.momentum;
  const momentum = Object.entries(momentumByTopic).flatMap(([topic, values]) => Object.entries(values).map(([month, value]) => ({ topic, month, value })));
  const topicMomentum = [...new Set(momentum.map((item) => item.topic))].slice(0, 5);
  return (
    <>
      <ViewIntro eyebrow="Temporal signal / evolution" title="Your interests are in motion." description="Trace the moments when one curiosity gave way to another." action={<button className="workspace-action" onClick={() => onOpenView("map")}><Map size={15} /> See the map</button>} />
      <InterestEvolution monthlyProportions={dashboard.evolution.monthly_proportions} />
      <Panel className="chart-panel mt-6"><div className="panel-heading"><div><span className="workspace-eyebrow">Monthly movement</span><h2>Interest drift</h2></div><strong className="panel-stat">{dashboard.overview.current_drift.toFixed(3)}</strong></div><div className="large-chart">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="workspaceDrift" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2b56b" stopOpacity={0.34} /><stop offset="100%" stopColor="#f2b56b" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(255,255,255,0.07)" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,.4)", fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,.4)", fontSize: 11 }} /><Tooltip contentStyle={{ background: "#151512", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, color: "#fff" }} /><Area type="monotone" dataKey="drift" stroke="#f2b56b" fill="url(#workspaceDrift)" strokeWidth={2} /></AreaChart></ResponsiveContainer> : <Empty message="Import more history to see change over time." />}</div></Panel>
      <div className="workspace-two-column mt-6"><Panel><div className="panel-heading"><div><span className="workspace-eyebrow">Momentum</span><h2>Fastest-moving topics</h2></div><Activity size={16} /></div><div className="momentum-list">{topicMomentum.map((topic, index) => { const values = momentum.filter((item) => item.topic === topic); const latest = values[values.length - 1]?.value || 0; return <div className="momentum-row" key={topic}><i style={{ background: topicColor(topic, index) }} /><span>{topic}</span><strong className={latest >= 0 ? "positive" : "negative"}>{latest >= 0 ? "+" : ""}{latest.toFixed(2)}</strong></div>; })}</div></Panel><Panel><div className="panel-heading"><div><span className="workspace-eyebrow">Direction</span><h2>What is changing</h2></div><CalendarDays size={16} /></div><div className="direction-stack"><DirectionRow label="Rising" items={dashboard.evolution.rising.map((i) => i.topic)} icon={<ArrowUpRight size={15} />} /><DirectionRow label="Fading" items={dashboard.evolution.fading.map((i) => i.topic)} icon={<ArrowDownRight size={15} />} /><DirectionRow label="Emerging" items={dashboard.evolution.emerging.map((i) => i.topic)} icon={<Sparkles size={15} />} /></div></Panel></div>
    </>
  );
}


export function BehaviorView({ dashboard, onOpenView }: WorkspaceProps) {
  const behavior = dashboard.behavior;
  const timeRows = Object.entries(behavior.time_of_day).sort(([, a], [, b]) => b - a);
  return (
    <>
      <ViewIntro eyebrow="Behavioral signal / patterns" title="How you explore." description="Your habits are part of the map too: loops, transitions, and the hours when curiosity is most active." action={<button className="workspace-action" onClick={() => onOpenView("history")}><History size={15} /> Inspect history</button>} />
      <div className="signal-grid"><div className="signal-card"><span className="signal-label">Rabbit holes</span><strong>{behavior.rabbit_holes.length}</strong><p>Deep sessions where one thread kept pulling you onward.</p></div><div className="signal-card"><span className="signal-label">Topic transitions</span><strong>{behavior.topic_transitions.length}</strong><p>Moves between different interest neighborhoods.</p></div><div className="signal-card"><span className="signal-label">Concentration</span><strong>{Object.keys(behavior.interest_concentration).length}</strong><p>Measured dimensions of how focused your activity is.</p></div></div>
      <div className="workspace-two-column"><Panel><div className="panel-heading"><div><span className="workspace-eyebrow">When it happens</span><h2>Active hours</h2></div><Clock3 size={16} /></div><div className="bar-list">{timeRows.map(([label, value], index) => <div className="bar-row" key={label}><span>{label}</span><div><i style={{ width: `${Math.min(100, value * 100)}%`, background: topicColor(label, index) }} /></div><strong>{typeof value === "number" ? value.toFixed(2) : value}</strong></div>)}{!timeRows.length && <Empty message="No time pattern yet." />}</div></Panel><Panel><div className="panel-heading"><div><span className="workspace-eyebrow">Behavioral loops</span><h2>Rabbit holes</h2></div><GitBranch size={16} /></div><div className="trace-list">{(behavior.rabbit_holes as Array<Record<string, unknown>>).slice(0, 8).map((hole, index) => <div className="trace-row" key={index}><span className="trace-number">{index + 1}</span><div><strong>{String(hole.topic || hole.name || "Exploration loop")}</strong><span>{Object.entries(hole).slice(0, 2).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}</span></div></div>)}{!behavior.rabbit_holes.length && <Empty message="No rabbit holes detected yet." />}</div></Panel></div>
    </>
  );
}

export function HistoryView({ dashboard, history, historyLoading }: WorkspaceProps) {
  const [query, setQuery] = useState("");

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
    return history.map((event) => {
      const topic = topicMap.get(event.id) || (event.topic && event.topic !== "Unassigned" ? event.topic : "General Exploration");
      return { ...event, resolvedTopic: topic };
    });
  }, [history, topicMap]);

  const filtered = useMemo(() => {
    return historyWithTopics.filter((event) =>
      `${event.title} ${event.artist || ""} ${event.source} ${event.resolvedTopic}`
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  }, [historyWithTopics, query]);

  return (
    <>
      <ViewIntro
        eyebrow="Raw signal / history"
        title="Every trace behind the map."
        description="Search the events that shaped your analysis, then follow them back to their source."
      />
      <Panel>
        <div className="history-toolbar">
          <div className="search-box">
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles, artists, topics, sources..."
            />
          </div>
          <span className="history-count">{filtered.length} events</span>
        </div>

        <div className="history-table">
          <div className="history-table-head">
            <span>Event</span>
            <span>Topic</span>
            <span>Source</span>
            <span>Date</span>
          </div>

          {historyLoading ? (
            <Empty message="Loading history..." />
          ) : (
            filtered.map((event) => {
              const color = topicColor(event.resolvedTopic);
              return (
                <div className="history-row" key={event.id}>
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

                  {event.url && (
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noreferrer"
                      title="Open source"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              );
            })
          )}

          {!historyLoading && !filtered.length && (
            <Empty message="No matching events." />
          )}
        </div>
      </Panel>

      <p className="workspace-footnote">
        Showing {historyWithTopics.length.toLocaleString()} history events categorized across your analyzed topics.
      </p>
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

