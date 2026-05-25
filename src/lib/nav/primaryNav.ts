export type PrimaryNavKey = "home" | "quick-check" | "methods" | "projects";

export type PrimaryNavItem = {
  key: PrimaryNavKey;
  href: string;
  title: string;
};

export const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [
  { key: "home", href: "/", title: "Home" },
  { key: "quick-check", href: "/quick-check", title: "Quick Check" },
  { key: "methods", href: "/methods", title: "Methods" },
  { key: "projects", href: "/projects", title: "Projects" },
];

function isMethodsPath(pathname: string): boolean {
  return (
    pathname === "/methods" ||
    pathname.startsWith("/methods/") ||
    pathname === "/m" ||
    pathname.startsWith("/m/")
  );
}

function isProjectsPath(pathname: string): boolean {
  if (pathname === "/projects") return true;
  if (!pathname.startsWith("/projects/")) return false;
  return pathname !== "/projects/new";
}

export function isPrimaryNavActive(pathname: string, key: PrimaryNavKey): boolean {
  if (key === "home") return pathname === "/";
  if (key === "quick-check") return pathname === "/quick-check";
  if (key === "methods") return isMethodsPath(pathname);
  return isProjectsPath(pathname);
}
