import { useState } from "react";
import {
  ArrowRight,
  Key,
  Lock,
  Mail,
  RefreshCw,
  Sparkles,
  Upload,
  User,
} from "lucide-react";
import { authService } from "@/services/auth";
import { ConnectionCard } from "./connectionCard";

function YouTubeIcon({ className = "h-5 w-5 fill-[#FF0000]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function SpotifyIcon({ className = "h-5 w-5 fill-[#1DB954]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.308a.747.747 0 0 1-1.028.248c-2.813-1.718-6.353-2.107-10.523-1.155a.75.75 0 0 1-.334-1.462c4.562-1.042 8.483-.598 11.637 1.341.36.22.47.69.248 1.028zm1.47-3.267a.936.936 0 0 1-1.287.308c-3.22-1.979-8.13-2.552-11.94-1.396a.937.937 0 0 1-.548-1.792c4.354-1.32 9.774-.683 13.467 1.593.424.26.56.818.308 1.287zm.126-3.41c-3.86-2.293-10.228-2.505-13.896-1.391a1.124 1.124 0 0 1-.652-2.152c4.223-1.282 11.25-1.037 15.698 1.6c.49.29.65 1.022.25 1.691-.29.49-1.022.65-1.4.252z" />
    </svg>
  );
}

interface AuthScreenProps {
  youtubeConnected: boolean;
  spotifyConnected: boolean;
  onConnectYouTube: () => void;
  onConnectSpotify: () => void;
  onImport: () => void;
  onAuthSuccess?: () => void;
}

export function AuthScreen({
  youtubeConnected,
  spotifyConnected,
  onConnectYouTube,
  onConnectSpotify,
  onImport,
  onAuthSuccess,
}: AuthScreenProps) {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      if (mode === "register") {
        await authService.registerWithPassword(email, password, name);
      } else {
        await authService.loginWithPassword(email, password);
      }
      onAuthSuccess?.();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Authentication failed. Please check your credentials.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(120,119,198,0.15),transparent_40%)]" />

      <main className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/60">
          <Sparkles size={13} className="text-amber-400" />
          <span>PERSONAL INTEREST INTELLIGENCE</span>
        </div>

        {/* Hero */}
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            Your interests,
            <br />
            <span className="text-white/40">evolving.</span>
          </h1>
          <p className="mx-auto mt-4 text-sm leading-relaxed text-white/50">
            Drifter maps your personal media evolution and gives you a personal token to import your digital traces from any method you use.
          </p>
        </div>

        {/* MANUAL EMAIL/PASSWORD CARD */}
        <div className="mt-8 w-full max-w-md rounded-3xl border border-white/10 bg-[#0c0c10]/90 backdrop-blur-xl p-6 shadow-2xl space-y-4">
          {/* Mode Switcher */}
          <div className="flex rounded-2xl border border-white/10 bg-white/[0.03] p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
              className={`flex-1 rounded-xl py-2 font-medium transition ${
                mode === "signin"
                  ? "bg-white/10 text-white font-semibold shadow-sm"
                  : "text-white/50 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`flex-1 rounded-xl py-2 font-medium transition ${
                mode === "register"
                  ? "bg-white/10 text-white font-semibold shadow-sm"
                  : "text-white/50 hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider block">
                  Name (Optional)
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-2.5 focus-within:border-amber-400/50 transition">
                  <User size={14} className="text-white/30" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Name"
                    className="flex-1 bg-transparent text-xs text-white placeholder-white/25 outline-none"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider block">
                Email
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-2.5 focus-within:border-amber-400/50 transition">
                <Mail size={14} className="text-white/30" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 bg-transparent text-xs text-white placeholder-white/25 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider block">
                Password
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-2.5 focus-within:border-amber-400/50 transition">
                <Lock size={14} className="text-white/30" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 bg-transparent text-xs text-white placeholder-white/25 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black py-3 text-xs font-semibold shadow-lg shadow-amber-500/10 transition disabled:opacity-50 mt-2"
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>{mode === "register" ? "Create Account & Get Token" : "Sign In with Email"}</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-center text-white/35 pt-1">
            Logging in gives you a personal token to push traces from your browser extension or scripts.
          </p>
        </div>

        {/* DIVIDER */}
        <div className="mt-8 flex items-center gap-3 w-full max-w-md">
          <div className="flex-1 h-px bg-white/[0.08]" />
          <span className="text-[11px] uppercase tracking-wider text-white/30 font-medium">Or connect accounts</span>
          <div className="flex-1 h-px bg-white/[0.08]" />
        </div>

        {/* Connections */}
        <div className="mt-6 grid w-full max-w-2xl gap-4 sm:grid-cols-2">
          <ConnectionCard
            icon={<YouTubeIcon />}
            name="YouTube"
            description="Give permission to import your YouTube watch history automatically."
            connected={youtubeConnected}
            onConnect={onConnectYouTube}
          />

          <ConnectionCard
            icon={<SpotifyIcon />}
            name="Spotify"
            description="Connect Spotify for permitted personal-data features."
            connected={spotifyConnected}
            onConnect={onConnectSpotify}
          />
        </div>

        {/* Import file link */}
        <button
          onClick={onImport}
          className="mt-6 flex items-center gap-2 text-xs text-white/40 transition hover:text-white"
        >
          <Upload size={14} />
          <span>Or import your Google Takeout history file manually</span>
          <span>→</span>
        </button>

        {/* Footer */}
        <p className="mt-8 max-w-md text-center text-[11px] leading-5 text-white/25">
          Your data remains private. Tokens are cryptographically signed and scoped strictly to your account.
        </p>
      </main>
    </div>
  );
}