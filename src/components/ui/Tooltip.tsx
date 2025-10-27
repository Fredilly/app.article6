"use client";

import { cloneElement, isValidElement, ReactElement, ReactNode, useEffect, useRef, useState } from "react";
import clsx from "clsx";

type TooltipProps = {
  children: ReactElement;
  content: ReactNode;
  delay?: number;
  placement?: "top" | "bottom" | "left" | "right";
  className?: string;
};

export function Tooltip({ children, content, delay = 150, placement = "top", className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const clearTimer = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const show = () => {
    clearTimer();
    timeoutRef.current = window.setTimeout(() => {
      setOpen(true);
      timeoutRef.current = null;
    }, delay);
  };

  const hide = () => {
    clearTimer();
    setOpen(false);
  };

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  if (!isValidElement(children)) {
    throw new Error("Tooltip expects a single valid React element child");
  }

  const enhancedChild = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      const { ref } = children as { ref?: React.Ref<HTMLElement> };
      if (typeof ref === "function") {
        ref(node);
      } else if (ref && typeof ref === "object") {
        (ref as any).current = node;
      }
    },
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
      children.props.onMouseEnter?.(event);
      show();
    },
    onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
      children.props.onMouseLeave?.(event);
      hide();
    },
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      children.props.onFocus?.(event);
      show();
    },
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      children.props.onBlur?.(event);
      hide();
    },
  });

  const positionClass = {
    top: "bottom-full left-1/2 -translate-x-1/2 -translate-y-2",
    bottom: "top-full left-1/2 -translate-x-1/2 translate-y-2",
    left: "right-full top-1/2 -translate-y-1/2 -translate-x-2",
    right: "left-full top-1/2 -translate-y-1/2 translate-x-2",
  }[placement];

  return (
    <span className={clsx("relative inline-flex", className)}>
      {enhancedChild}
      {open ? (
        <span
          role="tooltip"
          className={clsx(
            "pointer-events-none absolute z-30 max-w-xs rounded-lg bg-slate-900 px-3 py-1 text-xs font-medium text-white shadow-lg",
            positionClass,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

export default Tooltip;
