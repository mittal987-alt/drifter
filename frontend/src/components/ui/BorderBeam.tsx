interface BorderBeamProps {
  className?: string;
}


export default function BorderBeam({
  className = "",
}: BorderBeamProps) {

  return (
    <div
      className={`
        pointer-events-none
        absolute
        inset-0
        overflow-hidden
        rounded-2xl
        ${className}
      `}
    >

      <div
        className="
          absolute
          -left-[20%]
          top-0
          h-px
          w-[40%]
          bg-gradient-to-r
          from-transparent
          via-white
          to-transparent
          opacity-60
          animate-[border-beam_5s_linear_infinite]
        "
      />

    </div>
  );
}