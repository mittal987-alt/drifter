import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import type { ReactNode } from "react";

import { AuthLoading } from "@/components/auth/AuthLoading";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { SpotifyChoiceModal } from "@/components/auth/SpotifyChoiceModal";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth";

import {
  Activity,
  ArrowUpRight,
  Brain,
  CheckCircle2,
  Clock3,
  Database,
  History,
  Loader2,
  LogOut,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
  Bot,
  Compass,
  Dna,
  Shuffle,
} from "lucide-react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getDashboard } from "./services/analytics";
import type { DashboardData } from "./services/analytics";

import {
  getGoogleExportStatus,
  getHistory,
  getLatestGoogleExportStatus,
} from "./services/history";
import type { HistoryEvent } from "./services/history";

import InterestMap from "./components/InterestMap";

import {
  BehaviorView,
  EvolutionView,
  HistoryView,
  MapView,
  OverviewView,
  PredictionWorkspaceView,
  CorrelationWorkspaceView,
  DnaWorkspaceView,
  type WorkspaceView,
} from "./components/dashboard/WorkspaceViews";
import HistoryChatModal from "./components/chat/HistoryChatModal";
import YearInDriftModal from "./components/reports/YearInDriftModal";

/*
|--------------------------------------------------------------------------
| Actual Magic UI components
|--------------------------------------------------------------------------
*/

import { MagicCard } from "@/components/ui/magic-card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { BorderBeam } from "@/components/ui/border-beam";
import { BlurFade } from "@/components/ui/blur-fade";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";

/*
|--------------------------------------------------------------------------
| Actual Aceternity UI components
|--------------------------------------------------------------------------
*/

import { Spotlight } from "@/components/ui/spotlight";
import { CardSpotlight } from "@/components/ui/card-spotlight";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";

/* ==========================================================================
   APP
   ========================================================================== */

