import { useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Calendar,
  ChevronRight,
  ExternalLink,
  Flame,
  History,
  TrendingDown,
  TrendingUp,
  X,
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
import { MagicCard } from "@/components/ui/magic-card";

interface Assignment {
  event_id: number;
  timestamp: string;
  source: string;
  title: string;
  artist?: string | null;
  cluster?: number;
  topic: string;
  url?: string | null;
}

interface Change {
  topic: string;
  change: number;
}

interface InterestMomentumProps {
  rising: Change[];
  fading: Change[];
  assignments?: Assignment[];
}

export default function InterestMomentum({
  rising,
  fading,
  assignments = [],
}: InterestMomentumProps) {
  const [selectedItem, setSelectedItem] = useState<{
    topic: string;
    change: number;
    type: "rising" | "fading";
  } | null>(null);

  // Filter assignments matching the selected topic
  const topicAssignments = useMemo(() => {
    if (!selectedItem || !assignments.length) return [];
    return assignments.filter(
      (a) => a.topic.toLowerCase() === selectedItem.topic.toLowerCase()
    );
  }, [selectedItem, assignments]);

  // Aggregate daily counts for the daily trend chart
  const dailyData = useMemo(() => {
    if (!topicAssignments.length) return [];

    const dateMap: Record<
      string,
      { rawDate: string; date: string; count: number }
    > = {};

    topicAssignments.forEach((item) => {
      const d = new Date(item.timestamp);
      if (isNaN(d.getTime())) return;
      const rawDate = d.toISOString().split("T")[0];
      const formattedDate = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });

      if (!dateMap[rawDate]) {
        dateMap[rawDate] = {
          rawDate,
          date: formattedDate,
          count: 0,
        };
      }
      dateMap[rawDate].count += 1;
    });

    return Object.values(dateMap).sort((a, b) =>
      a.rawDate.localeCompare(b.rawDate)
    );
  }, [topicAssignments]);

  const activeDays = dailyData.length;
  const peakDailyCount = useMemo(() => {
    return dailyData.reduce((max, curr) => (curr.count > max ? curr.count : max), 0);
  }, [dailyData]);

  const isRising = selectedItem?.type === "rising";
  const themeColor = isRising ? "#10B981" : "#F43F5E"; // Emerald for rising, Rose for fading

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Rising Interests Card */}
        <MagicCard className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6 shadow-xl transition-all duration-300">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-emerald-400 shadow-inner">
                <TrendingUp size={20} />
              </div>

              <div>
                <h3 className="font-bold text-white tracking-wide">
                  Rising Interests
                </h3>
                <p className="text-xs text-neutral-400">
                  Topics gaining momentum over the latest period
                </p>
              </div>
            </div>

            <span className="text-[11px] font-medium text-emerald-400/80 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              Click topic for daily graph
            </span>
          </div>

          <div className="space-y-2.5">
            {rising.length === 0 ? (
              <p className="text-sm text-neutral-400 py-4 text-center border border-dashed border-white/10 rounded-xl">
                No significant rising interests detected yet.
              </p>
            ) : (
              rising.slice(0, 6).map((item) => (
                <button
                  key={item.topic}
                  onClick={() =>
                    setSelectedItem({
                      topic: item.topic,
                      change: item.change,
                      type: "rising",
                    })
                  }
                  className="group w-full flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 text-left transition-all duration-200 hover:border-emerald-500/30 hover:bg-emerald-500/[0.06] hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)] transition-transform duration-200 group-hover:scale-125" />
                    <span className="text-sm font-semibold text-neutral-200 group-hover:text-white">
                      {item.topic}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      +{(item.change * 100).toFixed(1)}%
                    </span>
                    <ChevronRight
                      size={15}
                      className="text-neutral-500 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-emerald-400"
                    />
                  </div>
                </button>
              ))
            )}
          </div>
        </MagicCard>

        {/* Fading Interests Card */}
        <MagicCard className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6 shadow-xl transition-all duration-300">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-rose-400 shadow-inner">
                <TrendingDown size={20} />
              </div>

              <div>
                <h3 className="font-bold text-white tracking-wide">
                  Fading Interests
                </h3>
                <p className="text-xs text-neutral-400">
                  Topics losing momentum over the latest period
                </p>
              </div>
            </div>

            <span className="text-[11px] font-medium text-rose-400/80 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
              Click topic for daily graph
            </span>
          </div>

          <div className="space-y-2.5">
            {fading.length === 0 ? (
              <p className="text-sm text-neutral-400 py-4 text-center border border-dashed border-white/10 rounded-xl">
                No significant fading interests detected yet.
              </p>
            ) : (
              fading.slice(0, 6).map((item) => (
                <button
                  key={item.topic}
                  onClick={() =>
                    setSelectedItem({
                      topic: item.topic,
                      change: item.change,
                      type: "fading",
                    })
                  }
                  className="group w-full flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 text-left transition-all duration-200 hover:border-rose-500/30 hover:bg-rose-500/[0.06] hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)] transition-transform duration-200 group-hover:scale-125" />
                    <span className="text-sm font-semibold text-neutral-200 group-hover:text-white">
                      {item.topic}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                      {(item.change * 100).toFixed(1)}%
                    </span>
                    <ChevronRight
                      size={15}
                      className="text-neutral-500 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-rose-400"
                    />
                  </div>
                </button>
              ))
            )}
          </div>
        </MagicCard>
      </div>

      {/* Detail Modal with Daily Graph */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/15 bg-neutral-950/95 p-6 md:p-8 shadow-2xl space-y-6 custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-3 w-3 rounded-full"
                    style={{ backgroundColor: themeColor, boxShadow: `0 0 10px ${themeColor}` }}
                  />
                  <h2 className="text-xl font-bold text-white tracking-wide">
                    {selectedItem.topic}
                  </h2>

                  <span
                    className="text-xs font-bold px-3 py-1 rounded-full border"
                    style={{
                      color: themeColor,
                      backgroundColor: `${themeColor}1A`,
                      borderColor: `${themeColor}33`,
                    }}
                  >
                    {isRising ? "Rising +" : "Fading "}
                    {(selectedItem.change * 100).toFixed(1)}%
                  </span>
                </div>

                <p className="text-xs text-neutral-400 mt-1">
                  Daily curiosity timeline & event trajectory
                </p>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="rounded-full p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Topic Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">
                  Total Traces
                </span>
                <span className="text-lg font-bold text-white mt-1 block">
                  {topicAssignments.length}
                </span>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">
                  Active Days
                </span>
                <span className="text-lg font-bold text-white mt-1 block">
                  {activeDays}
                </span>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">
                  Peak Day Count
                </span>
                <span className="text-lg font-bold text-white mt-1 block">
                  {peakDailyCount}
                </span>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">
                  Momentum
                </span>
                <span
                  className="text-lg font-bold mt-1 block"
                  style={{ color: themeColor }}
                >
                  {isRising ? "+" : ""}
                  {(selectedItem.change * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Daily Trend Area Chart */}
            <div className="rounded-2xl border border-white/10 bg-neutral-900/40 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" style={{ color: themeColor }} />
                  <h3 className="text-sm font-semibold text-neutral-200">
                    Daily Activity Graph
                  </h3>
                </div>
                <span className="text-xs text-neutral-500">
                  {dailyData.length} active data points
                </span>
              </div>

              {dailyData.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-sm text-neutral-500">
                  No timestamped daily history for this topic yet.
                </div>
              ) : (
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="topicGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={themeColor} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={themeColor} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="#737373" fontSize={11} tickLine={false} />
                      <YAxis stroke="#737373" fontSize={11} tickLine={false} allowDecimals={false} />

                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const dataPoint = payload[0].payload;
                            return (
                              <div className="rounded-xl border border-white/15 bg-neutral-950/90 backdrop-blur-md p-2.5 shadow-xl">
                                <span className="text-xs font-semibold text-neutral-300 block mb-1">
                                  {dataPoint.date}
                                </span>
                                <span
                                  className="text-xs font-bold"
                                  style={{ color: themeColor }}
                                >
                                  {dataPoint.count} {dataPoint.count === 1 ? "event" : "events"}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />

                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke={themeColor}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#topicGradient)"
                        dot={{ r: 3, fill: themeColor, strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: themeColor, stroke: "#ffffff", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Daily Traces / Event History */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-300 text-sm font-semibold">
                  <History size={16} className="text-purple-400" />
                  <span>Events Traced for "{selectedItem.topic}"</span>
                </div>
                <span className="text-xs text-neutral-500">
                  {topicAssignments.length} total
                </span>
              </div>

              <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {topicAssignments.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-3 text-center">
                    No individual events found for this topic.
                  </p>
                ) : (
                  topicAssignments.map((event) => (
                    <div
                      key={event.event_id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-neutral-200 truncate">
                          {event.title}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                          {event.artist && <span>{event.artist} · </span>}
                          <span className="capitalize px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300">
                            {event.source}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <time className="text-[11px] text-neutral-500">
                          {new Date(event.timestamp).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </time>

                        {event.url && (
                          <a
                            href={event.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-neutral-400 hover:text-white transition-colors"
                          >
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}