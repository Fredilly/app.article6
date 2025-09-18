import { QueryResponseSchema, type QueryResponse } from "./schema";

function buildErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === "object" && "error" in data) {
    const value = (data as { error?: unknown }).error;
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return `HTTP ${status}`;
}

export async function sendQuery(query: string, init?: RequestInit): Promise<QueryResponse> {
  const params = new URLSearchParams({ text: query });
  const res = await fetch(`/api/query?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    ...init
  });

  const raw = await res.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch (error) {
      throw new Error("Invalid JSON response from API route");
    }
  }

  if (!res.ok) {
    throw new Error(buildErrorMessage(data, res.status));
  }

  const parsed = QueryResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Unexpected response shape from API route");
  }

  return parsed.data;
}
