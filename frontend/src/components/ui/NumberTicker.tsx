import { useEffect, useState } from "react";

interface NumberTickerProps {
  value: number;
  duration?: number;
  decimals?: number;
}

export default function NumberTicker({
  value,
  duration = 800,
  decimals = 0,
}: NumberTickerProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = performance.now();

    const animate = (time: number) => {
      const progress = Math.min(
        (time - start) / duration,
        1,
      );

      const eased =
        1 - Math.pow(1 - progress, 3);

      setDisplay(
        value * eased,
      );

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <span>
      {display.toLocaleString(
        undefined,
        {
          maximumFractionDigits: decimals,
          minimumFractionDigits: decimals,
        },
      )}
    </span>
  );
}