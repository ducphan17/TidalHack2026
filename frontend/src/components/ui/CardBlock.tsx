import * as React from "react";

export interface CardBlockProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardBlock = React.forwardRef<HTMLDivElement, CardBlockProps>(
  ({ className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={`bg-[#030B1C] backdrop-blur-sm rounded shadow-[0_0_2px_rgba(70,181,255,0.8)] border border-cyan-500/20 ${className}`}
      {...props}
    />
  )
);
CardBlock.displayName = "CardBlock";
