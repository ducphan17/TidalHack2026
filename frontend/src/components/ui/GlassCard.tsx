"use client";

import { motion } from "framer-motion";
import * as React from "react";
import { Card, type CardProps } from "./card";

export const cardVariants = {
  hidden: {
    y: -100,
    opacity: 0,
  },
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    transition: {
      delay: i * 0.1,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

export interface GlassCardProps extends CardProps {
  index?: number;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className = "", index = 0, children, ...props }, ref) => (
    <motion.div
      ref={ref}
      custom={index}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
    >
      <Card
        className={`bg-black/45 backdrop-blur-sm border-0 overflow-hidden relative shadow-[0_0_2px_rgba(70,181,255,0.8)] ${className}`}
        {...props}
      >
        {children}
      </Card>
    </motion.div>
  )
);
GlassCard.displayName = "GlassCard";
