// Renders an animated SVG border that drains linearly from full to empty
// over [totalDuration] seconds, synced to an absolute wall-clock [deadline].
// Place this inside a `relative` container — it overlays the container exactly.

import { useState, useEffect } from "react";

interface Props {
  /** Ref to the container element the border should wrap. */
  containerRef: { current: HTMLElement | null };
  /** Unix ms timestamp when the timer expires; null hides the border. */
  deadline: number | null;
  /** Total duration of the timer in seconds (used to compute progress). */
  totalDuration: number;
  /** CSS color for the border stroke. Defaults to the accent color. */
  color?: string;
  /** Stroke width in pixels. Defaults to 3. */
  strokeWidth?: number;
}

export function TimerBorder({ containerRef, deadline, totalDuration, color = "var(--color-game-accent)", strokeWidth = 3 }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [dashOffset, setDashOffset] = useState(0);
  const [transitionDuration, setTransitionDuration] = useState(0);

  // Keep size in sync with the container via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ width: el.offsetWidth, height: el.offsetHeight });
    });
    ro.observe(el);
    setSize({ width: el.offsetWidth, height: el.offsetHeight });
    return () => ro.disconnect();
  }, [containerRef]);

  // Compute the SVG perimeter for a rounded-2xl rect (rx = 16px)
  const inset = strokeWidth / 2;
  const rx = 16;
  const rw = Math.max(0, size.width - strokeWidth);
  const rh = Math.max(0, size.height - strokeWidth);
  const perimeter = rw > 0 && rh > 0 ? 2 * (rw + rh) + rx * (2 * Math.PI - 8) : 0;

  // Snap to the wall-clock-correct drain position then kick off a CSS transition
  // to the fully-drained state. Re-syncing on visibilitychange prevents drift
  // when the browser throttles background tabs.
  useEffect(() => {
    if (!deadline || perimeter === 0) return;

    let raf1: number, raf2: number;

    function syncAnimation() {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);

      const remaining = Math.max(0, (deadline! - Date.now()) / 1000);
      const startOffset = perimeter * (1 - remaining / totalDuration);

      // Snap with no transition, then start draining
      setTransitionDuration(0);
      setDashOffset(startOffset);

      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setTransitionDuration(remaining);
          setDashOffset(perimeter);
        });
      });
    }

    syncAnimation();

    function handleVisibilityChange() {
      if (!document.hidden) syncAnimation();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [deadline, perimeter, totalDuration]);

  if (perimeter === 0 || !deadline) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={size.width}
      height={size.height}
    >
      <rect
        x={inset}
        y={inset}
        width={rw}
        height={rh}
        rx={rx}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={perimeter}
        strokeDashoffset={dashOffset}
        style={{ transition: `stroke-dashoffset ${transitionDuration}s linear` }}
      />
    </svg>
  );
}
