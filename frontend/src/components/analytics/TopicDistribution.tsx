import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { MagicCard } from "@/components/ui/magic-card";

interface TopicDistributionProps {
  topics: {
    topic: string;
    count: number;
    share?: number;
  }[];
}

export default function TopicDistribution({
  topics,
}: TopicDistributionProps) {
  const data = topics.map((topic) => ({
    name: topic.topic,
    value: topic.count,
  }));

  return (
    <MagicCard className="h-[380px] rounded-2xl p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">
          Interest Distribution
        </h3>

        <p className="text-sm text-muted-foreground">
          Where your attention is concentrated
        </p>
      </div>

      <div className="h-[280px]">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No interest data yet.
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={105}
                paddingAngle={2}
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                  />
                ))}
              </Pie>

              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </MagicCard>
  );
}