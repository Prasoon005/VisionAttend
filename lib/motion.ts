import type { Transition, Variants } from 'motion/react';

/**
 * Motion presets. Every animation in the app picks from these so timing feels
 * consistent. `MotionConfig reducedMotion="user"` (in Providers) turns
 * transform animations off for people who ask their OS for reduced motion.
 */
export const transitions = {
  /** Snappy UI feedback: buttons, toggles, small popovers. */
  fast: { duration: 0.15, ease: [0.2, 0, 0, 1] },
  /** Default for entering content. */
  base: { duration: 0.3, ease: [0.2, 0, 0, 1] },
  /** Physical feel for things that move a long way (sheets, success bursts). */
  spring: { type: 'spring', stiffness: 380, damping: 30 },
} satisfies Record<string, Transition>;

export const variants = {
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: transitions.base },
  },
  slideUp: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: transitions.base },
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1, transition: transitions.spring },
  },
} satisfies Record<string, Variants>;

/** Parent variant that reveals its children one after another. */
export function stagger(delayChildren = 0, staggerChildren = 0.06): Variants {
  return { hidden: {}, visible: { transition: { delayChildren, staggerChildren } } };
}
