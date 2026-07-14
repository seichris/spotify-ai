import { describe, expect, it } from "vitest";
import { getSafeLoginRedirect } from "@/lib/loginRedirect";

describe("getSafeLoginRedirect", () => {
  it("allows an app-local path", () => {
    expect(getSafeLoginRedirect("/recommendation-stats")).toBe(
      "/recommendation-stats",
    );
  });

  it.each([
    undefined,
    "https://example.com",
    "//example.com",
    "/\\example.com",
    ["/recommendation-stats", "/"],
  ])("falls back to the home page for an unsafe value", (value) => {
    expect(getSafeLoginRedirect(value)).toBe("/");
  });
});
