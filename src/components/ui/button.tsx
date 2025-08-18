import * as React from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", ...props }, ref) => {
    const base = "btn focus-visible:outline-2 focus-visible:outline-offset-2";
    const variantClass = variant === "secondary" ? "btn-secondary" : "";
    return (
      <button
        ref={ref}
        className={`${base} ${variantClass} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
