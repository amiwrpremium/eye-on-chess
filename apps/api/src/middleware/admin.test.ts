import { describe, it, expect } from "vitest";
import { generateCsrfToken, sanitizeString } from "./admin.js";

describe("generateCsrfToken", () => {
  it("should generate a hex string", () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[a-f0-9]+$/);
  });

  it("should generate 64-character token (32 bytes)", () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(64);
  });

  it("should generate unique tokens", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateCsrfToken()));
    expect(tokens.size).toBe(50);
  });
});

describe("sanitizeString", () => {
  it("should remove HTML tags", () => {
    expect(sanitizeString("<script>alert(1)</script>")).toBe("scriptalert(1)/script");
  });

  it("should remove angle brackets", () => {
    expect(sanitizeString("hello <world>")).toBe("hello world");
  });

  it("should remove javascript: protocol", () => {
    expect(sanitizeString("javascript:alert(1)")).toBe("alert(1)");
  });

  it("should remove inline event handlers", () => {
    expect(sanitizeString("onerror=alert(1)")).toBe("alert(1)");
    expect(sanitizeString("onclick=evil()")).toBe("evil()");
  });

  it("should trim whitespace", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
  });

  it("should handle normal strings unchanged", () => {
    expect(sanitizeString("My Chess Server")).toBe("My Chess Server");
  });

  it("should handle empty string", () => {
    expect(sanitizeString("")).toBe("");
  });

  it("should be case-insensitive for javascript:", () => {
    expect(sanitizeString("JavaScript:void(0)")).toBe("void(0)");
  });
});