function App() {
  const {
    loading: authLoading,
    authenticated,
    isConnected,
    logout,
    refreshAuth,
  } = useAuth();

  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [importOpen, setImportOpen] =
    useState(false);

  const [spotifyChoiceOpen, setSpotifyChoiceOpen] =
    useState(false);

  const [importSource, setImportSource] =
    useState<"youtube" | "spotify">("youtube");

  const [importFile, setImportFile] =
    useState<File | null>(null);

  const [importing, setImporting] =
    useState(false);

  const [importResult, setImportResult] =
    useState<string | null>(null);

  const [importError, setImportError] =
    useState<string | null>(null);

  const [activeView, setActiveView] =
    useState<WorkspaceView>(() => {
      const path = window.location.pathname.toLowerCase();
      if (path.includes("predict")) return "prediction";
      if (path.includes("correlat")) return "correlation";
      if (path.includes("dna")) return "dna";
      if (path.includes("map")) return "map";
      if (path.includes("evolution")) return "evolution";
      if (path.includes("behavior")) return "behavior";
      if (path.includes("history")) return "history";
      return "overview";
    });

  useEffect(() => {
    const targetPath = activeView === "overview" ? "/" : `/${activeView}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, "", targetPath);
    }
  }, [activeView]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path.includes("predict")) setActiveView("prediction");
      else if (path.includes("correlat")) setActiveView("correlation");
      else if (path.includes("dna")) setActiveView("dna");
      else if (path.includes("map")) setActiveView("map");
      else if (path.includes("evolution")) setActiveView("evolution");
      else if (path.includes("behavior")) setActiveView("behavior");
      else if (path.includes("history")) setActiveView("history");
      else setActiveView("overview");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const [chatOpen, setChatOpen] =
    useState(false);

  const [wrappedOpen, setWrappedOpen] =
    useState(false);

  const [history, setHistory] =
    useState<HistoryEvent[]>([]);

  const [historyLoading, setHistoryLoading] =
    useState(false);

  const [googleExportStatus, setGoogleExportStatus] =
    useState<string | null>(null);

  /* ==========================================================================
     LOAD DASHBOARD
     ========================================================================== */

  async function loadDashboard(refresh = false) {
    try {
      setLoading(true);
      setError(null);

      const data = await getDashboard(refresh);

      setDashboard(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  /* ==========================================================================
     HISTORY IMPORT
     ========================================================================== */

  async function handleHistoryImport() {
    if (!importFile) {
      setImportError(
        "Please choose a YouTube JSON or Google Takeout ZIP file.",
      );
      return;
    }

    try {
      setImporting(true);
      setImportError(null);
      setImportResult(null);

      const formData = new FormData();

      formData.append(
        "file",
        importFile,
      );

      formData.append(
        "source",
        importSource,
      );

      const apiUrl =
        import.meta.env.VITE_API_URL ||
        "http://127.0.0.1:8000";

      const response = await axios.post(
        `${apiUrl}/api/history/import?source=${encodeURIComponent(importSource)}`,
        formData,
        {
          withCredentials: true,
        },
      );

      const imported =
        Number(
          response.data?.imported ?? 0,
        );

      const duplicates =
        Number(
          response.data?.duplicates ?? 0,
        );

      const skipped =
        Number(
          response.data?.skipped ?? 0,
        );

      const parts: string[] = [];

      parts.push(
        `${imported.toLocaleString()} events imported`,
      );

      if (duplicates > 0) {
        parts.push(
          `${duplicates.toLocaleString()} duplicates`,
        );
      }

      if (skipped > 0) {
        parts.push(
          `${skipped.toLocaleString()} skipped`,
        );
      }

      setImportResult(
        parts.join(" · "),
      );

      setImportFile(null);

      await refreshAuth();

      await loadDashboard(true);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail =
          err.response?.data?.detail;

        if (typeof detail === "string") {
          setImportError(detail);
        } else if (
          Array.isArray(detail)
        ) {
          setImportError(
            detail
              .map((item) =>
                typeof item === "object" &&
                item !== null &&
                "msg" in item
                  ? String(
                      (
                        item as {
                          msg: unknown;
                        }
                      ).msg,
                    )
                  : String(item),
              )
              .join(", "),
          );
        } else if (
          detail &&
          typeof detail === "object"
        ) {
          setImportError(
            detail.message ||
              "Failed to import history.",
          );
        } else {
          setImportError(
            err.message ||
              "Failed to import history.",
          );
        }
      } else {
        setImportError(
          "Failed to import history.",
        );
      }
    } finally {
      setImporting(false);
    }
  }

  /* ==========================================================================
     CLOSE IMPORT MODAL
     ========================================================================== */

  function closeImportModal() {
    if (importing) return;

    setImportOpen(false);
    setImportFile(null);
    setImportResult(null);
    setImportError(null);
  }

  /* ==========================================================================
     SPOTIFY
     ========================================================================== */

  function handleSpotifyConnectClick() {
    setSpotifyChoiceOpen(true);
  }

  function handleSelectPremium() {
    setSpotifyChoiceOpen(false);

    authService.connectSpotify();
  }

  function handleSelectManualImport() {
    setSpotifyChoiceOpen(false);

    setImportSource("spotify");
    setImportOpen(true);
    setImportResult(null);
    setImportError(null);
  }

  function renderSpotifyChoiceModal() {
    return (
      <SpotifyChoiceModal
        open={spotifyChoiceOpen}
        onClose={() =>
          setSpotifyChoiceOpen(false)
        }
        onSelectPremium={
          handleSelectPremium
        }
        onSelectManualImport={
          handleSelectManualImport
        }
      />
    );
  }

  /* ==========================================================================
     IMPORT MODAL
     ========================================================================== */

  function renderImportModal() {
    if (!importOpen) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (
            event.target ===
            event.currentTarget
          ) {
            closeImportModal();
          }
        }}
      >
        <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b] shadow-2xl">

          <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-5">

            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/30">
                Data ingestion
              </p>

              <h2 className="mt-1 text-lg font-semibold">
                Import your history
              </h2>

              <p className="mt-1 text-xs text-white/35">
                {importSource === "spotify"
                  ? "Upload your Spotify listening history from Privacy Settings."
                  : "Upload your YouTube watch history from Google Takeout."}
              </p>
            </div>

            <button
              onClick={closeImportModal}
              disabled={importing}
              className="rounded-lg p-2 text-white/40 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
            >
              <X size={18} />
            </button>

          </div>

          <div className="space-y-6 p-6">

            {/* SOURCE */}

            <div>
              <p className="mb-3 text-xs font-medium text-white/60">
                History source
              </p>

              <div className="grid grid-cols-2 gap-3">

                <button
                  type="button"
                  onClick={() => {
                    setImportSource("youtube");
                    setImportError(null);
                  }}
                  disabled={importing}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    importSource === "youtube"
                      ? "border-white/20 bg-white/[0.08]"
                      : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                  } disabled:opacity-50`}
                >
                  <div className="text-sm font-medium">
                    YouTube
                  </div>

                  <div className="mt-1 text-[11px] text-white/30">
                    Watch history
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setImportSource("spotify");
                    setImportError(null);
                    setImportFile(null);
                  }}
                  disabled={importing}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    importSource === "spotify"
                      ? "border-white/20 bg-white/[0.08]"
                      : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                  } disabled:opacity-50`}
                >
                  <div className="text-sm font-medium">
                    Spotify
                  </div>

                  <div className="mt-1 text-[11px] text-white/30">
                    Listening history
                  </div>
                </button>

              </div>
            </div>

            {/* FILE */}

            <label
              className="group flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center transition hover:border-white/20 hover:bg-white/[0.04]"
            >

              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] transition group-hover:bg-white/[0.08]">
                <Upload size={20} />
              </div>

              {importFile ? (
                <>
                  <p className="mt-4 max-w-full truncate px-4 text-sm font-medium">
                    {importFile.name}
                  </p>

                  <p className="mt-1 text-xs text-white/30">
                    {(
                      importFile.size /
                      1024 /
                      1024
                    ).toFixed(2)}{" "}
                    MB
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-4 text-sm font-medium">
                    Choose history file
                  </p>

                  <p className="mt-1 text-xs text-white/30">
                    {importSource === "spotify"
                      ? "Spotify JSON or CSV from Privacy Settings"
                      : "YouTube JSON or Google Takeout ZIP"}
                  </p>
                </>
              )}

              <input
                type="file"
                accept=".json,.zip,.html,.htm,.csv,application/json,application/zip,text/html,text/csv"
                className="hidden"
                disabled={importing}
                onChange={(event) => {
                  const selected =
                    event.target.files?.[0];

                  if (!selected) return;

                  setImportFile(selected);
                  setImportResult(null);
                  setImportError(null);
                }}
              />
            </label>

            {/* RESULT */}

            {importResult && (
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <CheckCircle2 size={17} />

                <span className="text-xs text-white/70">
                  {importResult}
                </span>
              </div>
            )}

            {/* ERROR */}

            {importError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-3 text-xs leading-5 text-red-300">
                {importError}
              </div>
            )}

            {/* BUTTON */}

            <button
              type="button"
              disabled={
                !importFile ||
                importing
              }
              onClick={
                handleHistoryImport
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {importing ? (
                <>
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />

                  Importing history...
                </>
              ) : (
                <>
                  <Upload size={16} />

                  Import History
                </>
              )}
            </button>

          </div>
        </div>
      </div>
    );
  }

  /* ==========================================================================
     INITIAL LOAD
     ========================================================================== */

  useEffect(() => {
    if (
      !authLoading &&
      authenticated
    ) {
      loadDashboard(false);
    }
  }, [
    authLoading,
    authenticated,
  ]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function pollExport(jobId?: number) {
      try {
        const status = jobId
          ? await getGoogleExportStatus(jobId)
          : await getLatestGoogleExportStatus();
        if (cancelled) return;
        setGoogleExportStatus(status.status);
        if (status.status === "COMPLETE" || status.status === "IMPORTED") {
          await loadDashboard(true);
          return;
        }
        if (status.status === "FAILED" || status.status === "CANCELLED" || status.status === "IDLE" || !status.job_id) return;
        timer = window.setTimeout(() => pollExport(status.job_id), 60_000);
      } catch {
        // A missing latest job is expected for users who have not imported yet.
      }
    }

    const jobId = new URLSearchParams(window.location.search).get(
      "google_export_job",
    );
    if (jobId) {
      window.history.replaceState({}, document.title, window.location.pathname);
      pollExport(Number(jobId));
    } else if (authenticated) {
      pollExport();
    }

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [authenticated]);

  /* ==========================================================================
     SPOTIFY ERROR
     ========================================================================== */

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search,
      );

    if (
      params.get("spotify_error") ===
      "premium_required"
    ) {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname,
      );

      setImportSource("spotify");
      setImportOpen(true);

      setImportError(
        "Spotify requires an active Premium subscription for direct API sync.",
      );
    }

    const googleError = params.get("google_error");
    if (googleError) {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname,
      );

      setImportSource("youtube");
      setImportOpen(true);

      if (googleError === "access_denied") {
        setImportError(
          "Google sign-in was denied or cancelled. If your project is in Testing mode, ensure your Google email is added to 'Test users' in Google Cloud Console. Alternatively, you can import your YouTube history JSON manually below.",
        );
      } else {
        setImportError(
          `Google sign-in error: ${googleError}. You can import your YouTube history JSON manually below.`,
        );
      }
    }
  }, []);

  /* ==========================================================================
     LOAD HISTORY VIEW
     ========================================================================== */

  useEffect(() => {
    if (
      !authenticated ||
      activeView !== "history"
    ) {
      return;
    }

    let cancelled = false;

    async function loadHistory() {
      try {
        setHistoryLoading(true);

        const events =
          await getHistory();

        if (!cancelled) {
          setHistory(events);
        }
      } catch {
        if (!cancelled) {
          setHistory([]);
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [
    activeView,
    authenticated,
  ]);

  /* ==========================================================================
     DERIVED DATA
     ========================================================================== */

  const chartData = useMemo(
    () =>
      Object.entries(
        dashboard?.evolution
          .monthly_drift ?? {},
      ).map(
        ([month, drift]) => ({
          month,
          drift,
        }),
      ),
    [
      dashboard?.evolution
        .monthly_drift,
    ],
  );

  /* ==========================================================================
     AUTHENTICATION
     ========================================================================== */

  if (authLoading) {
    return <AuthLoading />;
  }

  if (!authenticated) {
    return (
      <>
        <AuthScreen
          youtubeConnected={isConnected(
            "youtube",
          )}
          spotifyConnected={isConnected(
            "spotify",
          )}
          onConnectYouTube={
            authService.connectYouTube
          }
          onConnectSpotify={
            handleSpotifyConnectClick
          }
          onImport={() => {
            setImportSource("youtube");
            setImportOpen(true);
            setImportResult(null);
            setImportError(null);
          }}
        />

        {renderImportModal()}

        {renderSpotifyChoiceModal()}
      </>
    );
  }

  /* ==========================================================================
     LOADING
     ========================================================================== */

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] text-white">

        <Spotlight />

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent_50%)]" />

        <div className="relative z-10 flex flex-col items-center">

          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] shadow-2xl">

            <Activity
              size={24}
              className="animate-pulse"
            />

          </div>

          <p className="text-sm text-white/50">
            Analyzing your interests...
          </p>

          <div className="mt-5 h-px w-40 overflow-hidden bg-white/10">

            <div className="h-full w-1/2 animate-[loading_1.2s_ease-in-out_infinite] bg-white" />

          </div>

        </div>
      </div>
    );
  }

  /* ==========================================================================
     ERROR
     ========================================================================== */

  if (error) {
    const notAuthenticated =
      error
        .toLowerCase()
        .includes(
          "not authenticated",
        );

    if (notAuthenticated) {
      return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-6 text-white">

          <Spotlight />

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_50%)]" />

          <BlurFade
            className="relative z-10 w-full max-w-md"
            duration={0.7}
            offset={12}
          >

            <MagicCard
              className="overflow-hidden"
              gradientColor="#262626"
              gradientOpacity={0.35}
            >

              <div className="p-8 sm:p-10">

                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-lg font-bold text-black">
                  D
                </div>

                <AnimatedGradientText className="text-[11px] uppercase tracking-[0.25em]">
                  Personal Interest Intelligence
                </AnimatedGradientText>

                <div className="mt-4">

                  <TextGenerateEffect
                    words="Discover how your interests evolve."
                    className="text-left text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
                    duration={0.35}
                  />

                </div>

                <p className="mt-5 text-sm leading-6 text-white/40">
                  Connect your accounts or
                  import your history to build
                  your personal interest timeline.
                </p>

                <div className="mt-8 space-y-3">

                  <button
                    onClick={
                      authService.connectYouTube
                    }
                    className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm transition hover:border-white/20 hover:bg-white/[0.08]"
                  >

                    <span className="flex items-center gap-3">

                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-xs text-black">
                        ▶
                      </span>

                      <span>
                        Connect YouTube
                      </span>

                    </span>

                    <ArrowUpRight
                      size={16}
                      className="text-white/30 transition group-hover:text-white"
                    />

                  </button>

                  <button
                    onClick={
                      handleSpotifyConnectClick
                    }
                    className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm transition hover:border-white/20 hover:bg-white/[0.08]"
                  >

                    <span className="flex items-center gap-3">

                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.08] text-white">
                        ●
                      </span>

                      <span>
                        Connect Spotify
                      </span>

                    </span>

                    <ArrowUpRight
                      size={16}
                      className="text-white/30 transition group-hover:text-white"
                    />

                  </button>

                </div>

                <div className="mt-8 flex items-start gap-3 border-t border-white/[0.06] pt-6">

                  <Sparkles
                    size={15}
                    className="mt-0.5 shrink-0 text-white/30"
                  />

                  <p className="text-xs leading-5 text-white/30">
                    Your history is analyzed to
                    discover patterns, topics and
                    changes in your interests.
                  </p>

                </div>

              </div>

            </MagicCard>

          </BlurFade>

          {renderImportModal()}

          {renderSpotifyChoiceModal()}

        </div>
      );
    }

    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-6 text-white">

        <Spotlight />

        <MagicCard
          className="relative z-10 w-full max-w-md"
          gradientColor="#262626"
        >

          <div className="p-8 text-center">

            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
              <Brain size={22} />
            </div>

            <h2 className="text-xl font-semibold">
              Unable to load your drift
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/40">
              {error}
            </p>

            <button
              onClick={() =>
                loadDashboard(true)
              }
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90"
            >
              <RefreshCw size={15} />
              Try again
            </button>

          </div>

        </MagicCard>

      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  /* ==========================================================================
     DATA
     ========================================================================== */

  const overview =
    dashboard.overview;

  const eventCount =
    typeof overview.events === "number"
      ? overview.events
      : Array.isArray(overview.events)
        ? (overview.events as unknown[]).length
        : Number(overview.events) || dashboard.assignments.length;

  /* ==========================================================================
     RENDER
     ========================================================================== */

  return (
    <div className="min-h-screen bg-[#050505] text-white">

      {/* GLOBAL BACKGROUND */}

      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.06),transparent_45%)]" />

      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-[1600px]">

        {/* SIDEBAR */}

        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] px-5 py-6 lg:flex">

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-bold text-black">
              D
            </div>

            <span className="text-sm font-semibold tracking-tight">
              Drifter
            </span>

          </div>

          <nav className="mt-12 space-y-1">

            <SidebarItem
              icon={<Activity size={17} />}
              label="Overview"
              active={
                activeView ===
                "overview"
              }
              onClick={() =>
                setActiveView(
                  "overview",
                )
              }
            />

            <SidebarItem
              icon={<Brain size={17} />}
              label="Interest map"
              active={
                activeView === "map"
              }
              onClick={() =>
                setActiveView("map")
              }
            />

            <SidebarItem
              icon={<TrendingUp size={17} />}
              label="Evolution"
              active={
                activeView ===
                "evolution"
              }
              onClick={() =>
                setActiveView(
                  "evolution",
                )
              }
            />

            <SidebarItem
              icon={<Clock3 size={17} />}
              label="Behavior"
              active={
                activeView ===
                "behavior"
              }
              onClick={() =>
                setActiveView(
                  "behavior",
                )
              }
            />

            <SidebarItem
              icon={<History size={17} />}
              label="History"
              active={
                activeView ===
                "history"
              }
              onClick={() =>
                setActiveView(
                  "history",
                )
              }
            />

            <SidebarItem
              icon={<Compass size={17} />}
              label="Predictor"
              active={
                activeView ===
                "prediction"
              }
              onClick={() =>
                setActiveView(
                  "prediction",
                )
              }
            />

            <SidebarItem
              icon={<Shuffle size={17} />}
              label="Correlation"
              active={
                activeView ===
                "correlation"
              }
              onClick={() =>
                setActiveView(
                  "correlation",
                )
              }
            />

            <SidebarItem
              icon={<Dna size={17} />}
              label="Interest DNA"
              active={
                activeView ===
                "dna"
              }
              onClick={() =>
                setActiveView(
                  "dna",
                )
              }
            />

          </nav>

          <div className="mt-auto border-t border-white/[0.06] pt-5">

            <div className="flex items-center gap-2 text-xs text-white/35">

              <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />

              Analytics online

            </div>

          </div>

        </aside>

        {/* MAIN */}

        <main className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-12 lg:py-10">

          {/* HERO */}

          <BlurFade
            duration={0.7}
            offset={12}
          >

            <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.025]">

              <Spotlight />

              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(255,255,255,0.05),transparent_35%)]" />

              <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-14">

                <AnimatedGradientText className="text-[10px] uppercase tracking-[0.28em]">
                  Personal Interest Intelligence
                </AnimatedGradientText>

                <div className="mt-5 max-w-4xl">

                  <TextGenerateEffect
                    words="Your interests have a trajectory."
                    className="text-left text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl"
                    duration={0.35}
                  />

                </div>

                <p className="mt-5 max-w-xl text-sm leading-7 text-white/40">
                  Drifter turns your history into
                  a map of how your attention
                  changes, connects and evolves
                  over time.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">

                  <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-white/40">

                    <span className="h-1.5 w-1.5 rounded-full bg-white" />

                    {eventCount.toLocaleString()}{" "}
                    events analyzed

                  </div>

                  <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-white/40">

                    <Brain size={12} />

                    {overview.topics} topics

                  </div>

                </div>

              </div>

            </section>

          </BlurFade>

          {/* HEADER ACTIONS */}

          <div className="mt-6 flex flex-wrap justify-end gap-2">

            <div className="mr-auto hidden items-center gap-2 md:flex">

              <ConnectionStatus
                provider="youtube"
                connected={isConnected(
                  "youtube",
                )}
                onConnect={
                  authService.connectYouTube
                }
              />

              <ConnectionStatus
                provider="spotify"
                connected={isConnected(
                  "spotify",
                )}
                onConnect={
                  handleSpotifyConnectClick
                }
              />

            </div>

            <button
              onClick={() => setWrappedOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-rose-500/10 px-4 text-xs font-semibold text-amber-300 transition hover:border-amber-400 hover:bg-amber-500/20 hover:text-white shadow-lg shadow-amber-500/5"
            >
              <Sparkles size={14} className="text-amber-400" />
              Wrapped Story
            </button>

            <button
              onClick={() => setChatOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 text-xs font-medium text-purple-200 transition hover:border-purple-400 hover:bg-purple-500/20 hover:text-white"
            >
              <Bot size={14} className="text-purple-400" />
              Ask Drifter
            </button>

            <button
              onClick={() => {
                setImportSource(
                  "youtube",
                );
                setImportOpen(true);
                setImportResult(null);
                setImportError(null);
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            >
              <Upload size={14} />
              Import history
            </button>

            <button
              onClick={authService.connectGoogleDataPortability}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            >
              <Database size={14} />
              {googleExportStatus === "IN_PROGRESS"
                ? "YouTube import running"
                : googleExportStatus === "COMPLETE" ||
                    googleExportStatus === "IMPORTED"
                  ? "YouTube history imported"
                  : googleExportStatus === "FAILED"
                    ? "Retry YouTube import"
                    : "Import YouTube history"}
            </button>

            <button
              onClick={() =>
                loadDashboard(true)
              }
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
            >

              <RefreshCw
                size={14}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh analysis

            </button>

            <button
              onClick={logout}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-medium text-white/50 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            >
              <LogOut size={14} />
              Logout
            </button>

          </div>

          {/* WORKSPACE */}

          {activeView === "overview" ? (
            <>

              <OverviewView
                dashboard={dashboard}
                history={history}
                historyLoading={
                  historyLoading
                }
                onOpenView={
                  setActiveView
                }
                onRefresh={() => loadDashboard(true)}
              />


              {/* LEGACY OVERVIEW */}

              <div className="legacy-overview">

                {/* KPI */}

                <section className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">

                  <BlurFade delay={0.05}>
                    <StatCard
                      icon={
                        <Database
                          size={17}
                        />
                      }
                      label="History events"
                      value={
                        eventCount
                      }
                    />
                  </BlurFade>

                  <BlurFade delay={0.1}>
                    <StatCard
                      icon={
                        <Brain
                          size={17}
                        />
                      }
                      label="Topics discovered"
                      value={
                        overview.topics
                      }
                    />
                  </BlurFade>

                  <BlurFade delay={0.15}>
                    <StatCard
                      icon={
                        <TrendingUp
                          size={17}
                        />
                      }
                      label="Rising interests"
                      value={
                        dashboard
                          .evolution
                          .rising.length
                      }
                    />
                  </BlurFade>

                  <BlurFade delay={0.2}>
                    <StatCard
                      icon={
                        <Activity
                          size={17}
                        />
                      }
                      label="Interest drift"
                      value={
                        overview.current_drift
                      }
                      decimals={3}
                    />
                  </BlurFade>

                </section>

                {/* INTEREST UNIVERSE */}

                <BlurFade delay={0.25}>

                  <MagicCard
                    className="relative mt-4 overflow-hidden"
                    gradientColor="#262626"
                    gradientOpacity={0.35}
                  >

                    <BorderBeam
                      size={120}
                      duration={8}
                      borderWidth={1}
                    />

                    <div className="relative z-10 p-5 sm:p-7">

                      <SectionHeader
                        eyebrow="Interest universe"
                        title="Where your attention lives"
                        description="Similar interests appear closer together."
                        icon={
                          <Brain
                            size={18}
                          />
                        }
                      />

                      <div className="mt-5 h-[400px] overflow-hidden rounded-xl border border-white/[0.05] bg-black/30">

                        <InterestMap
                          data={
                            dashboard
                              .visualizations
                              .interest_map
                          }
                        />

                      </div>

                    </div>

                  </MagicCard>

                </BlurFade>

                {/* EVOLUTION + TOPICS */}

                <section className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">

                  {/* DRIFT */}

                  <BlurFade delay={0.3}>

                    <MagicCard
                      className="h-[430px]"
                      gradientColor="#262626"
                      gradientOpacity={0.25}
                    >

                      <div className="p-5 sm:p-7">

                        <SectionHeader
                          eyebrow="Evolution"
                          title="Interest drift"
                          description="How much your interests changed month to month."
                          icon={
                            <Activity
                              size={18}
                            />
                          }
                          right={
                            <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-xs text-white/60">
                              {overview.current_drift.toFixed(
                                3,
                              )}
                            </span>
                          }
                        />

                        <div className="mt-8 h-[290px]">

                          {chartData.length >
                          0 ? (
                            <ResponsiveContainer
                              width="100%"
                              height="100%"
                            >

                              <AreaChart
                                data={
                                  chartData
                                }
                              >

                                <defs>

                                  <linearGradient
                                    id="driftGradient"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                  >

                                    <stop
                                      offset="0%"
                                      stopOpacity={
                                        0.25
                                      }
                                    />

                                    <stop
                                      offset="100%"
                                      stopOpacity={
                                        0
                                      }
                                    />

                                  </linearGradient>

                                </defs>

                                <CartesianGrid
                                  vertical={
                                    false
                                  }
                                  stroke="rgba(255,255,255,0.06)"
                                />

                                <XAxis
                                  dataKey="month"
                                  tickLine={
                                    false
                                  }
                                  axisLine={
                                    false
                                  }
                                  tick={{
                                    fill: "rgba(255,255,255,0.3)",
                                    fontSize: 10,
                                  }}
                                />

                                <YAxis
                                  tickLine={
                                    false
                                  }
                                  axisLine={
                                    false
                                  }
                                  tick={{
                                    fill: "rgba(255,255,255,0.3)",
                                    fontSize: 10,
                                  }}
                                />

                                <Tooltip
                                  contentStyle={{
                                    background:
                                      "#111",
                                    border:
                                      "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 10,
                                    color: "#fff",
                                    fontSize: 12,
                                  }}
                                />

                                <Area
                                  type="monotone"
                                  dataKey="drift"
                                  stroke="#fff"
                                  strokeWidth={1.5}
                                  fill="url(#driftGradient)"
                                />

                              </AreaChart>

                            </ResponsiveContainer>
                          ) : (
                            <EmptyState
                              title="Not enough monthly data"
                              description="Import more history to see your interest drift."
                            />
                          )}

                        </div>

                      </div>

                    </MagicCard>

                  </BlurFade>

                  {/* TOP INTERESTS */}

                  <BlurFade delay={0.35}>

                    <MagicCard
                      className="h-[430px]"
                      gradientColor="#262626"
                      gradientOpacity={0.25}
                    >

                      <div className="p-5 sm:p-7">

                        <SectionHeader
                          eyebrow="Most explored"
                          title="Top interests"
                          description="Where you've spent the most attention."
                        />

                        <div className="mt-7 space-y-5">

                          {dashboard.top_topics
                            .slice(
                              0,
                              7,
                            )
                            .map(
                              (
                                topic,
                                index,
                              ) => {

                                const max =
                                  dashboard
                                    .top_topics[0]
                                    ?.count ||
                                  1;

                                const percentage =
                                  (topic.count /
                                    max) *
                                  100;

                                return (
                                  <div
                                    key={
                                      topic.topic
                                    }
                                    className="group"
                                  >

                                    <div className="mb-2 flex items-center justify-between">

                                      <div className="flex min-w-0 items-center gap-3">

                                        <span className="w-5 font-mono text-[10px] text-white/25">
                                          {String(
                                            index +
                                              1,
                                          ).padStart(
                                            2,
                                            "0",
                                          )}
                                        </span>

                                        <span className="truncate text-sm text-white/70 transition group-hover:text-white">
                                          {
                                            topic.topic
                                          }
                                        </span>

                                      </div>

                                      <span className="ml-3 font-mono text-[11px] text-white/30">
                                        {topic.count.toLocaleString()}
                                      </span>

                                    </div>

                                    <div className="ml-8 h-1 overflow-hidden rounded-full bg-white/[0.06]">

                                      <div
                                        className="h-full rounded-full bg-white/70 transition-all duration-700 group-hover:bg-white"
                                        style={{
                                          width:
                                            `${percentage}%`,
                                        }}
                                      />

                                    </div>

                                  </div>
                                );
                              },
                            )}

                        </div>

                      </div>

                    </MagicCard>

                  </BlurFade>

                </section>

                {/* MOVEMENT */}

                <section className="mt-4 grid gap-4 md:grid-cols-3">

                  <BlurFade delay={0.4}>

                    <MovementCard
                      title="Rising"
                      description="Interests gaining momentum."
                      icon={
                        <TrendingUp
                          size={17}
                        />
                      }
                      items={
                        dashboard
                          .evolution
                          .rising
                      }
                      symbol="↑"
                    />

                  </BlurFade>

                  <BlurFade delay={0.45}>

                    <MovementCard
                      title="Fading"
                      description="Interests losing momentum."
                      icon={
                        <TrendingDown
                          size={17}
                        />
                      }
                      items={
                        dashboard
                          .evolution
                          .fading
                      }
                      symbol="↓"
                    />

                  </BlurFade>

                  <BlurFade delay={0.5}>

                    <CardSpotlight
                      className="min-h-[210px] overflow-hidden"
                      radius={220}
                      color="#262626"
                    >

                      <div className="relative z-10 p-5">

                        <div className="flex items-center justify-between">

                          <div className="flex items-center gap-3">

                            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04] text-white/45">
                              <Sparkles
                                size={17}
                              />
                            </div>

                            <div>

                              <h3 className="text-sm font-medium">
                                Emerging
                              </h3>

                              <p className="mt-0.5 text-[11px] text-white/25">
                                New interests appearing.
                              </p>

                            </div>

                          </div>

                        </div>

                        <div className="mt-6 flex flex-wrap gap-2">

                          {dashboard
                            .evolution
                            .emerging
                            .slice(
                              0,
                              8,
                            )
                            .map(
                              (
                                item,
                              ) => (

                                <span
                                  key={
                                    item.topic
                                  }
                                  className="rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white/60 transition hover:border-white/15 hover:text-white"
                                >

                                  <span className="mr-1 text-white/30">
                                    ✦
                                  </span>

                                  {
                                    item.topic
                                  }

                                  <span className="ml-2 font-mono text-white/30">
                                    {(
                                      item.share *
                                      100
                                    ).toFixed(
                                      1,
                                    )}
                                    %
                                  </span>

                                </span>

                              ),
                            )}

                          {dashboard
                            .evolution
                            .emerging
                            .length ===
                            0 && (
                            <span className="text-xs text-white/20">
                              Nothing detected yet.
                            </span>
                          )}

                        </div>

                      </div>

                    </CardSpotlight>

                  </BlurFade>

                </section>

                {/* BEHAVIOR */}

                <BlurFade delay={0.55}>

                  <MagicCard
                    className="mt-4"
                    gradientColor="#262626"
                    gradientOpacity={0.25}
                  >

                    <div className="p-5 sm:p-7">

                      <SectionHeader
                        eyebrow="Behavior"
                        title="How you explore"
                        description="Patterns discovered in your activity."
                        icon={
                          <Clock3
                            size={18}
                          />
                        }
                      />

                      <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] sm:grid-cols-3">

                        <BehaviorMetric
                          label="Rabbit holes"
                          value={
                            dashboard
                              .behavior
                              .rabbit_holes
                              .length
                          }
                        />

                        <BehaviorMetric
                          label="Topic transitions"
                          value={
                            dashboard
                              .behavior
                              .topic_transitions
                              .length
                          }
                        />

                        <BehaviorMetric
                          label="Active time periods"
                          value={
                            Object.keys(
                              dashboard
                                .behavior
                                .time_of_day,
                            ).length
                          }
                        />

                      </div>

                    </div>

                  </MagicCard>

                </BlurFade>

                {/* FOOTER */}

                <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] py-6 text-[10px] uppercase tracking-[0.15em] text-white/20">

                  <span>
                    {dashboard.cached
                      ? "Analysis cache"
                      : "Fresh analysis"}
                  </span>

                  <div className="flex gap-5">

                    <span>
                      {overview.clusters}{" "}
                      clusters
                    </span>

                    <span>
                      {overview.noise}{" "}
                      noise events
                    </span>

                  </div>

                </footer>

              </div>

            </>

          ) : (
            <div className="workspace-shell">

              {activeView ===
                "map" && (
                <MapView
                  dashboard={
                    dashboard
                  }
                  history={history}
                  historyLoading={
                    historyLoading
                  }
                  onOpenView={
                    setActiveView
                  }
                />
              )}

              {activeView ===
                "evolution" && (
                <EvolutionView
                  dashboard={
                    dashboard
                  }
                  history={history}
                  historyLoading={
                    historyLoading
                  }
                  onOpenView={
                    setActiveView
                  }
                />
              )}

              {activeView ===
                "behavior" && (
                <BehaviorView
                  dashboard={
                    dashboard
                  }
                  history={history}
                  historyLoading={
                    historyLoading
                  }
                  onOpenView={
                    setActiveView
                  }
                />
              )}

              {activeView ===
                "history" && (
                <HistoryView
                  dashboard={
                    dashboard
                  }
                  history={history}
                  historyLoading={
                    historyLoading
                  }
                  onOpenView={
                    setActiveView
                  }
                />
              )}

              {activeView ===
                "prediction" && (
                <PredictionWorkspaceView
                  source={importSource}
                />
              )}

              {activeView ===
                "correlation" && (
                <CorrelationWorkspaceView />
              )}

              {activeView ===
                "dna" && (
                <DnaWorkspaceView
                  source={importSource}
                />
              )}

            </div>
          )}

          {renderImportModal()}

          {renderSpotifyChoiceModal()}

          <HistoryChatModal
            isOpen={chatOpen}
            onClose={() =>
              setChatOpen(false)
            }
            source={importSource}
          />

          <YearInDriftModal
            isOpen={wrappedOpen}
            onClose={() =>
              setWrappedOpen(false)
            }
            source={importSource}
          />

        </main>

      </div>

    </div>
  );
}

/* ==========================================================================
   CONNECTION STATUS
   ========================================================================== */

function ConnectionStatus({
  provider,
  connected,
  onConnect,
}: {
  provider:
    | "youtube"
    | "spotify";

  connected: boolean;

  onConnect?: () => void;
}) {
  const label =
    provider === "youtube"
      ? "YouTube"
      : "Spotify";

  if (
    !connected &&
    onConnect
  ) {
    return (
      <button
        onClick={onConnect}
        className="group flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-white/20 bg-white/[0.02] px-3 py-1.5 text-xs text-white/50 transition hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-white"
        title={`Click to connect ${label}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white/30 transition group-hover:bg-emerald-400 group-hover:shadow-[0_0_8px_rgba(52,211,153,0.8)]" />

        <span className="text-[10px] font-medium">
          Connect {label}
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">

      <span
        className={`h-1.5 w-1.5 rounded-full ${
          connected
            ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
            : "bg-white/20"
        }`}
      />

      <span className="text-[10px] text-white/60">
        {label}{" "}
        {connected
          ? "connected"
          : ""}
      </span>

    </div>
  );
}

