import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MagicCard } from "@/components/ui/magic-card";

interface InterestEvolutionProps {
  monthlyProportions: {
    [month: string]: {
      [topic: string]: number;
    };
  };
}

export default function InterestEvolution({
  monthlyProportions,
}: InterestEvolutionProps) {
  const safeProportions = monthlyProportions || {};
  const months = Object.keys(safeProportions).sort();

  const topics = Array.from(
    new Set(
      months.flatMap((month) =>
        Object.keys(safeProportions[month] || {})
      ),
    ),
  );

  const chartData = months.map(
    (month) => {
      const row: Record<
        string,
        string | number
      > = {
        month,
      };

      for (const topic of topics) {
        row[topic] =
          safeProportions[
            month
          ]?.[topic] ?? 0;
      }

      return row;
    },
  );

  return (
    <MagicCard className="rounded-2xl p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold">
          Interest Evolution
        </h3>

        <p className="text-sm text-muted-foreground">
          How your interests changed over time
        </p>
      </div>

      <div className="h-[420px]">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Not enough history to show evolution.
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <AreaChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="month"
              />

              <YAxis
                tickFormatter={(value) =>
                  `${Math.round(
                    value * 100,
                  )}%`
                }
              />

              <Tooltip
                formatter={(value) =>
                  `${(
                    Number(value) * 100
                  ).toFixed(1)}%`
                }
              />

              <Legend />

              {topics.map(
                (topic) => (
                  <Area
                    key={topic}
                    type="monotone"
                    dataKey={topic}
                    stackId="1"
                    fillOpacity={0.65}
                    strokeWidth={2}
                  />
                ),
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </MagicCard>
  );
}