import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface AnimatedTabsProps<T extends string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  className?: string;
  layoutId?: string;
}

export function AnimatedTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  className,
  layoutId = "active-tab-pill",
}: AnimatedTabsProps<T>) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1.5 backdrop-blur-md",
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            type="button"
            className={cn(
              "relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors duration-200 outline-none",
              isActive
                ? "text-white font-semibold"
                : "text-white/50 hover:text-white/80 hover:bg-white/[0.02]",
            )}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-white/[0.1] border border-white/15 shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {tab.icon && (
                <span className={cn("transition-colors", isActive ? "text-white" : "text-white/40")}>
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-white/70">
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
