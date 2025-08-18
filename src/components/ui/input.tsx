import * as React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`rounded-2xl border px-3 py-2 bg-background text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
      {...props}
    />
  )
);
Input.displayName = "Input";
