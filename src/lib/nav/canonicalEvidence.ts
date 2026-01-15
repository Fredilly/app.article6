export function canonicalEvidencePath(pathname: string, searchParams: URLSearchParams): string | null {
  if (!searchParams.toString()) return null;
  return pathname;
}
