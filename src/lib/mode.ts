type QueryLike = { get: (key: string) => string | null };

export function isVerifierMode(query: QueryLike): boolean {
  return query.get("mode") === "verify";
}

export function getVerifyView(query: QueryLike): "list" | "map" {
  const view = (isVerifierMode(query) ? query.get("view") : query.get("mode")) ?? "";
  return view.trim().toLowerCase() === "map" ? "map" : "list";
}

export type VerifyView = "list" | "map";