/* ==========================================================================
   SIDEBAR ITEM
   ========================================================================== */

function SidebarItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex
        w-full
        items-center
        gap-3
        rounded-xl
        px-3
        py-2.5
        text-left
        text-xs
        transition
        ${
          active
            ? "bg-white/[0.07] text-white"
            : "text-white/35 hover:bg-white/[0.04] hover:text-white/70"
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}

/* ==========================================================================
   STAT CARD
   ========================================================================== */

function StatCard({
  icon,
  label,
  value,
  decimals = 0,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  decimals?: number;
}) {
  return (
    <MagicCard
      gradientColor="#262626"
      gradientOpacity={0.3}
    >
      <div className="relative p-5">

        <div className="flex items-center justify-between">

          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04] text-white/50">
            {icon}
          </div>

          <ArrowUpRight
            size={13}
            className="text-white/15"
          />

        </div>

        <p className="mt-5 text-[10px] uppercase tracking-[0.16em] text-white/30">
          {label}
        </p>

        <div className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">

          <NumberTicker
            value={value}
            decimalPlaces={decimals}
          />

        </div>

      </div>
    </MagicCard>
  );
}

/* ==========================================================================
   SECTION HEADER
   ========================================================================== */

function SectionHeader({
  eyebrow,
  title,
  description,
  icon,
  right,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">

      <div className="flex gap-3">

        {icon && (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-white/40">
            {icon}
          </div>
        )}

        <div>

          <p className="text-[9px] uppercase tracking-[0.2em] text-white/25">
            {eyebrow}
          </p>

          <h2 className="mt-1 text-base font-medium tracking-tight">
            {title}
          </h2>

          <p className="mt-1 text-xs text-white/30">
            {description}
          </p>

        </div>

      </div>

      {right}

    </div>
  );
}

