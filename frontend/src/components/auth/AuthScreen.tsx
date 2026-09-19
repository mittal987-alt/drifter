import {
  Upload,
} from "lucide-react";

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
}

export function AuthScreen({
  youtubeConnected,
  spotifyConnected,
  onConnectYouTube,
  onConnectSpotify,
  onImport,
}: AuthScreenProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(120,119,198,0.15),transparent_40%)]" />

      <main className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16">
        {/* Badge */}
        <div className="mb-8 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/50">
          PERSONAL INTEREST INTELLIGENCE
        </div>

        {/* Hero */}
        <div className="text-center">
          <h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">
            Your interests,
            <br />

            <span className="text-white/40">
              evolving.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-white/50">
            Drifter turns your personal history into a
            living map of what you've watched, listened
            to, discovered, and explored.
          </p>
        </div>

        {/* Connections */}
        <div className="mt-12 grid w-full max-w-2xl gap-4 sm:grid-cols-2">
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

        {/* Import */}
        <button
          onClick={onImport}
          className="mt-6 flex items-center gap-2 text-sm text-white/40 transition hover:text-white"
        >
          <Upload size={15} />

          <span>
            Or import your history manually
          </span>

          <span>→</span>
        </button>

        {/* Footer */}
        <p className="mt-10 max-w-md text-center text-[11px] leading-5 text-white/20">
          You control which accounts you connect.
          Drifter only requests permission to access
          your YouTube activity for this import.
        </p>
      </main>
    </div>
  );
}