"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  parseDeeplinkContext,
  resolveDeeplinkContext,
  type InventoryMethodSummary,
  type ResolvedDeeplinkContext,
} from "@/lib/uiContext";

type InventoryResponse = {
  methods: InventoryMethodSummary[];
};

type State = {
  loading: boolean;
  resolved: ResolvedDeeplinkContext;
};

export default function useDeeplinkMethodVersion(): State {
  const searchParams = useSearchParams();
  const context = useMemo(() => parseDeeplinkContext(searchParams), [searchParams]);
  const [state, setState] = useState<State>({ loading: false, resolved: { warnings: [] } });
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!context.method) {
      lastKeyRef.current = null;
      setState({ loading: false, resolved: { warnings: [] } });
      return;
    }

    const key = `${context.method}@@${context.version ?? ""}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    let cancelled = false;

    (async () => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const response = await fetch("/api/methods/inventory", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Inventory request failed with ${response.status}`);
        }
        const payload = (await response.json()) as InventoryResponse;
        const resolved = resolveDeeplinkContext(context, { methods: payload.methods ?? [] });
        if (cancelled) return;
        setState({ loading: false, resolved });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setState({
          loading: false,
          resolved: {
            warnings: [`Failed to load method inventory (${message}).`],
          },
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [context]);

  return state;
}
