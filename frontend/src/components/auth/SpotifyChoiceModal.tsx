import { useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Crown,
  FileSpreadsheet,
  HelpCircle,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

interface SpotifyChoiceModalProps {
  open: boolean;
  onClose: () => void;
  onSelectPremium: () => void;
  onSelectManualImport: () => void;
}

export function SpotifyChoiceModal({
  open,
  onClose,
  onSelectPremium,
  onSelectManualImport,
}: SpotifyChoiceModalProps) {
  const [showExportGuide, setShowExportGuide] = useState(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-md"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0c] p-7 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
        {/* Ambient background glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-80 rounded-full bg-[#1DB954]/10 blur-3xl" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-xl p-2 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#1DB954]/30 bg-[#1DB954]/10 text-[#1DB954]">
            <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.308a.747.747 0 0 1-1.028.248c-2.813-1.718-6.353-2.107-10.523-1.155a.75.75 0 0 1-.334-1.462c4.562-1.042 8.483-.598 11.637 1.341.36.22.47.69.248 1.028zm1.47-3.267a.936.936 0 0 1-1.287.308c-3.22-1.979-8.13-2.552-11.94-1.396a.937.937 0 0 1-.548-1.792c4.354-1.32 9.774-.683 13.467 1.593.424.26.56.818.308 1.287zm.126-3.41c-3.86-2.293-10.228-2.505-13.896-1.391a1.124 1.124 0 0 1-.652-2.152c4.223-1.282 11.25-1.037 15.698 1.6c.49.29.65 1.022.25 1.691-.29.49-1.022.65-1.4.252z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">
              Connect Spotify
            </h2>
            <p className="text-xs text-white/50">
              Select your account type to proceed
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="mt-6 space-y-3.5">
          {/* OPTION 1: Premium (Direct Sync) */}
          <div
            onClick={onSelectPremium}
            className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all duration-200 hover:border-[#1DB954]/50 hover:bg-[#1DB954]/[0.04]"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1DB954]/15 text-[#1DB954]">
                  <Crown size={17} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">
                      I have Spotify Premium
                    </h3>
                    <span className="rounded-md border border-[#1DB954]/30 bg-[#1DB954]/10 px-2 py-0.5 text-[10px] font-medium text-[#1DB954]">
                      Direct API
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/50 leading-relaxed">
                    Live account sync via Spotify OAuth. Automatically imports your top tracks, artists, and recently played songs.
                  </p>
                </div>
              </div>
              <ArrowUpRight
                size={18}
                className="shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#1DB954]"
              />
            </div>

            <div className="mt-3.5 flex items-center gap-1.5 border-t border-white/[0.05] pt-3 text-[11px] text-white/35">
              <CheckCircle2 size={13} className="text-[#1DB954]/70" />
              <span>Requires an active Spotify Premium subscription</span>
            </div>
          </div>

          {/* OPTION 2: Free / No Subscription (Manual Import) */}
          <div
            onClick={onSelectManualImport}
            className="group relative cursor-pointer overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.03] p-5 transition-all duration-200 hover:border-emerald-400/60 hover:bg-emerald-500/[0.07]"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <FileSpreadsheet size={17} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">
                      I use Free Spotify (No Subscription)
                    </h3>
                    <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      100% Free · Recommended
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/50 leading-relaxed">
                    Upload your exported listening history (CSV or JSON). Builds your full drift timeline without needing a paid Spotify plan.
                  </p>
                </div>
              </div>
              <Upload
                size={18}
                className="shrink-0 text-emerald-400/60 transition group-hover:translate-y-[-2px] group-hover:text-emerald-300"
              />
            </div>

            <div className="mt-3.5 flex items-center justify-between border-t border-emerald-500/10 pt-3 text-[11px]">
              <span className="text-emerald-400/80">
                Works for all accounts (Free or Premium)
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExportGuide((prev) => !prev);
                }}
                className="inline-flex items-center gap-1 text-white/40 hover:text-white transition"
              >
                <HelpCircle size={12} />
                <span>{showExportGuide ? "Hide instructions" : "How to get file?"}</span>
              </button>
            </div>

            {/* Quick guide accordion */}
            {showExportGuide && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="mt-3 rounded-xl border border-white/10 bg-black/50 p-3 text-xs text-white/60 space-y-1.5"
              >
                <div className="font-medium text-white/80">How to get your Spotify history:</div>
                <ol className="list-decimal list-inside space-y-1 text-white/50">
                  <li>Go to Spotify Account Settings ➜ <b>Privacy Settings</b></li>
                  <li>Scroll to <b>"Download your data"</b> and request your package</li>
                  <li>Download the zip and upload <code>StreamingHistory.json</code> or <code>endsong.json</code> here!</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between text-xs text-white/40">
          <span className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-white/30" />
            Both options generate your full Interest Map & Drift analytics
          </span>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
