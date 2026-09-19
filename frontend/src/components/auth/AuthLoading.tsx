import { Loader2 } from "lucide-react";

export function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
      <div className="flex items-center gap-3 text-sm text-white/50">
        <Loader2
          size={18}
          className="animate-spin"
        />

        <span>
          Checking your session...
        </span>
      </div>
    </div>
  );
}