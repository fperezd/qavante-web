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

/** Anima un número → `target` con easing (ease-out cúbico). Devuelve el valor
 *  actual. El primer montaje cuenta desde 0 ("aparecen contando"); cambios
 *  posteriores de `target` INTERPOLAN desde el valor actual, no reinician a 0
 *  (evita el parpadeo a $0 en cada refetch). Con reduce-motion, salta al target. */
export function useCountUp(target: number, durationMs = 1100): number {
  const reduce = usePrefersReducedMotion();
  const [value, setValue] = React.useState(reduce ? target : 0);
  // Espejo del valor mostrado, para arrancar la próxima animación desde acá.
  const valueRef = React.useRef(value);

  React.useEffect(() => {
    if (reduce || !Number.isFinite(target)) {
      valueRef.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const from = valueRef.current; // desde el valor actual, no siempre 0
    function tick(t: number) {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (target - from) * eased;
      valueRef.current = p < 1 ? next : target;
      setValue(valueRef.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, reduce]);

  return value;
}
