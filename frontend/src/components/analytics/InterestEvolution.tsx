import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MagicCard } from "@/components/ui/magic-card";
import { Activity, Filter, Sparkles } from "lucide-react";

interface InterestEvolutionProps {
  monthlyProportions: {
    [month: string]: {
      [topic: string]: number;
    };
  };
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
];

function getTopicColor(topic: string, index = 0): string {
  let hash = 0;
  for (let i = 0; i < topic.length; i++) {
    hash = topic.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TOPIC_COLORS[Math.abs(hash + index) % TOPIC_COLORS.length];
}

export default function InterestEvolution({
  monthlyProportions,
}: InterestEvolutionProps) {
  const safeProportions = useMemo(() => monthlyProportions || {}, [monthlyProportions]);
  const months = useMemo(() => Object.keys(safeProportions).sort(), [safeProportions]);

  // Aggregate topics across all months to find top 7 + group rest into "Other"
  const { topTopics, chartData, topicColors } = useMemo(() => {
    if (!months.length) {
      return { topTopics: [], chartData: [], topicColors: {} as Record<string, string> };
    }

    // Accumulate total scores per topic
    const topicTotals: Record<string, number> = {};
    months.forEach((month) => {
      const monthData = safeProportions[month] || {};
      Object.entries(monthData).forEach(([topic, score]) => {
        topicTotals[topic] = (topicTotals[topic] || 0) + score;
      });
    });

    const sortedTopics = Object.keys(topicTotals).sort(
      (a, b) => topicTotals[b] - topicTotals[a]
    );

    // Keep top 7 topics, collapse remaining into "Other"
    const MAX_PRIMARY_TOPICS = 7;
    const primaryTopics = sortedTopics.slice(0, MAX_PRIMARY_TOPICS);
    const secondaryTopics = sortedTopics.slice(MAX_PRIMARY_TOPICS);
    const hasOther = secondaryTopics.length > 0;

    const finalTopics = hasOther ? [...primaryTopics, "Other"] : primaryTopics;

    // Assign colors
    const colors: Record<string, string> = {};
    finalTopics.forEach((t, idx) => {
      colors[t] = t === "Other" ? "#9CA3AF" : getTopicColor(t, idx);
    });

    // Build normalized rows per month
    const rows = months.map((month) => {
      const monthData = safeProportions[month] || {};
      const row: Record<string, string | number> = { month };

      let otherSum = 0;
      Object.entries(monthData).forEach(([topic, score]) => {
        if (primaryTopics.includes(topic)) {
          row[topic] = Number((score * 100).toFixed(1));
        } else {
          otherSum += score;
        }
      });

      if (hasOther) {
        row["Other"] = Number((otherSum * 100).toFixed(1));
      }

      // Ensure all finalTopics have a numeric value
      finalTopics.forEach((t) => {
        if (row[t] === undefined) row[t] = 0;
      });

      return row;
    });

    return { topTopics: finalTopics, chartData: rows, topicColors: colors };
  }, [safeProportions, months]);

  // Topic visibility toggles
  const [activeTopics, setActiveTopics] = useState<Set<string>>(
    () => new Set(topTopics)
  );

  // Sync active topics when topTopics change
  useMemo(() => {
    setActiveTopics(new Set(topTopics));
  }, [topTopics]);

  const toggleTopic = (topic: string) => {
    setActiveTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) {
        if (next.size > 1) next.delete(topic); // keep at least 1 active
      } else {
        next.add(topic);
      }
      return next;
    });
  };

  return (
    <MagicCard className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6 shadow-2xl transition-all duration-300">
      {/* CARD HEADER & TOPIC PILL TOGGLES */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold text-white tracking-wide">
              Interest Evolution
            </h3>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            How your core attention shifted and transformed over time
          </p>
        </div>

        {topTopics.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-neutral-400 mr-1 flex items-center gap-1">
              <Filter size={11} /> Filter:
            </span>
            {topTopics.map((topic) => {
              const color = topicColors[topic];
              const isActive = activeTopics.has(topic);
              return (
                <button
                  key={topic}
                  onClick={() => toggleTopic(topic)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                    isActive
                      ? "border text-white shadow-sm"
                      : "border border-white/10 bg-white/[0.02] text-neutral-500 hover:text-neutral-300"
                  }`}
                  style={{
                    borderColor: isActive ? color : undefined,
                    backgroundColor: isActive ? `${color}20` : undefined,
                    boxShadow: isActive ? `0 0 10px ${color}25` : undefined,
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full transition-opacity"
                    style={{
                      backgroundColor: color,
                      opacity: isActive ? 1 : 0.4,
                      boxShadow: isActive ? `0 0 6px ${color}` : "none",
                    }}
                  />
                  <span className="truncate max-w-[120px]">{topic}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* CHART CANVAS */}
      <div className="h-[360px] w-full relative">
        {chartData.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-sm text-neutral-400 border border-dashed border-white/10 rounded-xl bg-neutral-900/30 p-6 text-center">
            <Sparkles className="w-8 h-8 text-purple-400/50 mb-2 animate-pulse" />
            <span>Not enough history across multiple months to display evolution.</span>
            <span className="text-xs text-neutral-500 mt-1">
              Import or track activity across several weeks to reveal your temporal trajectory.
            </span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                {topTopics.map((topic) => {
                  const color = topicColors[topic];
                  const cleanId = `evoGradient-${topic.replace(/[^a-zA-Z0-9]/g, "_")}`;
                  return (
                    <linearGradient key={topic} id={cleanId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.65} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.15} />
                    </linearGradient>
                  );
                })}
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />

              <XAxis
                dataKey="month"
                stroke="#737373"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                stroke="#737373"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-xl border border-white/15 bg-neutral-950/95 backdrop-blur-xl p-3 shadow-2xl space-y-2 min-w-[180px]">
                        <div className="border-b border-white/10 pb-1.5 flex items-center justify-between">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            {label}
                          </span>
                          <span className="text-[10px] text-neutral-400">Monthly Share</span>
                        </div>

                        <div className="space-y-1">
                          {payload.map((entry) => {
                            if (!entry.dataKey) return null;
                            const topicName = String(entry.dataKey);
                            if (!activeTopics.has(topicName)) return null;
                            const color = topicColors[topicName] || entry.color;
                            return (
                              <div
                                key={topicName}
                                className="flex items-center justify-between text-xs gap-3"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span className="text-neutral-300 font-medium truncate max-w-[110px]">
                                    {topicName}
                                  </span>
                                </div>
                                <span className="font-bold text-white">
                                  {entry.value}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {topTopics.map((topic) => {
                if (!activeTopics.has(topic)) return null;
                const color = topicColors[topic];
                const cleanId = `evoGradient-${topic.replace(/[^a-zA-Z0-9]/g, "_")}`;
                return (
                  <Area
                    key={topic}
                    type="monotone"
                    dataKey={topic}
                    stackId="1"
                    stroke={color}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={`url(#${cleanId})`}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* CUSTOM LEGEND SUMMARY BAR BELOW CHART */}
      {topTopics.length > 0 && chartData.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            {topTopics.map((topic) => {
              const color = topicColors[topic];
              const isActive = activeTopics.has(topic);
              return (
                <div
                  key={topic}
                  onClick={() => toggleTopic(topic)}
                  className={`flex items-center gap-2 cursor-pointer transition-opacity ${
                    isActive ? "opacity-100" : "opacity-40 hover:opacity-75"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
                  />
                  <span className="font-semibold text-neutral-300 hover:text-white">
                    {topic}
                  </span>
                </div>
              );
            })}
          </div>

          <span className="text-[11px] text-neutral-500">
            {months.length} {months.length === 1 ? "month" : "months"} tracked
          </span>
        </div>
      )}
    </MagicCard>
  );
}