import { motion } from "motion/react";
import {
  Activity,
  Brain,
  Clock3,
  Compass,
  Dna,
  History,
  Shuffle,
  TrendingUp,
} from "lucide-react";
import type { WorkspaceView } from "@/components/dashboard/WorkspaceViews";

const NAV_ITEMS: { icon: React.ReactNode; label: string; view: WorkspaceView }[] = [
  { icon: <Activity size={20} />, label: "Overview", view: "overview" },
  { icon: <Brain size={20} />, label: "Map", view: "map" },
  { icon: <TrendingUp size={20} />, label: "Evolution", view: "evolution" },
  { icon: <Compass size={20} />, label: "Predict", view: "prediction" },
  { icon: <History size={20} />, label: "History", view: "history" },
  { icon: <Shuffle size={20} />, label: "Correlation", view: "correlation" },
  { icon: <Clock3 size={20} />, label: "Behavior", view: "behavior" },
  { icon: <Dna size={20} />, label: "DNA", view: "dna" },
];

// Show only 5 most important items on mobile
const MOBILE_ITEMS = NAV_ITEMS.slice(0, 5);

interface MobileNavProps {
  activeView: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
}

export function MobileNav({ activeView, onNavigate }: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 lg:hidden border-t border-white/[0.08] bg-[#060606]/90 backdrop-blur-xl px-2 pb-safe">
      <div className="flex items-center justify-around">
        {MOBILE_ITEMS.map((item) => {
          const isActive = activeView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => onNavigate(item.view)}
              className="relative flex flex-col items-center gap-1 px-3 py-3 text-[10px] font-medium transition-colors"
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="absolute inset-0 rounded-xl bg-white/[0.07]"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <span
                className={`relative z-10 transition-colors ${
                  isActive ? "text-white" : "text-white/35"
                }`}
              >
                {item.icon}
              </span>
              <span
                className={`relative z-10 transition-colors ${
                  isActive ? "text-white" : "text-white/30"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
