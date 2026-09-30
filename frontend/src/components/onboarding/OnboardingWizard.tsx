import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  Check,
  Database,
  Puzzle,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { authService } from "@/services/auth";

interface Step {
  id: number;
  icon: React.ReactNode;
  label: string;
  title: string;
  description: string;
  actions: React.ReactNode;
}

interface OnboardingWizardProps {
  onDismiss: () => void;
  onImport: () => void;
  onExtension: () => void;
}

export function OnboardingWizard({
  onDismiss,
  onImport,
  onExtension,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(0);

  const steps: Step[] = [
    {
      id: 0,
      icon: <Sparkles size={28} className="text-amber-400" />,
      label: "Welcome",
      title: "Welcome to Drifter",
      description:
        "Drifter maps your intellectual journey. Connect your platforms or import your history to see how your interests evolve over time.",
      actions: (
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={() => setStep(1)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Get started
            <ArrowRight size={16} />
          </button>
          <button
            onClick={onDismiss}
            className="text-xs text-white/30 transition hover:text-white/60"
          >
            I'll set up later
          </button>
        </div>
      ),
    },
    {
      id: 1,
      icon: <Database size={28} className="text-blue-400" />,
      label: "Connect",
      title: "Connect your platforms",
      description:
        "Link YouTube and Spotify for automatic syncing. GitHub and Reddit can also be connected for a richer interest map.",
      actions: (
        <div className="mt-8 space-y-3">
          <button
            onClick={authService.connectYouTube}
            className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm transition hover:border-white/20 hover:bg-white/[0.08]"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-xs text-black font-bold">▶</span>
              <span className="text-white/80">Connect YouTube</span>
            </span>
            <ArrowRight size={15} className="text-white/30 group-hover:text-white" />
          </button>
          <button
            onClick={authService.connectSpotify}
            className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm transition hover:border-white/20 hover:bg-white/[0.08]"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1DB954]/10 text-[#1DB954] text-xs font-bold">♫</span>
              <span className="text-white/80">Connect Spotify</span>
            </span>
            <ArrowRight size={15} className="text-white/30 group-hover:text-white" />
          </button>
          <button
            onClick={() => setStep(2)}
            className="w-full pt-2 text-center text-xs text-white/30 transition hover:text-white/60"
          >
            Skip — I'll import manually →
          </button>
        </div>
      ),
    },
    {
      id: 2,
      icon: <Upload size={28} className="text-emerald-400" />,
      label: "Import",
      title: "Import your history",
      description:
        "Upload a YouTube watch-history JSON from Google Takeout, or import Spotify, Reddit, GitHub data. You can also use the Drifter Chrome Extension.",
      actions: (
        <div className="mt-8 space-y-3">
          <button
            onClick={() => { onImport(); onDismiss(); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 transition hover:border-white/20 hover:bg-white/[0.08]"
          >
            <Upload size={15} />
            Import a history file
          </button>
          <button
            onClick={() => { onExtension(); onDismiss(); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-500/20 bg-purple-500/[0.06] px-4 py-3 text-sm text-purple-300 transition hover:bg-purple-500/[0.1]"
          >
            <Puzzle size={15} />
            Set up Chrome Extension
          </button>
          <button
            onClick={onDismiss}
            className="w-full pt-2 text-center text-xs text-white/30 transition hover:text-white/60"
          >
            Done, take me to dashboard
          </button>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0b0b0b] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex gap-2">
            {steps.map((s, i) => (
              <div
                key={s.id}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-8 bg-white"
                    : i < step
                    ? "w-4 bg-white/40"
                    : "w-4 bg-white/10"
                }`}
              />
            ))}
          </div>
          <button
            onClick={onDismiss}
            className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="p-8"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
              {currentStep.icon}
            </div>
            <h2 className="mt-5 text-xl font-semibold text-white">{currentStep.title}</h2>
            <p className="mt-2 text-sm leading-6 text-white/40">{currentStep.description}</p>
            {currentStep.actions}
          </motion.div>
        </AnimatePresence>

        {/* Step labels */}
        <div className="flex items-center justify-between border-t border-white/[0.06] px-8 py-3">
          {steps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider transition ${
                i === step
                  ? "text-white"
                  : i < step
                  ? "text-white/50"
                  : "text-white/20"
              }`}
            >
              {i < step && <Check size={10} />}
              {s.label}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
