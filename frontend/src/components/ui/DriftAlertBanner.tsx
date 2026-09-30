import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Zap, X, TrendingUp, TrendingDown } from "lucide-react";
import type { DashboardData } from "@/services/analytics";

interface DriftAlert {
  id: string;
  type: "rising" | "fading" | "drift";
  topic: string;
  change: number;
  message: string;
}

const ALERT_THRESHOLD = 0.15; // 15% change triggers an alert
const DRIFT_THRESHOLD = 0.4;  // drift score above 0.4 triggers an alert

function buildAlerts(data: DashboardData): DriftAlert[] {
  const alerts: DriftAlert[] = [];

  // Rising topic alert
  const topRising = data.evolution.rising[0];
  if (topRising && Math.abs(topRising.change) >= ALERT_THRESHOLD) {
    alerts.push({
      id: `rising-${topRising.topic}`,
      type: "rising",
      topic: topRising.topic,
      change: topRising.change,
      message: `"${topRising.topic}" is your fastest-growing interest this period (+${(topRising.change * 100).toFixed(0)}%).`,
    });
  }

  // Fading topic alert
  const topFading = data.evolution.fading[0];
  if (topFading && Math.abs(topFading.change) >= ALERT_THRESHOLD) {
    alerts.push({
      id: `fading-${topFading.topic}`,
      type: "fading",
      topic: topFading.topic,
      change: topFading.change,
      message: `Your interest in "${topFading.topic}" has significantly declined (${(topFading.change * 100).toFixed(0)}%).`,
    });
  }

  // High drift velocity alert
  if (data.overview.current_drift >= DRIFT_THRESHOLD) {
    alerts.push({
      id: "drift-velocity",
      type: "drift",
      topic: "drift",
      change: data.overview.current_drift,
      message: `High drift velocity detected (${data.overview.current_drift.toFixed(2)}). Your interests are shifting rapidly.`,
    });
  }

  return alerts;
}

const DISMISSED_KEY = "drifter_dismissed_alerts";

function getDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

interface DriftAlertBannerProps {
  data: DashboardData;
}

export function DriftAlertBanner({ data }: DriftAlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed);
  const [visible, setVisible] = useState<DriftAlert[]>([]);

  useEffect(() => {
    const all = buildAlerts(data);
    setVisible(all.filter((a) => !dismissed.has(a.id)));
  }, [data, dismissed]);

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      saveDismissed(next);
      return next;
    });
  };

  if (visible.length === 0) return null;

  // Show only the most important alert
  const alert = visible[0];

  const colors = {
    rising: "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300",
    fading: "border-orange-500/20 bg-orange-500/[0.05] text-orange-300",
    drift: "border-purple-500/20 bg-purple-500/[0.05] text-purple-300",
  };

  const icons = {
    rising: <TrendingUp size={14} />,
    fading: <TrendingDown size={14} />,
    drift: <Zap size={14} />,
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={alert.id}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden"
      >
        <div
          className={`mb-4 flex items-center justify-between rounded-xl border px-4 py-2.5 text-xs ${colors[alert.type]}`}
        >
          <div className="flex items-center gap-2">
            {icons[alert.type]}
            <span>{alert.message}</span>
            {visible.length > 1 && (
              <span className="ml-2 rounded-full border border-current/30 bg-current/10 px-2 py-0.5 font-mono">
                +{visible.length - 1} more
              </span>
            )}
          </div>
          <button
            onClick={() => dismiss(alert.id)}
            className="ml-3 shrink-0 rounded-lg p-1 opacity-60 transition hover:opacity-100"
          >
            <X size={13} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
