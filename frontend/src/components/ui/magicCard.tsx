import type {
  ReactNode,
} from "react";


interface MagicCardProps {
  children: ReactNode;
  className?: string;
}


export default function MagicCard({
  children,
  className = "",
}: MagicCardProps) {

  return (
    <div
      className={`
        group
        relative
        overflow-hidden
        rounded-2xl
        border
        border-white/[0.08]
        bg-white/[0.035]
        backdrop-blur-xl
        transition-all
        duration-300
        hover:border-white/[0.15]
        hover:bg-white/[0.05]
        ${className}
      `}
    >

      {/* Hover glow */}

      <div
        className="
          pointer-events-none
          absolute
          -inset-px
          rounded-2xl
          opacity-0
          transition-opacity
          duration-300
          group-hover:opacity-100
          bg-[radial-gradient(
            circle_at_50%_0%,
            rgba(255,255,255,0.10),
            transparent_55%
          )]
        "
      />

      <div className="relative">
        {children}
      </div>

    </div>
  );
}