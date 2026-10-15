'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { stagger, variants } from '@/lib/motion';

type Preset = keyof typeof variants;

/** Animates its content in once, using one of the shared presets. */
export function Reveal({
  children,
  preset = 'slideUp',
  className,
}: {
  children: ReactNode;
  preset?: Preset;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={variants[preset]}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

/** Reveals each <StaggerItem> child one after another. */
export function Stagger({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div className={className} variants={stagger(delay)} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={variants.slideUp}>
      {children}
    </motion.div>
  );
}
