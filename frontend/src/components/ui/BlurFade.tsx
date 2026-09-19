import type { ReactNode } from "react";

interface BlurFadeProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export default function BlurFade({
  children,
  delay = 0,
  className = "",
}: BlurFadeProps) {
  return (
    <div
      className={`
        animate-[blur-fade_0.7s_ease-out_both]
        ${className}
      `}
      style={{
        animationDelay: `${delay}s`,
      }}
    >
      {children}
    </div>
  );
}