/* ==========================================================================
   MOVEMENT CARD
   ========================================================================== */

function MovementCard({
  title,
  description,
  icon,
  items,
  symbol,
}: {
  title: string;
  description: string;
  icon: ReactNode;

  items: {
    topic: string;
    change: number;
  }[];

  symbol: string;
}) {
  return (
    <MagicCard
      className="min-h-[210px]"
      gradientColor="#262626"
      gradientOpacity={0.3}
    >

      <div className="p-5">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04] text-white/45">
              {icon}
            </div>

            <div>

              <h3 className="text-sm font-medium">
                {title}
              </h3>

              <p className="mt-0.5 text-[11px] text-white/25">
                {description}
              </p>

            </div>

          </div>

        </div>

        <div className="mt-6 space-y-2">

          {items
            .slice(0, 8)
            .map((item) => (

              <div
                key={item.topic}
                className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2.5"
              >

                <span className="min-w-0 truncate text-[11px] text-white/60">

                  <span className="mr-2 text-white/30">
                    {symbol}
                  </span>

                  {item.topic}

                </span>

                <span className="ml-3 shrink-0 font-mono text-[10px] text-white/35">

                  {item.change >=
                  0
                    ? "+"
                    : ""}

                  {(
                    item.change *
                    100
                  ).toFixed(1)}
                  %

                </span>

              </div>

            ))}

          {items.length ===
            0 && (
            <span className="text-xs text-white/20">
              Nothing detected yet.
            </span>
          )}

        </div>

      </div>

    </MagicCard>
  );
}

/* ==========================================================================
   BEHAVIOR METRIC
   ========================================================================== */

function BehaviorMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="bg-[#080808] p-5">

      <p className="text-[10px] uppercase tracking-[0.15em] text-white/25">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold">

        <NumberTicker
          value={value}
        />

      </p>

    </div>
  );
}

/* ==========================================================================
   EMPTY STATE
   ========================================================================== */

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">

      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">

        <Activity
          size={16}
          className="text-white/25"
        />

      </div>

      <p className="mt-4 text-xs text-white/40">
        {title}
      </p>

      <p className="mt-1 max-w-xs text-[11px] leading-5 text-white/20">
        {description}
      </p>

    </div>
  );
}

export default App;