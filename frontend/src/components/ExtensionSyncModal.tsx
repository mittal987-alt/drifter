import { useEffect, useState } from "react";
import { apiClient } from "@/services/api";
import {
  Check,
  Puzzle,
  Copy,
  Download,
  ExternalLink,
  Layers,
  Key,
  PlayCircle,
  ShieldCheck,
  X,
} from "lucide-react";

interface ExtensionSyncModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ExtensionSyncModal({
  open,
  onClose,
}: ExtensionSyncModalProps) {
  const [token, setToken] = useState<string>("");
  const [loadingToken, setLoadingToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchToken();
    }
  }, [open]);

  async function fetchToken() {
    try {
      setLoadingToken(true);
      setError(null);
      const response = await apiClient.get<{ token: string }>(
        "/api/auth/extension-token"
      );
      setToken(response.data.token);
    } catch (err) {
      setError("Could not generate extension sync token.");
    } finally {
      setLoadingToken(false);
    }
  }

  function handleCopy() {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/15 bg-neutral-950/95 p-6 md:p-8 shadow-2xl space-y-6 custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-2.5 text-purple-400">
              <Puzzle size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">
                Multi-Platform Real-Time Sync Extension
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Automatically stream traces from YouTube, Spotify, GitHub, Steam & Web Browsing without exporting CSVs
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Supported Platforms Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono mr-1">Active Sources:</span>
          {[
            { name: "YouTube", color: "text-red-400 border-red-500/20 bg-red-500/10" },
            { name: "Spotify Web", color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" },
            { name: "GitHub Repos", color: "text-purple-400 border-purple-500/20 bg-purple-500/10" },
            { name: "Steam Store", color: "text-sky-400 border-sky-500/20 bg-sky-500/10" },
            { name: "X / Twitter", color: "text-sky-300 border-sky-400/20 bg-sky-400/10" },
            { name: "Web Curiosity", color: "text-cyan-400 border-cyan-500/20 bg-cyan-500/10" },
          ].map((item, idx) => (
            <span
              key={idx}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${item.color}`}
            >
              {item.name}
            </span>
          ))}
        </div>

        {/* Sync Token Card */}
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
              <Key size={15} />
              <span>Your Extension Sync Token</span>
            </div>

            <span className="text-[10px] text-purple-400/80 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
              Auto-authenticated
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={loadingToken ? "Generating token..." : token}
              className="flex-1 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-mono text-neutral-200 outline-none select-all"
            />

            <button
              onClick={handleCopy}
              disabled={!token || loadingToken}
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-2 transition-all disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check size={14} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Token</span>
                </>
              )}
            </button>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>

        {/* Setup Steps */}
        <div className="space-y-4">
          <h3 className="text-xs uppercase tracking-wider font-bold text-neutral-400 flex items-center gap-2">
            <Layers size={14} />
            <span>4-Step Setup Guide</span>
          </h3>

          <div className="space-y-3 text-xs text-neutral-300">
            {/* Step 1 */}
            <div className="flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[11px] font-bold text-purple-300">
                1
              </span>
              <div>
                <p className="font-semibold text-white">Open Chrome Extensions</p>
                <p className="text-neutral-400 mt-0.5">
                  Navigate to <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-purple-300">chrome://extensions</code> in your browser URL bar.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[11px] font-bold text-purple-300">
                2
              </span>
              <div>
                <p className="font-semibold text-white">Enable Developer Mode</p>
                <p className="text-neutral-400 mt-0.5">
                  Toggle the <strong>Developer mode</strong> switch in the top-right corner of the page.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[11px] font-bold text-purple-300">
                3
              </span>
              <div>
                <p className="font-semibold text-white">Load Unpacked Extension</p>
                <p className="text-neutral-400 mt-0.5">
                  Click <strong>Load unpacked</strong> and select the project extension folder:
                  <code className="block mt-1 bg-black/80 p-2 rounded border border-white/10 text-[11px] text-emerald-400 select-all font-mono">
                    c:\projects\drifter\extension
                  </code>
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[11px] font-bold text-purple-300">
                4
              </span>
              <div>
                <p className="font-semibold text-white">Configure Extension Popup</p>
                <p className="text-neutral-400 mt-0.5">
                  Click the Drifter icon in Chrome toolbar, set Backend API URL to <code className="text-white">http://127.0.0.1:8000</code>, paste your Sync Token, and click <strong>Save Settings</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>Automatic deduplication & real-time tracking across YouTube, Spotify, GitHub, Steam & Web</span>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-semibold px-4 py-2 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
