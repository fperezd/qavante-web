"use client";

import * as React from "react";

/** ¿El usuario pidió menos movimiento? (respeta prefers-reduced-motion). */
export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduce;
}

/** Anima un número de 0 → `target` con easing (ease-out cúbico). Devuelve el
 *  valor actual. Con reduce-motion, salta directo al target (sin animar).
 *  Nivel dios: las cifras "aparecen contando", no de golpe. */
export function useCountUp(target: number, durationMs = 1100): number {
  const reduce = usePrefersReducedMotion();
  const [value, setValue] = React.useState(reduce ? target : 0);

  React.useEffect(() => {
    if (reduce || !Number.isFinite(target)) {
      setValue(target);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const from = 0;
    function tick(t: number) {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, reduce]);

  return value;
}
