import { AnimatePresence, motion } from "motion/react";
import {
  CheckCircle2,
  Info,
  TriangleAlert,
  XCircle,
  X,
} from "lucide-react";
import type { Toast } from "@/hooks/useToast";

const ICONS: Record<Toast["type"], React.ReactNode> = {
  success: <CheckCircle2 size={16} className="text-emerald-400" />,
  error: <XCircle size={16} className="text-red-400" />,
  warning: <TriangleAlert size={16} className="text-amber-400" />,
  info: <Info size={16} className="text-blue-400" />,
};

const BORDERS: Record<Toast["type"], string> = {
  success: "border-emerald-500/20 bg-emerald-500/5",
  error: "border-red-500/20 bg-red-500/5",
  warning: "border-amber-500/20 bg-amber-500/5",
  info: "border-blue-500/20 bg-blue-500/5",
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={`pointer-events-auto flex min-w-[280px] max-w-sm items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-2xl backdrop-blur-xl ${BORDERS[t.type]}`}
            style={{ background: "rgba(8, 8, 8, 0.85)" }}
          >
            <span className="mt-0.5 shrink-0">{ICONS[t.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{t.title}</p>
              {t.message && (
                <p className="mt-0.5 text-xs leading-5 text-white/50">{t.message}</p>
              )}
            </div>
            <button
              onClick={() => onRemove(t.id)}
              className="shrink-0 rounded-lg p-1 text-white/30 transition hover:bg-white/[0.08] hover:text-white"
            >
              <X size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
