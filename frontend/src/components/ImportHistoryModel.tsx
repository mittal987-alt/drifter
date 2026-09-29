import {
  useRef,
  useState,
} from "react";

import {
  CheckCircle2,
  FileUp,
  Loader2,
  Upload,
  X,
} from "lucide-react";

import {
  importHistory,
  type HistorySource,
} from "../services/history";

interface ImportHistoryModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function ImportHistoryModal({
  open,
  onClose,
  onImported,
}: ImportHistoryModalProps) {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [source, setSource] =
    useState<HistorySource>("youtube");

  const [file, setFile] =
    useState<File | null>(null);

  const [uploading, setUploading] =
    useState(false);

  const [result, setResult] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  if (!open) {
    return null;
  }

  function handleFile(
    selectedFile?: File,
  ) {
    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);
    setResult(null);
    setError(null);
  }

  async function handleImport() {
    if (!file) {
      setError("Please choose a history file.");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setResult(null);

      const response =
        await importHistory(
          file,
          source,
        );

      setResult(
        `${response.imported.toLocaleString()} events imported` +
          (response.skipped
            ? ` · ${response.skipped.toLocaleString()} skipped`
            : ""),
      );

      onImported();
    } catch (err) {
      let message =
        "Failed to import history.";

      if (axiosErrorMessage(err)) {
        message = axiosErrorMessage(err) ?? message;
      }

      setError(message);
    } finally {
      setUploading(false);
    }
  }

  function handleClose() {
    if (uploading) {
      return;
    }

    setFile(null);
    setResult(null);
    setError(null);
    onClose();
  }

  return (
    <div
      className="
        fixed inset-0 z-50
        flex items-center justify-center
        bg-black/70
        px-4
        backdrop-blur-sm
      "
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="
          relative
          w-full max-w-lg
          overflow-hidden
          rounded-2xl
          border border-white/10
          bg-[#0b0b0b]
          shadow-2xl
        "
      >
        {/* HEADER */}

        <div
          className="
            flex items-center justify-between
            border-b border-white/[0.06]
            px-6 py-5
          "
        >
          <div>
            <p
              className="
                text-[10px]
                font-medium
                uppercase
                tracking-[0.25em]
                text-white/30
              "
            >
              File-based import
            </p>

            <h2 className="mt-1 text-lg font-semibold">
              Import your history
            </h2>

            <p className="mt-1 text-xs text-white/35">
              Upload exported CSV or JSON files. Use Extension Sync or OAuth for real-time tracking.
            </p>
          </div>

          <button
            onClick={handleClose}
            disabled={uploading}
            className="
              rounded-lg
              p-2
              text-white/40
              transition
              hover:bg-white/[0.06]
              hover:text-white
            "
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

            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "youtube", label: "YouTube", sub: "Watch history" },
                { id: "spotify", label: "Spotify", sub: "Listening history" },
                { id: "github", label: "GitHub", sub: "Star / repo events" },
                { id: "reddit", label: "Reddit", sub: "Saved & upvoted" },
                { id: "netflix", label: "Netflix", sub: "Viewing history" },
                { id: "steam", label: "Steam", sub: "Game library" },
                { id: "twitter", label: "X / Twitter", sub: "Archive export" },
                { id: "browser", label: "Web Browsing", sub: "History export" },
              ] as const).map(({ id, label, sub }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSource(id as HistorySource)}
                  className={`
                    rounded-xl
                    border
                    px-3 py-2.5
                    text-left
                    transition
                    ${
                      source === id
                        ? "border-white/20 bg-white/[0.08]"
                        : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                    }
                  `}
                >
                  <div className="text-xs font-medium">
                    {label}
                  </div>

                  <div className="mt-0.5 text-[10px] text-white/30">
                    {sub}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* FILE DROP */}

          <button
            type="button"
            disabled={uploading}
            onClick={() =>
              fileInputRef.current?.click()
            }
            className="
              group
              flex w-full
              flex-col
              items-center
              justify-center
              rounded-2xl
              border
              border-dashed
              border-white/10
              bg-white/[0.02]
              px-6 py-10
              text-center
              transition
              hover:border-white/20
              hover:bg-white/[0.04]
            "
          >
            <div
              className="
                flex h-12 w-12
                items-center justify-center
                rounded-xl
                border border-white/10
                bg-white/[0.05]
                transition
                group-hover:bg-white/[0.08]
              "
            >
              {file ? (
                <FileUp size={20} />
              ) : (
                <Upload size={20} />
              )}
            </div>

            {file ? (
              <>
                <p className="mt-4 text-sm font-medium">
                  {file.name}
                </p>

                <p className="mt-1 text-xs text-white/30">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </>
            ) : (
              <>
                <p className="mt-4 text-sm font-medium">
                  Choose history file
                </p>

                <p className="mt-1 text-xs text-white/30">
                  {source === "youtube" ? "JSON, ZIP, or HTML (Google Takeout)" :
                   source === "spotify" ? "CSV (Extended streaming history)" :
                   source === "twitter" ? "HTML or JSON (Twitter archive)" :
                   source === "github" ? "JSON export" :
                   source === "reddit" ? "CSV export" :
                   source === "netflix" ? "CSV (NetflixViewingHistory.csv)" :
                   source === "steam" ? "JSON (Steam API export)" :
                   "JSON or CSV"}
                </p>
              </>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.zip,.html,.htm,application/json,text/csv,text/html"
            className="hidden"
            onChange={(event) =>
              handleFile(
                event.target.files?.[0],
              )
            }
          />

          {/* Export guide tip */}
          {!file && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] text-white/40 leading-relaxed">
              {source === "youtube" && (
                <>📦 Get your YouTube history at <a href="https://takeout.google.com" target="_blank" rel="noreferrer" className="underline text-white/60 hover:text-white">takeout.google.com</a> — select &ldquo;YouTube and YouTube Music&rdquo; → History.</>  
              )}
              {source === "spotify" && (
                <>📦 Request at <a href="https://www.spotify.com/account/privacy/" target="_blank" rel="noreferrer" className="underline text-white/60 hover:text-white">spotify.com/account/privacy</a> → Download your data → Extended streaming history (JSON/CSV).</>  
              )}
              {source === "twitter" && (
                <>📦 Request your archive at <a href="https://twitter.com/settings/download_your_data" target="_blank" rel="noreferrer" className="underline text-white/60 hover:text-white">Settings → Your Account → Download archive</a>. Upload the <code className="text-white/70">tweet.js</code> or HTML files.</>  
              )}
              {source === "netflix" && (
                <>📦 Download at <a href="https://www.netflix.com/account/getmyinfo" target="_blank" rel="noreferrer" className="underline text-white/60 hover:text-white">netflix.com/account</a> → &ldquo;Get my info&rdquo; → ViewingActivity. Upload <code className="text-white/70">NetflixViewingHistory.csv</code>.</>  
              )}
              {source === "reddit" && (
                <>📦 Or use the <strong className="text-white/60">Drifter Extension</strong> which auto-tracks Reddit threads you browse — zero CSV setup needed.</>  
              )}
              {source === "github" && (
                <>📦 Or use <strong className="text-white/60">1-Click GitHub OAuth</strong> in the Platform Hub to import starred repos automatically — no file needed.</>  
              )}
              {source === "steam" && (
                <>📦 Or use the <strong className="text-white/60">Steam API Key</strong> import in the Platform Hub — no file needed, just your API key &amp; Steam ID.</>  
              )}
              {source === "browser" && (
                <>📦 Or install the <strong className="text-white/60">Drifter Extension</strong> to automatically capture your web browsing history in real-time.</>  
              )}
            </div>
          )}

          {/* SUCCESS */}

          {result && (
            <div
              className="
                flex items-center gap-3
                rounded-xl
                border border-white/10
                bg-white/[0.04]
                px-4 py-3
              "
            >
              <CheckCircle2
                size={17}
              />

              <span className="text-xs text-white/70">
                {result}
              </span>
            </div>
          )}

          {/* ERROR */}

          {error && (
            <div
              className="
                rounded-xl
                border border-red-500/20
                bg-red-500/[0.05]
                px-4 py-3
                text-xs
                text-red-300
              "
            >
              {error}
            </div>
          )}

          {/* IMPORT */}

          <button
            type="button"
            disabled={!file || uploading}
            onClick={handleImport}
            className="
              flex w-full
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-white
              px-4 py-3
              text-sm
              font-medium
              text-black
              transition
              hover:bg-white/90
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            {uploading ? (
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

function axiosErrorMessage(
  error: unknown,
): string | null {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return null;
  }

  const candidate =
    error as {
      response?: {
        data?: {
          detail?: unknown;
        };
      };
      message?: unknown;
    };

  const detail =
    candidate.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === "object" &&
        item !== null &&
        "msg" in item
          ? String(
              (item as { msg: unknown }).msg,
            )
          : String(item),
      )
      .join(", ");
  }

  if (
    typeof candidate.message === "string"
  ) {
    return candidate.message;
  }

  return null;
}