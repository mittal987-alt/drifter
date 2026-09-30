import React from "react";
import { X, Command } from "lucide-react";

interface ShortcutItem {
  key: string;
  label: string;
  category: "Navigation" | "Actions" | "Preferences";
}

const SHORTCUTS: ShortcutItem[] = [
  { key: "1", label: "Go to Overview", category: "Navigation" },
  { key: "2", label: "Go to Interest Map", category: "Navigation" },
  { key: "3", label: "Go to Evolution", category: "Navigation" },
  { key: "4", label: "Go to Behavior", category: "Navigation" },
  { key: "5", label: "Go to History", category: "Navigation" },
  { key: "6", label: "Go to Predictor", category: "Navigation" },
  { key: "7", label: "Go to Correlation", category: "Navigation" },
  { key: "8", label: "Go to Interest DNA", category: "Navigation" },
  { key: "R", label: "Refresh analysis", category: "Actions" },
  { key: "I", label: "Import data / history", category: "Actions" },
  { key: "C", label: "Ask Drifter AI chat", category: "Actions" },
  { key: "W", label: "Open Wrapped story", category: "Actions" },
  { key: "T", label: "Toggle Dark / Light theme", category: "Preferences" },
  { key: "H", label: "Show System & Health status", category: "Preferences" },
  { key: "?", label: "Show keyboard shortcuts", category: "Preferences" },
  { key: "Esc", label: "Close current modal", category: "Preferences" },
];


interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const categories = ["Navigation", "Actions", "Preferences"] as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d0d0d] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
              <Command size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Keyboard Shortcuts</h3>
              <p className="text-[11px] text-white/40">Navigate Drifter with your keyboard</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-4 max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          {categories.map((cat) => {
            const items = SHORTCUTS.filter((s) => s.category === cat);
            return (
              <div key={cat}>
                <h4 className="text-[10px] font-medium uppercase tracking-wider text-white/30 mb-2">
                  {cat}
                </h4>
                <div className="grid grid-cols-1 gap-1.5">
                  {items.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-xs"
                    >
                      <span className="text-white/70">{item.label}</span>
                      <kbd className="inline-flex min-w-[24px] items-center justify-center rounded border border-white/20 bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white shadow-sm">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 border-t border-white/[0.06] pt-4 text-center text-[11px] text-white/30">
          Press <kbd className="rounded border border-white/20 bg-white/10 px-1 py-0.5 font-mono text-[10px]">?</kbd> anytime to toggle this modal
        </div>
      </div>
    </div>
  );
}
