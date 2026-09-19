import { cn } from "@/lib/utils";

interface ParticlesProps {
  id?: string;
  className?: string;
  background?: string;
  particleColor?: string;
}

export function SparklesCore({
  id,
  className,
  background,
  particleColor = "#ffffff",
}: ParticlesProps) {
  return (
    <div
      id={id}
      aria-hidden="true"
      className={cn("pointer-events-none overflow-hidden", className)}
      style={{
        backgroundColor: background,
        backgroundImage: `radial-gradient(circle, ${particleColor} 1px, transparent 1px)`,
        backgroundSize: "26px 26px",
        opacity: 0.35,
      }}
    />
  );
}
