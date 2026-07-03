/**
 * Framer Motion variant library for Rathinam MyDayOne
 *
 * All animation values are aligned with the "house style" easing defined in
 * tailwind.config.ts and globals.css. Import these variants instead of
 * writing inline animation props — keeps motion consistent across the app.
 *
 * Reduced-motion: Framer Motion reads prefers-reduced-motion automatically
 * when using `useReducedMotion()`. Wrap variants with `shouldReduceMotion`
 * where needed, or use the `motionSafe` helper below.
 */

import type { Variants, Transition } from "framer-motion";

// ── House-style easings (match tailwind.config.ts) ─────────────────────────

export const ease = {
  brand:    [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
  brandOut: [0.22, 0.61, 0.36, 1.00] as [number, number, number, number],
  brandIn:  [0.55, 0.06, 0.68, 0.19] as [number, number, number, number],
  spring:   { type: "spring" as const, stiffness: 300, damping: 26, mass: 0.8 },
};

// ── Base transitions ───────────────────────────────────────────────────────

export const transitions = {
  fast:     { duration: 0.2,  ease: ease.brandOut } satisfies Transition,
  default:  { duration: 0.28, ease: ease.brand    } satisfies Transition,
  slow:     { duration: 0.45, ease: ease.brandOut } satisfies Transition,
  spring:   ease.spring,
  stagger:  (i: number) => ({ delay: i * 0.06, duration: 0.28, ease: ease.brandOut }),
};

// ── Page / Step transitions ────────────────────────────────────────────────

/** Slide pages left (forward) or right (back) */
export function stepVariants(direction: 1 | -1): Variants {
  return {
    enter: {
      x: direction * 40,
      opacity: 0,
    },
    center: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.32, ease: ease.brandOut },
    },
    exit: {
      x: direction * -40,
      opacity: 0,
      transition: { duration: 0.22, ease: ease.brandIn },
    },
  };
}

// ── Fade variants ──────────────────────────────────────────────────────────

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.default },
  exit:    { opacity: 0, transition: transitions.fast },
};

export const fadeSlideUp: Variants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: transitions.default },
  exit:    { opacity: 0, y: -8, transition: transitions.fast },
};

export const fadeSlideDown: Variants = {
  hidden:  { opacity: 0, y: -16 },
  visible: { opacity: 1, y: 0, transition: transitions.default },
  exit:    { opacity: 0, y: 8, transition: transitions.fast },
};

// ── List / stagger container ───────────────────────────────────────────────

export const listContainer: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

export const listItem: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: transitions.default },
};

// ── Micro-interactions ─────────────────────────────────────────────────────

/** Gentle shake for validation error */
export const shakeVariants: Variants = {
  idle:   { x: 0 },
  shake:  {
    x: [0, -5, 5, -4, 4, -2, 2, 0],
    transition: { duration: 0.5, ease: "easeInOut" },
  },
};

/** Input focus ring expand */
export const inputFocus: Variants = {
  unfocused: { boxShadow: "0 0 0 0px rgba(78,154,47,0)" },
  focused:   { boxShadow: "0 0 0 3px rgba(78,154,47,0.15)", transition: transitions.fast },
};

/** Validation success checkmark */
export const checkmarkVariants: Variants = {
  hidden:  { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { pathLength: { duration: 0.35, ease: ease.brandOut }, opacity: { duration: 0.1 } },
  },
};

// ── Progress bar ───────────────────────────────────────────────────────────

export const progressBar = (pct: number) => ({
  initial: { width: "0%" },
  animate: {
    width: `${pct}%`,
    transition: { duration: 0.7, ease: ease.brandOut },
  },
});

// ── Signature ─────────────────────────────────────────────────────────────

export const signatureConfirm: Variants = {
  signing:   { scale: 1,    opacity: 1,   filter: "blur(0px)" },
  confirmed: {
    scale: [1, 0.97, 1],
    opacity: [1, 0.85, 1],
    filter: ["blur(0px)", "blur(1px)", "blur(0px)"],
    transition: { duration: 0.55, ease: ease.brand },
  },
};

// ── Upload states ──────────────────────────────────────────────────────────

export const uploadOverlay: Variants = {
  idle:       { opacity: 0, scale: 0.97 },
  uploading:  { opacity: 1, scale: 1, transition: transitions.fast },
  success:    { opacity: 1, scale: 1 },
};

export const uploadSuccess: Variants = {
  hidden:  { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: ease.spring,
  },
};

// ── Section completion ─────────────────────────────────────────────────────

export const sectionComplete: Variants = {
  hidden:  { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { ...ease.spring, delay: 0.1 },
  },
};

// ── Final submission (finish-line) ─────────────────────────────────────────

export const finishLineContainer: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.14, delayChildren: 0.2 },
  },
};

export const finishLineItem: Variants = {
  hidden:  { opacity: 0, y: 24, scale: 0.92 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.5, ease: ease.brandOut },
  },
};

// ── Admin stat count-up animation ──────────────────────────────────────────

export const statCountUp: Variants = {
  hidden:  { opacity: 0, y: 10 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.4, ease: ease.brandOut },
  },
};

// ── Modal / overlay ────────────────────────────────────────────────────────

export const backdropVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: transitions.fast },
  exit:    { opacity: 0, transition: transitions.fast },
};

export const modalVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.95, y: 16 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { duration: 0.28, ease: ease.brandOut } },
  exit:    { opacity: 0, scale: 0.97, y: 8,  transition: transitions.fast },
};
