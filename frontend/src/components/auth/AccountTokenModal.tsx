import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Key,
  Mail,
  Shield,
  Terminal,
  User as UserIcon,
  X,
} from "lucide-react";
import { authService } from "@/services/auth";
import type { AuthUser } from "@/types/auth";

interface AccountTokenModalProps {
  open: boolean;
  onClose: () => void;
  user?: AuthUser | null;
  onLogout: () => void;
}

export default function AccountTokenModal({
  open,
  onClose,
  user,
  onLogout,
}: AccountTokenModalProps) {
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadToken();
    }
  }, [open]);

  async function loadToken() {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.getSyncToken();
      setToken(res.token);
    } catch (err) {
      setError("Could not retrieve import token.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopyToken() {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const curlExample = `curl -X POST "http://localhost:8000/api/youtube-history" \\
  -H "Authorization: Bearer ${token || "YOUR_TOKEN"}" \\
  -H "Content-Type: application/json" \\
  -d '{"events": [{"title": "Example Video", "url": "https://youtube.com/watch?v=123"}]}'`;

  function handleCopyCurl() {
    navigator.clipboard.writeText(curlExample);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2500);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0e0e12] p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Key size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Account & Data Import Token</h2>
              <p className="text-xs text-white/40">Manage your credentials and API import key</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white transition"
          >
            <X size={17} />
          </button>
        </div>

        {/* User Identity Card */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300">
              <UserIcon size={16} />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">
                {user?.name || user?.email || `User #${user?.id || 1}`}
              </div>
              <div className="text-[11px] text-white/40 flex items-center gap-2">
                {user?.email && <span>{user.email}</span>}
                <span className="font-mono text-amber-400/70">ID: {user?.id}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition"
          >
            Logout
          </button>
        </div>

        {/* Data Import Token Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-white/80 flex items-center gap-1.5">
              <Shield size={13} className="text-emerald-400" />
              <span>Personal Data Import Token</span>
            </label>
            <span className="text-[10px] text-white/30 font-mono">HMAC-SHA256 Signed</span>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-2.5">
            <input
              type="text"
              readOnly
              value={loading ? "Generating..." : token || "No token available"}
              className="flex-1 bg-transparent font-mono text-xs text-amber-300 select-all outline-none"
            />
            <button
              onClick={handleCopyToken}
              disabled={!token || loading}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40"
              title="Copy token to clipboard"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? "Copied!" : "Copy"}</span>
            </button>
          </div>
          <p className="text-[11px] text-white/40 leading-relaxed">
            Use this token to push watch/listening history directly to this account via HTTP requests, the Chrome extension, or scripts.
          </p>
        </div>

        {/* API Usage Example */}
        <div className="space-y-2 rounded-2xl border border-white/[0.07] bg-black/50 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-white/70">
              <Terminal size={13} className="text-amber-400" />
              <span>Import via curl / HTTP</span>
            </div>
            <button
              onClick={handleCopyCurl}
              className="text-[11px] text-white/40 hover:text-white transition flex items-center gap-1"
            >
              {copiedCurl ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              <span>{copiedCurl ? "Copied" : "Copy curl"}</span>
            </button>
          </div>
          <pre className="text-[10px] font-mono text-white/60 overflow-x-auto p-2 rounded-lg bg-white/[0.02] scrollbar-thin">
            {curlExample}
          </pre>
        </div>
      </div>
    </div>
  );
}
