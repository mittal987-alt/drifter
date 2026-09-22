import { useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { MagicCard } from "@/components/ui/magic-card";
import { PieChart as PieIcon, Sparkles } from "lucide-react";

interface TopicDistributionProps {
  topics: {
    topic: string;
    count: number;
    share?: number;
  }[];
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

export default function TopicDistribution({
  topics = [],
}: TopicDistributionProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const safeTopics = Array.isArray(topics) ? topics : [];
  const totalCount = safeTopics.reduce((acc, curr) => acc + (curr?.count || 0), 0);

  const data = safeTopics.map((item, idx) => {
    const share = item.share ?? (totalCount > 0 ? (item.count / totalCount) * 100 : 0);
    const color = getTopicColor(item.topic || "Unknown", idx);
    return {
      name: item.topic || "Unknown",
      value: item.count || 0,
      share: Number(share.toFixed(1)),
      color,
    };
  });

  const activeItem = activeIndex !== null && data[activeIndex] ? data[activeIndex] : null;

  return (
    <MagicCard className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6 shadow-2xl transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold text-white tracking-wide">
              Interest Distribution
            </h3>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Where your attention and focus are concentrated
          </p>
        </div>

        {totalCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>{topics.length} Categories</span>
          </div>
        )}
      </div>

      {data.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-neutral-400 border border-dashed border-white/10 rounded-xl bg-neutral-900/30">
          No interest data available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Donut Chart with Center Display */}
          <div className="lg:col-span-5 relative h-[250px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={72}
                  outerRadius={102}
                  paddingAngle={3}
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth={2}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {data.map((entry, index) => {
                    const isSelected = activeIndex === index;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        opacity={activeIndex === null || isSelected ? 1 : 0.45}
                        style={{
                          filter: isSelected
                            ? `drop-shadow(0 0 12px ${entry.color}88)`
                            : "none",
                          transition: "all 0.3s ease",
                          cursor: "pointer",
                        }}
                      />
                    );
                  })}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Center Stat inside Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4 z-10 select-none">
              {activeItem ? (
                <div className="animate-in fade-in duration-150 flex flex-col items-center">
                  <span
                    className="text-2xl font-black tracking-tight drop-shadow-md"
                    style={{ color: activeItem.color }}
                  >
                    {activeItem.share}%
                  </span>
                  <span className="text-xs font-semibold text-neutral-200 truncate max-w-[120px] mt-0.5">
                    {activeItem.name}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-medium">
                    {activeItem.value} {activeItem.value === 1 ? "event" : "events"}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black text-white tracking-tight">
                    {totalCount}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-neutral-400 mt-0.5">
                    Total Events
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Color-Coded Topic Legend & Share Breakdown */}
          <div className="lg:col-span-7 space-y-2.5 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
            {data.map((item, index) => {
              const isSelected = activeIndex === index;
              return (
                <div
                  key={item.name}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  className={`group flex flex-col gap-1 p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "border-white/30 bg-white/10 shadow-lg scale-[1.01]"
                      : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0 transition-transform duration-200 group-hover:scale-125"
                        style={{
                          backgroundColor: item.color,
                          boxShadow: `0 0 8px ${item.color}66`,
                        }}
                      />
                      <span className="font-semibold text-neutral-200 truncate group-hover:text-white">
                        {item.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-neutral-400 text-[11px]">
                        {item.value} {item.value === 1 ? "event" : "events"}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold"
                        style={{
                          color: item.color,
                          backgroundColor: `${item.color}1A`,
                          border: `1px solid ${item.color}33`,
                        }}
                      >
                        {item.share}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 rounded-full bg-neutral-800/80 overflow-hidden mt-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${item.share}%`,
                        backgroundColor: item.color,
                        boxShadow: `0 0 6px ${item.color}`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </MagicCard>
  );
}