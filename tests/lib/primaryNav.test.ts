import { describe, expect, it } from "@jest/globals";
import { isPrimaryNavActive } from "@/lib/nav/primaryNav";

describe("isPrimaryNavActive", () => {
  it("activates Home only on /", () => {
    expect(isPrimaryNavActive("/", "home")).toBe(true);
    expect(isPrimaryNavActive("/", "quick-check")).toBe(false);
    expect(isPrimaryNavActive("/", "methods")).toBe(false);
    expect(isPrimaryNavActive("/", "projects")).toBe(false);
  });

  it("activates Quick Check only on /quick-check", () => {
    expect(isPrimaryNavActive("/quick-check", "quick-check")).toBe(true);
    expect(isPrimaryNavActive("/quick-check", "home")).toBe(false);
    expect(isPrimaryNavActive("/quick-check", "methods")).toBe(false);
    expect(isPrimaryNavActive("/quick-check", "projects")).toBe(false);
  });

  it("activates Methods on /methods and method detail routes", () => {
    expect(isPrimaryNavActive("/methods", "methods")).toBe(true);
    expect(isPrimaryNavActive("/m/VM0007/v/v1-8", "methods")).toBe(true);
    expect(isPrimaryNavActive("/methods", "projects")).toBe(false);
  });

  it("activates Projects only on saved project routes", () => {
    expect(isPrimaryNavActive("/projects", "projects")).toBe(true);
    expect(isPrimaryNavActive("/projects/proj_123", "projects")).toBe(true);
    expect(isPrimaryNavActive("/projects/new", "projects")).toBe(false);
    expect(isPrimaryNavActive("/projects", "quick-check")).toBe(false);
  });
});
