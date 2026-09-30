import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";

interface ProgressState {
  stage: string;
  progress: number; // 0–100
  active: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  embedding: "Generating embeddings…",
  clustering: "Clustering topics…",
  prediction: "Computing predictions…",
  analysis_done: "Analysis complete ✓",
  analysis_start: "Starting analysis…",
};

export function AnalysisProgressBar() {
  const [prog, setProg] = useState<ProgressState>({
    stage: "",
    progress: 0,
    active: false,
  });

  useWebSocket("/ws/analysis", {
    autoConnect: true,
    onMessage: (msg) => {
      if (msg.type === "analysis_start") {
        setProg({ stage: "analysis_start", progress: 5, active: true });
      } else if (msg.type === "embedding_progress") {
        setProg({
          stage: "embedding",
          progress: Math.min(95, Number(msg.progress) ?? 30),
          active: true,
        });
      } else if (msg.type === "clustering_done") {
        setProg({ stage: "clustering", progress: 75, active: true });
      } else if (msg.type === "prediction_done") {
        setProg({ stage: "prediction", progress: 90, active: true });
      } else if (msg.type === "analysis_done") {
        setProg({ stage: "analysis_done", progress: 100, active: true });
        setTimeout(() => setProg((p) => ({ ...p, active: false })), 2500);
      }
    },
  });

  if (!prog.active) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[500]">
      {/* Slim progress bar */}
      <motion.div
        className="h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-400"
        initial={{ width: "0%" }}
        animate={{ width: `${prog.progress}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      {/* Label pill */}
      <AnimatePresence>
        {prog.stage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-[#0b0b0b]/90 px-3 py-1 text-[11px] text-white/70 backdrop-blur-sm shadow-lg"
          >
            {STAGE_LABELS[prog.stage] ?? prog.stage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
