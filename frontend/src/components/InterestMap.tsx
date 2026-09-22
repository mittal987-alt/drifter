import { useMemo, useState } from "react";
import {
  Compass,
  ExternalLink,
  Layers,
  MapPin,
  Sparkles,
  Video,
  Music,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Filter,
  Eye,
} from "lucide-react";
import type { DashboardData } from "../services/analytics";

export interface InterestPoint {
  event_id: number;
  title: string;
  artist: string | null;
  source: string;
  topic: string;
  cluster: number;
  x: number;
  y: number;
  timestamp: string;
  url?: string | null;
}

interface Props {
  data: DashboardData["visualizations"]["interest_map"];
}

const TOPIC_COLORS = [
  "#8B5CF6", // Electric Violet
  "#06B6D4", // Cyan
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#EC4899", // Pink
  "#3B82F6", // Royal Blue
  "#F43F5E", // Rose
  "#6366F1", // Indigo
  "#14B8A6", // Teal
  "#A855F7", // Purple
];

export function getTopicColor(topic: string, index = 0): string {
  let hash = 0;
  for (let i = 0; i < topic.length; i++) {
    hash = topic.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TOPIC_COLORS[Math.abs(hash + index) % TOPIC_COLORS.length];
}

export default function InterestMap({ data }: Props) {
  const points = useMemo(() => (data?.points || []) as InterestPoint[], [data]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<InterestPoint | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<InterestPoint | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1);

  // Extract unique topics with counts
  const topicStats = useMemo(() => {
    const counts = new Map<string, number>();
    points.forEach((p) => {
      const t = p.topic || "Unknown";
      counts.set(t, (counts.get(t) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([topic, count], idx) => ({
        topic,
        count,
        color: getTopicColor(topic, idx),
      }))
      .sort((a, b) => b.count - a.count);
  }, [points]);

  // Filter points based on selected topic & search
  const filteredPoints = useMemo(() => {
    return points.filter((p) => {
      const matchTopic = !selectedTopic || (p.topic || "Unknown") === selectedTopic;
      const matchQuery =
        !searchQuery ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.artist || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.topic || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchTopic && matchQuery;
    });
  }, [points, selectedTopic, searchQuery]);

  // Normalize 2D points to 10% - 90% canvas coordinate range
  const normalizedPoints = useMemo(() => {
    if (!filteredPoints.length) return [];

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    filteredPoints.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    // Special layout for 1-3 points so they look clean and well-spaced
    if (filteredPoints.length === 1) {
      return [{ ...filteredPoints[0], cx: 50, cy: 50 }];
    }
    if (filteredPoints.length === 2) {
      return [
        { ...filteredPoints[0], cx: 35, cy: 50 },
        { ...filteredPoints[1], cx: 65, cy: 50 },
      ];
    }
    if (filteredPoints.length === 3 && (rangeX < 0.001 || rangeY < 0.001)) {
      return [
        { ...filteredPoints[0], cx: 30, cy: 60 },
        { ...filteredPoints[1], cx: 70, cy: 60 },
        { ...filteredPoints[2], cx: 50, cy: 35 },
      ];
    }

    return filteredPoints.map((p) => {
      const normX = 15 + ((p.x - minX) / rangeX) * 70;
      const normY = 15 + ((p.y - minY) / rangeY) * 70;
      return {
        ...p,
        cx: Math.max(10, Math.min(90, normX)),
        cy: Math.max(10, Math.min(90, normY)),
      };
    });
  }, [filteredPoints]);

  // Topic Centroids for floating cluster labels
  const centroids = useMemo(() => {
    const map = new Map<string, { xSum: number; ySum: number; count: number; color: string }>();
    normalizedPoints.forEach((p, idx) => {
      const t = p.topic || "Unknown";
      if (!map.has(t)) {
        map.set(t, { xSum: 0, ySum: 0, count: 0, color: getTopicColor(t, idx) });
      }
      const entry = map.get(t)!;
      entry.xSum += p.cx;
      entry.ySum += p.cy;
      entry.count += 1;
    });

    return Array.from(map.entries()).map(([topic, val]) => ({
      topic,
      cx: val.xSum / val.count,
      cy: val.ySum / val.count,
      count: val.count,
      color: val.color,
    }));
  }, [normalizedPoints]);

  // Constellation links between points of the same topic
  const constellationLinks = useMemo(() => {
    const links: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> = [];
    const grouped = new Map<string, Array<{ cx: number; cy: number; color: string }>>();

    normalizedPoints.forEach((p, idx) => {
      const t = p.topic || "Unknown";
      if (!grouped.has(t)) grouped.set(t, []);
      grouped.get(t)!.push({ cx: p.cx, cy: p.cy, color: getTopicColor(t, idx) });
    });

    grouped.forEach((pts) => {
      if (pts.length > 1) {
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            links.push({
              x1: pts[i].cx,
              y1: pts[i].cy,
              x2: pts[j].cx,
              y2: pts[j].cy,
              color: pts[i].color,
            });
          }
        }
      }
    });

    return links;
  }, [normalizedPoints]);

  const activeInspectionPoint = selectedPoint || hoveredPoint;

  if (!points.length) {
    return (
      <div className="relative flex h-[480px] w-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-neutral-950/80 p-8 text-center backdrop-blur-xl">
        <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10 text-purple-400">
          <Compass className="h-8 w-8 animate-pulse text-purple-400" />
        </div>
        <h3 className="text-base font-semibold text-white">Interest Topology Initializing</h3>
        <p className="mt-1.5 max-w-sm text-xs text-neutral-400">
          Watch YouTube videos with the Drifter extension or import your history file to generate your live semantic interest constellation.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/90 shadow-2xl backdrop-blur-2xl">
      {/* MAP TOP CONTROLS & FILTER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-black/40 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedTopic(null)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              !selectedTopic
                ? "bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/20"
                : "border border-white/10 bg-white/[0.03] text-neutral-400 hover:border-white/20 hover:text-white"
            }`}
          >
            <Filter size={12} />
            <span>All Interests</span>
            <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.2 text-[10px] text-white">
              {points.length}
            </span>
          </button>

          {topicStats.slice(0, 8).map((stat) => {
            const isSelected = selectedTopic === stat.topic;
            return (
              <button
                key={stat.topic}
                onClick={() => setSelectedTopic(isSelected ? null : stat.topic)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                  isSelected
                    ? "border text-white shadow-sm"
                    : "border border-white/[0.08] bg-white/[0.02] text-neutral-300 hover:border-white/20 hover:bg-white/[0.06]"
                }`}
                style={{
                  borderColor: isSelected ? stat.color : undefined,
                  backgroundColor: isSelected ? `${stat.color}25` : undefined,
                  boxShadow: isSelected ? `0 0 12px ${stat.color}30` : undefined,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: stat.color, boxShadow: `0 0 6px ${stat.color}` }}
                />
                <span className="truncate max-w-[130px]">{stat.topic}</span>
                <span className="text-[10px] text-neutral-400">{stat.count}</span>
              </button>
            );
          })}
        </div>

        {/* SEARCH & ZOOM */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search points..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-36 rounded-lg border border-white/10 bg-white/[0.04] pl-8 pr-3 text-xs text-white placeholder-neutral-500 outline-none transition focus:w-48 focus:border-purple-500/50 focus:bg-black/60"
            />
          </div>

          <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.6, z + 0.15))}
              className="p-1.5 text-neutral-400 hover:text-white transition"
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.15))}
              className="p-1.5 text-neutral-400 hover:text-white transition"
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <button
              onClick={() => {
                setZoomLevel(1);
                setSelectedTopic(null);
                setSearchQuery("");
                setSelectedPoint(null);
              }}
              className="p-1.5 text-neutral-400 hover:text-white transition"
              title="Reset View"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 2D COSMIC MAP CANVAS */}
      <div className="relative h-[480px] w-full select-none overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900/60 via-[#070709] to-[#040406]">
        {/* Subtle grid lines & cosmic ambient particles */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.08),transparent_60%)]" />

        {/* SVG LAYER: Constellations, Links, Centroid rings & Nodes */}
        <svg
          className="absolute inset-0 h-full w-full"
          style={{ transform: `scale(${zoomLevel})`, transition: "transform 200ms ease" }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            {topicStats.map((stat) => (
              <radialGradient
                key={stat.topic}
                id={`glow-${stat.topic.replace(/[^a-zA-Z0-9]/g, "_")}`}
                cx="50%"
                cy="50%"
                r="50%"
              >
                <stop offset="0%" stopColor={stat.color} stopOpacity="0.8" />
                <stop offset="60%" stopColor={stat.color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={stat.color} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>

          {/* Constellation Link Lines */}
          {constellationLinks.map((link, idx) => (
            <line
              key={idx}
              x1={link.x1}
              y1={link.y1}
              x2={link.x2}
              y2={link.y2}
              stroke={link.color}
              strokeWidth="0.3"
              strokeDasharray="0.8 0.8"
              opacity="0.35"
            />
          ))}

          {/* Centroid Cluster Halos */}
          {centroids.map((c) => (
            <g key={c.topic} className="pointer-events-none">
              <circle
                cx={c.cx}
                cy={c.cy}
                r="8"
                fill={`url(#glow-${c.topic.replace(/[^a-zA-Z0-9]/g, "_")})`}
                opacity="0.6"
              />
              <circle
                cx={c.cx}
                cy={c.cy}
                r="5"
                fill="none"
                stroke={c.color}
                strokeWidth="0.2"
                strokeDasharray="0.6 0.6"
                opacity="0.4"
              />
            </g>
          ))}

          {/* Interactive Point Nodes */}
          {normalizedPoints.map((point, idx) => {
            const color = getTopicColor(point.topic, idx);
            const isHovered = hoveredPoint?.event_id === point.event_id;
            const isSelected = selectedPoint?.event_id === point.event_id;

            return (
              <g
                key={point.event_id || idx}
                className="cursor-pointer transition-transform duration-200"
                onClick={() => setSelectedPoint(point)}
                onMouseEnter={() => setHoveredPoint(point)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                {/* Outer Glow Halo */}
                {(isHovered || isSelected) && (
                  <circle
                    cx={point.cx}
                    cy={point.cy}
                    r="4.5"
                    fill={color}
                    opacity="0.3"
                    className="animate-pulse"
                  />
                )}

                {/* Outer Ring */}
                <circle
                  cx={point.cx}
                  cy={point.cy}
                  r={isHovered || isSelected ? "2.5" : "1.8"}
                  fill={color}
                  opacity={isHovered || isSelected ? "0.9" : "0.75"}
                  stroke="#ffffff"
                  strokeWidth={isHovered || isSelected ? "0.4" : "0.2"}
                />

                {/* Central Bright Core */}
                <circle cx={point.cx} cy={point.cy} r="0.8" fill="#ffffff" />
              </g>
            );
          })}
        </svg>

        {/* Centroid Text Labels in Overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ transform: `scale(${zoomLevel})`, transition: "transform 200ms ease" }}
        >
          {centroids.map((c) => (
            <div
              key={c.topic}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
              style={{ left: `${c.cx}%`, top: `${c.cy - 5}%` }}
            >
              <div
                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/90 shadow-lg backdrop-blur-md"
                style={{ backgroundColor: `${c.color}25`, borderColor: `${c.color}50` }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                <span>{c.topic}</span>
              </div>
            </div>
          ))}
        </div>

        {/* FLOATING POINT DETAILS INSPECTION CARD */}
        {activeInspectionPoint && (
          <div
            className="absolute bottom-4 left-4 right-4 z-20 flex max-w-lg items-center justify-between gap-4 rounded-xl border border-white/15 bg-black/85 p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200 sm:left-6"
            style={{
              borderColor: `${getTopicColor(activeInspectionPoint.topic)}40`,
              boxShadow: `0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px ${getTopicColor(activeInspectionPoint.topic)}20`,
            }}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10"
                style={{
                  backgroundColor: `${getTopicColor(activeInspectionPoint.topic)}20`,
                  color: getTopicColor(activeInspectionPoint.topic),
                }}
              >
                {activeInspectionPoint.source === "spotify" ? <Music size={16} /> : <Video size={16} />}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-semibold"
                    style={{
                      backgroundColor: `${getTopicColor(activeInspectionPoint.topic)}25`,
                      color: getTopicColor(activeInspectionPoint.topic),
                    }}
                  >
                    {activeInspectionPoint.topic}
                  </span>
                  <span className="text-[10px] text-neutral-400 capitalize">
                    {activeInspectionPoint.source}
                  </span>
                  {activeInspectionPoint.timestamp && (
                    <span className="text-[10px] text-neutral-500">
                      {new Date(activeInspectionPoint.timestamp).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>

                <h4 className="mt-1 truncate text-xs font-semibold text-white">
                  {activeInspectionPoint.title}
                </h4>
                {activeInspectionPoint.artist && (
                  <p className="truncate text-[11px] text-neutral-400">
                    {activeInspectionPoint.artist}
                  </p>
                )}
              </div>
            </div>

            {activeInspectionPoint.url && (
              <a
                href={activeInspectionPoint.url}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-white/[0.12]"
              >
                <span>Open</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}

        {/* BOTTOM RIGHT FLOATING MAP LEGEND */}
        <div className="absolute right-4 top-4 z-10 hidden sm:flex items-center gap-2 rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] text-neutral-300 backdrop-blur-md">
          <Sparkles size={12} className="text-purple-400" />
          <span>{normalizedPoints.length} points plotted in semantic space</span>
        </div>
      </div>
    </div>
  );
}