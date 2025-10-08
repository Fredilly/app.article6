import { ensureEngineDefaults } from "@/lib/engine/env";

export type EngineMode = "remote" | "demo";

const ENGINE_PATH = "/query";

export function resolveEngineMode(): EngineMode {
  const defaults = ensureEngineDefaults();
  const adapter = process.env.ENGINE_ADAPTER?.toLowerCase();
  if (adapter === "demo") return "demo";
  if (adapter === "remote") return "remote";
  return defaults.engineUrl ? "remote" : "demo";
}

export function resolveEngineEndpoint(): URL {
  const defaults = ensureEngineDefaults();
  const base = defaults.engineUrl;
  const sanitizedPath = ENGINE_PATH.startsWith("/") ? ENGINE_PATH : `/${ENGINE_PATH}`;
  const trimmedBase = base.replace(/\/+$/, "");
  if (trimmedBase.endsWith(sanitizedPath)) {
    return new URL(trimmedBase);
  }
  return new URL(`${trimmedBase}${sanitizedPath}`);
}

export function buildEngineHeaders(): HeadersInit {
  ensureEngineDefaults();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const bearer = process.env.ENGINE_BEARER;
  if (bearer) headers["Authorization"] = bearer.startsWith("Bearer ") ? bearer : `Bearer ${bearer}`;
  headers["Cache-Control"] = "no-cache";
  headers["Pragma"] = "no-cache";
  return headers;
}
