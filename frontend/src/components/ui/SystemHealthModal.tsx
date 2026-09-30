import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Cpu,
  RefreshCw,
  X,
  Server,
  Zap,
} from "lucide-react";

interface HealthData {
  status: string;
  database: {
    type: string;
    status: string;
  };
  llm: {
    gemini: boolean;
    openai: boolean;
    ollama: boolean;
  };
  providers_configured: {
    youtube: boolean;
    spotify: boolean;
    github: boolean;
    reddit: boolean;
  };
  cache_entries: number;
}

interface SystemHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedProviders: {
    youtube: boolean;
    spotify: boolean;
    github: boolean;
    reddit: boolean;
  };
}

export function SystemHealthModal({
  isOpen,
  onClose,
  connectedProviders,
}: SystemHealthModalProps) {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const res = await axios.get<HealthData>(`${apiUrl}/health`, {
        timeout: 5000,
      });
      const end = performance.now();
      setLatency(Math.round(end - start));
      setData(res.data);
    } catch (err: any) {
      setError(err?.message || "Failed to reach backend");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealth();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d0d0d] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <Activity size={17} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">System & Engine Status</h3>
              <p className="text-[11px] text-white/40">Drifter infrastructure diagnostics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
              title="Refresh status"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-4">
          {/* Main Status Badge */}
          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-3">
              <Server size={18} className="text-white/60" />
              <div>
                <p className="text-xs font-medium text-white">Backend API Server</p>
                <p className="text-[11px] text-white/40">
                  {error ? "Unreachable" : "FastAPI 0.115+ running"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {latency !== null && (
                <span className="font-mono text-[11px] text-white/40">
                  {latency}ms
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  error
                    ? "bg-rose-500/20 text-rose-300"
                    : "bg-emerald-500/20 text-emerald-300"
                }`}
              >
                {error ? <XCircle size={10} /> : <CheckCircle2 size={10} />}
                {error ? "Offline" : "Healthy"}
              </span>
            </div>
          </div>

          {/* Database & Cache */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-2 text-white/40 text-[10px] font-medium uppercase tracking-wider">
                <Database size={12} />
                <span>Database</span>
              </div>
              <p className="mt-2 text-xs font-semibold text-white capitalize">
                {data?.database.type || "SQLite"}
              </p>
              <p className="text-[10px] text-emerald-400 mt-0.5">
                {data?.database.status === "ok" ? "Connected" : data?.database.status || "Ready"}
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-2 text-white/40 text-[10px] font-medium uppercase tracking-wider">
                <Zap size={12} />
                <span>Analytics Cache</span>
              </div>
              <p className="mt-2 text-xs font-semibold text-white">
                {data?.cache_entries ?? 0} entries
              </p>
              <p className="text-[10px] text-purple-400 mt-0.5">TTL In-Memory</p>
            </div>
          </div>

          {/* Connected Providers */}
          <div>
            <h4 className="text-[10px] font-medium uppercase tracking-wider text-white/30 mb-2">
              Data Ingestion Providers
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: "YouTube", key: "youtube" as const },
                { name: "Spotify", key: "spotify" as const },
                { name: "GitHub", key: "github" as const },
                { name: "Reddit", key: "reddit" as const },
              ].map((p) => {
                const isConnected = connectedProviders[p.key];
                return (
                  <div
                    key={p.key}
                    className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-xs"
                  >
                    <span className="text-white/70">{p.name}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                        isConnected
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-white/[0.04] text-white/30"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isConnected ? "bg-emerald-400" : "bg-white/20"
                        }`}
                      />
                      {isConnected ? "Linked" : "Unlinked"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* LLM & AI Engine */}
          <div>
            <h4 className="text-[10px] font-medium uppercase tracking-wider text-white/30 mb-2">
              AI & Synthesis Engine
            </h4>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70 flex items-center gap-1.5">
                  <Cpu size={13} className="text-purple-400" />
                  Embedding Model
                </span>
                <span className="font-mono text-[10px] text-white/40">
                  all-MiniLM-L6-v2
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.04] pt-2 text-xs">
                <span className="text-white/70">Active LLM Engines</span>
                <div className="flex items-center gap-1">
                  {data?.llm.ollama && (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">
                      Ollama Local
                    </span>
                  )}
                  {data?.llm.gemini && (
                    <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-medium text-blue-300">
                      Gemini
                    </span>
                  )}
                  {data?.llm.openai && (
                    <span className="rounded bg-teal-500/20 px-1.5 py-0.5 text-[9px] font-medium text-teal-300">
                      OpenAI
                    </span>
                  )}
                  {!data?.llm.ollama && !data?.llm.gemini && !data?.llm.openai && (
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-white/40">
                      Rule-based Fallback
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
