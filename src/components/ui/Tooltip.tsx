"use client";

import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

type TriggerEventHandlers = {
  onMouseEnter?: (event: React.MouseEvent) => void;
  onMouseLeave?: (event: React.MouseEvent) => void;
  onFocus?: (event: React.FocusEvent) => void;
  onBlur?: (event: React.FocusEvent) => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  "aria-describedby"?: string;
} & Record<string, unknown>;

type TooltipProps = {
  children: ReactElement<TriggerEventHandlers>;
  content: ReactNode;
  delay?: number;
};

export default function Tooltip({ children, content, delay = 150 }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const id = useId();

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clearTimer();
    timeoutRef.current = window.setTimeout(() => {
      setOpen(true);
    }, delay);
  }, [clearTimer, delay]);

  const hide = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const childProps = children.props as TriggerEventHandlers;

  const triggerProps = {
    onMouseEnter: (event: React.MouseEvent) => {
      childProps.onMouseEnter?.(event);
      if (!event.defaultPrevented) show();
    },
    onMouseLeave: (event: React.MouseEvent) => {
      childProps.onMouseLeave?.(event);
      if (!event.defaultPrevented) hide();
    },
    onFocus: (event: React.FocusEvent) => {
      childProps.onFocus?.(event);
      if (!event.defaultPrevented) show();
    },
    onBlur: (event: React.FocusEvent) => {
      childProps.onBlur?.(event);
      if (!event.defaultPrevented) hide();
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Escape") hide();
      childProps.onKeyDown?.(event);
    },
    "aria-describedby": open ? id : undefined,
  };

  return (
    <span className="relative inline-flex">
      {cloneElement(children, triggerProps)}
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 -translate-y-2 transform rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        {content}
      </span>
    </span>
  );
}
