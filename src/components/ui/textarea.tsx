import * as React from "react";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", ...props }, ref) => (
    <textarea
      ref={ref}
      className={`rounded-2xl border px-3 py-2 bg-background text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
