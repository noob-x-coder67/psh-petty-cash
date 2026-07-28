"use client";

import { motion } from "motion/react";
import { usePrefersReducedMotion } from "../../lib/motion";

// Vibrant, continuously mixing color motion — built entirely from existing semantic
// tokens (royal/violet/cyan already carry their own light/dark values in tokens.css) so
// it adapts per theme automatically. Three things combine so the color is always
// visibly moving rather than settling: (1) each blob drifts/breathes on its own loop,
// (2) blobs use mix-blend-mode="screen" so overlapping colors actually blend into new
// hues instead of just stacking transparency, (3) the whole layer's hue continuously
// rotates through a restrained blue->violet->cyan range on a linear, never-pausing
// loop. All layers are aria-hidden and pointer-events-none; every animated property
// freezes to a static frame under reduced-motion rather than playing a slowed copy.
export function AnimatedBackground() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-surface-0">
      <div className="absolute inset-0 bg-linear-to-br from-royal-500/20 via-transparent to-violet-500/20" />

      <motion.div
        className="absolute inset-0"
        animate={reducedMotion ? undefined : { filter: ["hue-rotate(0deg)", "hue-rotate(45deg)", "hue-rotate(-15deg)", "hue-rotate(0deg)"] }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
      >
        <motion.div
          className="absolute -left-40 -top-40 h-128 w-lg rounded-full bg-royal-600/50 blur-3xl mix-blend-screen"
          animate={
            reducedMotion
              ? undefined
              : { x: [0, 70, -20, 40, 0], y: [0, 50, -30, 20, 0], scale: [1, 1.2, 0.92, 1.1, 1] }
          }
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-48 -right-32 h-144 w-xl rounded-full bg-violet-500/45 blur-3xl mix-blend-screen"
          animate={
            reducedMotion
              ? undefined
              : { x: [0, -60, 25, -30, 0], y: [0, -45, 25, -15, 0], scale: [1, 0.88, 1.18, 0.95, 1] }
          }
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-1/4 top-1/3 h-96 w-96 rounded-full bg-cyan-500/40 blur-3xl mix-blend-screen"
          animate={
            reducedMotion
              ? undefined
              : { x: [0, 50, -45, 30, 0], y: [0, -35, 30, -20, 0], opacity: [0.4, 0.65, 0.35, 0.55, 0.4] }
          }
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-royal-500/40 blur-3xl mix-blend-screen"
          animate={
            reducedMotion
              ? undefined
              : { x: [0, -40, 35, -20, 0], y: [0, 30, -25, 15, 0], scale: [1, 1.15, 0.9, 1.08, 1] }
          }
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-1/3 top-1/2 h-72 w-72 rounded-full bg-violet-500/35 blur-3xl mix-blend-screen"
          animate={
            reducedMotion
              ? undefined
              : { x: [0, 35, -35, 0], y: [0, -20, 25, 0], opacity: [0.35, 0.55, 0.4, 0.35] }
          }
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      {/* Warm accent — deliberately outside the hue-rotating wrapper above (a rotating
          hue would drift this off "orange" over time) and kept small/low-opacity/in one
          corner so blue stays the dominant identity, per the brief's explicit "do not
          make orange dominant." */}
      <motion.div
        className="absolute -bottom-16 right-12 h-56 w-56 rounded-full bg-amber-500/18 blur-3xl mix-blend-screen"
        animate={reducedMotion ? undefined : { x: [0, -15, 10, 0], y: [0, 12, -8, 0] }}
        transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Faint fixed particles — static, not animated, to keep the overall effect from
          becoming busy on top of the now-continuous color motion above. */}
      <div className="absolute inset-0 opacity-[0.35]">
        {PARTICLES.map((p, index) => (
          <span
            key={index}
            className="absolute h-1 w-1 rounded-full bg-royal-500"
            style={{ left: `${p.x}%`, top: `${p.y}%`, opacity: p.o }}
          />
        ))}
      </div>

      {/* Nearly-invisible grain so the deep, blurred color fields don't read as flat
          digital gradients. */}
      <div className="psh-grain absolute inset-0 opacity-[0.04]" />
    </div>
  );
}

// Fixed, deterministic positions (not Math.random()) so server- and client-rendered
// markup match exactly — avoids a hydration mismatch for purely decorative content.
const PARTICLES = [
  { x: 12, y: 18, o: 0.6 },
  { x: 78, y: 24, o: 0.4 },
  { x: 34, y: 62, o: 0.5 },
  { x: 88, y: 70, o: 0.3 },
  { x: 55, y: 12, o: 0.4 },
  { x: 20, y: 80, o: 0.5 },
  { x: 66, y: 88, o: 0.3 },
  { x: 45, y: 45, o: 0.35 },
];
