import {
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { MagicCard } from "@/components/ui/magic-card";

interface Change {
  topic: string;
  change: number;
}

interface InterestMomentumProps {
  rising: Change[];
  fading: Change[];
}

export default function InterestMomentum({
  rising,
  fading,
}: InterestMomentumProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">

      {/* Rising */}
      <MagicCard className="rounded-2xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg border p-2">
            <TrendingUp size={18} />
          </div>

          <div>
            <h3 className="font-semibold">
              Rising Interests
            </h3>

            <p className="text-sm text-muted-foreground">
              Topics gaining momentum
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {rising.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No significant rising interests yet.
            </p>
          ) : (
            rising.slice(0, 6).map(
              (item) => (
                <div
                  key={item.topic}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="text-sm font-medium">
                    {item.topic}
                  </span>

                  <span className="text-sm">
                    +
                    {(
                      item.change * 100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              ),
            )
          )}
        </div>
      </MagicCard>

      {/* Fading */}
      <MagicCard className="rounded-2xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg border p-2">
            <TrendingDown size={18} />
          </div>

          <div>
            <h3 className="font-semibold">
              Fading Interests
            </h3>

            <p className="text-sm text-muted-foreground">
              Topics losing momentum
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {fading.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No significant fading interests yet.
            </p>
          ) : (
            fading.slice(0, 6).map(
              (item) => (
                <div
                  key={item.topic}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="text-sm font-medium">
                    {item.topic}
                  </span>

                  <span className="text-sm">
                    {(
                      item.change * 100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              ),
            )
          )}
        </div>
      </MagicCard>

    </div>
  );
}