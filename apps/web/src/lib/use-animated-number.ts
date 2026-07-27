"use client";

import { animate } from "motion/react";
import { useEffect, useRef, useState } from "react";

// SRS §12.2: "Animated number counters on first load." Interpolates the raw numeric
// value only — formatting (PKR, commas, tabular figures) still goes entirely through
// <Money /> at render time, this hook never formats anything itself.
export function useAnimatedNumber(target: number, reducedMotion: boolean): number {
  const [value, setValue] = useState(reducedMotion ? target : 0);
  const previousTarget = useRef(reducedMotion ? target : 0);

  useEffect(() => {
    if (reducedMotion) {
      setValue(target);
      previousTarget.current = target;
      return;
    }
    const controls = animate(previousTarget.current, target, {
      duration: 0.6,
      onUpdate: setValue,
    });
    previousTarget.current = target;
    return () => controls.stop();
  }, [target, reducedMotion]);

  return value;
}
