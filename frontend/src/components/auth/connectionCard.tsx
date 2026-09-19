import type { ReactNode } from "react";

interface ConnectionCardProps {
  icon: ReactNode;
  name: string;
  description: string;
  connected?: boolean;
  onConnect: () => void;
}

export function ConnectionCard({
  icon,
  name,
  description,
  connected = false,
  onConnect,
}: ConnectionCardProps) {
  return (
    <button
      onClick={onConnect}
      disabled={connected}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left transition hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-default"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
          {icon}
        </div>

        {connected ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Connected
          </div>
        ) : (
          <span className="text-xs text-white/30">
            CONNECT
          </span>
        )}
      </div>

      <h2 className="mt-5 text-lg font-medium text-white">
        {name}
      </h2>

      <p className="mt-2 text-sm leading-6 text-white/40">
        {description}
      </p>
    </button>
  );
}