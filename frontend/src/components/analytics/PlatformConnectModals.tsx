import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  Key,
  Hash,
  ArrowRight,
  Unlink,
} from "lucide-react";
import { BorderBeam } from "@/components/ui/border-beam";
import { ShimmerButton } from "@/components/ui/shimmer-button";

import { connectGitHub, syncGitHub, disconnectGitHub } from "@/services/github";
import { connectReddit, syncReddit, disconnectReddit } from "@/services/reddit";
import { syncSteam } from "@/services/steam";


// ─────────────────────────────────────────────────────────────
// Shared modal shell
// ─────────────────────────────────────────────────────────────

function ModalShell({
  open,
  onClose,
  color,
  children,
}: {
  open: boolean;
  onClose: () => void;
  color: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-md"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0e] shadow-2xl"
      >
        <BorderBeam size={200} duration={8} borderWidth={1} colorFrom={color} colorTo="#ffffff22" />
        {children}
      </motion.div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────

function StatusBadge({ success, message }: { success: boolean; message: string }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs ${
        success
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-red-500/30 bg-red-500/10 text-red-300"
      }`}
    >
      {success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
      <span>{message}</span>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// GITHUB CONNECT MODAL
// ─────────────────────────────────────────────────────────────

export function GitHubConnectModal({
  open,
  onClose,
  isConnected,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
  onRefresh?: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const r = await syncGitHub();
      setResult({ success: true, message: r.message });
      onRefresh?.();
    } catch (e: any) {
      setResult({ success: false, message: e.message || "Sync failed." });
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await disconnectGitHub();
      onRefresh?.();
      onClose();
    } catch {
      /* ignore */
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <AnimatePresence>
      <ModalShell open={open} onClose={onClose} color="#a371f7">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#a371f7]/15 border border-[#a371f7]/30">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#a371f7">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">GitHub</h2>
              <p className="text-[11px] text-white/40">Repos & Engineering Activity</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-6">
          {isConnected ? (
            <>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 flex items-center gap-3">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-emerald-200">GitHub Connected</p>
                  <p className="text-[10px] text-emerald-400/70 mt-0.5">Starred repos & activity are synced automatically.</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-xs text-white/60 space-y-1.5">
                <p className="font-medium text-white/80 mb-2">What's synced:</p>
                {["Starred repositories (title, language, description)", "Fork & push events", "Repository creation activity"].map((s) => (
                  <div key={s} className="flex items-center gap-2"><CheckCircle2 size={11} className="text-emerald-400 shrink-0" /><span>{s}</span></div>
                ))}
              </div>

              {result && <StatusBadge success={result.success} message={result.message} />}

              <div className="flex gap-2">
                <ShimmerButton
                  onClick={handleSync}
                  shimmerColor="#a371f7"
                  background="rgba(163,113,247,0.15)"
                  className="border-[#a371f7]/30 text-xs text-purple-200 h-9 flex-1"
                >
                  <span className="flex items-center justify-center gap-1.5">
                    {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    {syncing ? "Syncing..." : "Re-sync Now"}
                  </span>
                </ShimmerButton>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/40 hover:text-rose-400 hover:border-rose-500/30 transition"
                >
                  {disconnecting ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-white/60 leading-relaxed">
                Connect your GitHub account to automatically import your starred repositories, fork history, and push events into your interest map.
              </p>

              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-xs text-white/60 space-y-1.5">
                <p className="font-medium text-white/80 mb-2">Drifter will import:</p>
                {["All starred repositories (with language + topics)", "Recent public events (forks, stars, pushes)", "No private repo data is ever accessed"].map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[#a371f7]">→</span><span>{s}</span>
                  </div>
                ))}
              </div>

              <a
                href="https://github.com/settings/applications"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition"
              >
                <ExternalLink size={11} /> Manage GitHub OAuth apps
              </a>

              <ShimmerButton
                onClick={connectGitHub}
                shimmerColor="#a371f7"
                background="rgba(163,113,247,0.2)"
                className="border-[#a371f7]/40 text-sm text-purple-200 h-11 w-full"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  Connect with GitHub <ArrowRight size={14} />
                </span>
              </ShimmerButton>
            </>
          )}
        </div>
      </ModalShell>
    </AnimatePresence>
  );
}


// ─────────────────────────────────────────────────────────────
// REDDIT CONNECT MODAL
// ─────────────────────────────────────────────────────────────

export function RedditConnectModal({
  open,
  onClose,
  isConnected,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
  onRefresh?: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const r = await syncReddit();
      setResult({ success: true, message: r.message });
      onRefresh?.();
    } catch (e: any) {
      setResult({ success: false, message: e.message || "Sync failed." });
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await disconnectReddit();
      onRefresh?.();
      onClose();
    } catch {
      /* ignore */
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <AnimatePresence>
      <ModalShell open={open} onClose={onClose} color="#ff5722">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff5722]/15 border border-[#ff5722]/30">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#ff5722">
                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.688-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.197-2.512-.73a.326.326 0 0 0-.232-.095z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Reddit</h2>
              <p className="text-[11px] text-white/40">Saved Posts & Upvotes</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {isConnected ? (
            <>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 flex items-center gap-3">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-emerald-200">Reddit Connected</p>
                  <p className="text-[10px] text-emerald-400/70 mt-0.5">Saved posts & upvotes are being tracked.</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-xs text-white/60 space-y-1.5">
                <p className="font-medium text-white/80 mb-2">What's synced:</p>
                {["Saved posts & comments (subreddit + title)", "Upvoted posts with subreddit signals", "Post sentiment & community context"].map((s) => (
                  <div key={s} className="flex items-center gap-2"><CheckCircle2 size={11} className="text-emerald-400 shrink-0" /><span>{s}</span></div>
                ))}
              </div>

              {result && <StatusBadge success={result.success} message={result.message} />}

              <div className="flex gap-2">
                <ShimmerButton
                  onClick={handleSync}
                  shimmerColor="#ff5722"
                  background="rgba(255,87,34,0.15)"
                  className="border-[#ff5722]/30 text-xs text-orange-200 h-9 flex-1"
                >
                  <span className="flex items-center justify-center gap-1.5">
                    {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    {syncing ? "Syncing..." : "Re-sync Now"}
                  </span>
                </ShimmerButton>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/40 hover:text-rose-400 hover:border-rose-500/30 transition"
                >
                  {disconnecting ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-white/60 leading-relaxed">
                Connect Reddit to import your saved posts, upvoted links, and subreddit activity — revealing your niche community interests.
              </p>

              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-xs text-white/60 space-y-1.5">
                <p className="font-medium text-white/80 mb-2">Drifter will import:</p>
                {["Saved posts & comments with subreddit context", "Upvoted posts (titles + subreddits)", "No DMs or private messages accessed"].map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[#ff5722]">→</span><span>{s}</span>
                  </div>
                ))}
              </div>

              <ShimmerButton
                onClick={connectReddit}
                shimmerColor="#ff5722"
                background="rgba(255,87,34,0.2)"
                className="border-[#ff5722]/40 text-sm text-orange-200 h-11 w-full"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.688-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.197-2.512-.73a.326.326 0 0 0-.232-.095z" />
                  </svg>
                  Connect with Reddit <ArrowRight size={14} />
                </span>
              </ShimmerButton>
            </>
          )}
        </div>
      </ModalShell>
    </AnimatePresence>
  );
}


// ─────────────────────────────────────────────────────────────
// STEAM API KEY MODAL
// ─────────────────────────────────────────────────────────────

export function SteamKeyModal({
  open,
  onClose,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [steamId, setSteamId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleSync() {
    if (!apiKey.trim() || !steamId.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await syncSteam(apiKey.trim(), steamId.trim());
      setResult({ success: true, message: r.message });
      onRefresh?.();
    } catch (e: any) {
      setResult({ success: false, message: e.message || "Steam sync failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      <ModalShell open={open} onClose={onClose} color="#66c0f4">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#66c0f4]/15 border border-[#66c0f4]/30">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#66c0f4">
                <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.005.105.005.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 14.819C1.865 20.034 6.612 24 12.288 24c6.627 0 12-5.373 12-12S18.606 0 11.979 0zM7.544 14.975l-1.52-.628c.36-.613.98-1.053 1.706-1.186l1.621.67c-.361.614-.98 1.054-1.807 1.144zm8.396-8.324c1.27 0 2.302 1.033 2.302 2.305 0 1.27-1.032 2.303-2.302 2.303-1.273 0-2.306-1.033-2.306-2.303 0-1.272 1.033-2.305 2.306-2.305z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Steam Gaming</h2>
              <p className="text-[11px] text-white/40">API Key Import</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <p className="text-sm text-white/60 leading-relaxed">
            Steam's Web API is publicly accessible — no login flow needed. Just paste your API key and Steam ID to import your full game library.
          </p>

          {/* API Key input */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-white/50 uppercase tracking-wider">
              <Key size={11} /> Steam API Key
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-xs text-white placeholder-white/20 font-mono focus:outline-none focus:border-[#66c0f4]/50 transition"
            />
            <a
              href="https://steamcommunity.com/dev/apikey"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[10px] text-white/30 hover:text-[#66c0f4] transition"
            >
              <ExternalLink size={9} /> Get your free Steam API key →
            </a>
          </div>

          {/* Steam ID input */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-white/50 uppercase tracking-wider">
              <Hash size={11} /> Steam ID (64-bit)
            </label>
            <input
              type="text"
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
              placeholder="76561198XXXXXXXXX"
              className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-xs text-white placeholder-white/20 font-mono focus:outline-none focus:border-[#66c0f4]/50 transition"
            />
            <a
              href="https://steamid.io"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[10px] text-white/30 hover:text-[#66c0f4] transition"
            >
              <ExternalLink size={9} /> Find your 64-bit Steam ID at steamid.io →
            </a>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-white/45 leading-relaxed">
            Make sure your Steam profile's <strong className="text-white/70">Game details</strong> are set to <strong className="text-white/70">Public</strong> in Privacy Settings.
          </div>

          {result && <StatusBadge success={result.success} message={result.message} />}

          <ShimmerButton
            onClick={handleSync}
            disabled={!apiKey.trim() || !steamId.trim() || loading}
            shimmerColor="#66c0f4"
            background="rgba(102,192,244,0.2)"
            className="border-[#66c0f4]/40 text-sm text-sky-200 h-11 w-full disabled:opacity-40"
          >
            <span className="flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.005.105.005.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 14.819C1.865 20.034 6.612 24 12.288 24c6.627 0 12-5.373 12-12S18.606 0 11.979 0z" />
                </svg>
              )}
              {loading ? "Fetching Game Library..." : "Import Steam Library"}
            </span>
          </ShimmerButton>
        </div>
      </ModalShell>
    </AnimatePresence>
  );
}
