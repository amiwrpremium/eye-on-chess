import { describe, it, expect, vi, beforeAll } from "vitest";

// Set JWT_SECRET before importing the module
vi.stubEnv("JWT_SECRET", "test-secret-for-testing-only");

// Dynamic import after env is set
let signAccessToken: typeof import("./jwt.js").signAccessToken;
let verifyAccessToken: typeof import("./jwt.js").verifyAccessToken;
let generateRefreshToken: typeof import("./jwt.js").generateRefreshToken;
let hashToken: typeof import("./jwt.js").hashToken;

beforeAll(async () => {
  const mod = await import("./jwt.js");
  signAccessToken = mod.signAccessToken;
  verifyAccessToken = mod.verifyAccessToken;
  generateRefreshToken = mod.generateRefreshToken;
  hashToken = mod.hashToken;
});

describe("JWT utilities", () => {
  const payload = {
    userId: "test-user-id",
    email: "test@example.com",
    username: "testuser",
    role: "USER",
  };

  describe("signAccessToken / verifyAccessToken", () => {
    it("should sign and verify a token", () => {
      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.username).toBe(payload.username);
      expect(decoded.role).toBe(payload.role);
    });

    it("should produce a string token", () => {
      const token = signAccessToken(payload);
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });

    it("should throw on invalid token", () => {
      expect(() => verifyAccessToken("invalid.token.here")).toThrow();
    });

    it("should throw on tampered token", () => {
      const token = signAccessToken(payload);
      const tampered = token.slice(0, -5) + "XXXXX";
      expect(() => verifyAccessToken(tampered)).toThrow();
    });

    it("should include iat and exp claims", () => {
      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token) as Record<string, unknown>;
      expect(decoded).toHaveProperty("iat");
      expect(decoded).toHaveProperty("exp");
    });
  });

  describe("generateRefreshToken", () => {
    it("should generate a hex string", () => {
      const token = generateRefreshToken();
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it("should generate 80-character token (40 bytes)", () => {
      const token = generateRefreshToken();
      expect(token).toHaveLength(80);
    });

    it("should generate unique tokens", () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateRefreshToken()));
      expect(tokens.size).toBe(100);
    });
  });

  describe("hashToken", () => {
    it("should produce a consistent hash", () => {
      const hash1 = hashToken("test-token");
      const hash2 = hashToken("test-token");
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different inputs", () => {
      const hash1 = hashToken("token-a");
      const hash2 = hashToken("token-b");
      expect(hash1).not.toBe(hash2);
    });

    it("should produce a 64-character hex string (SHA-256)", () => {
      const hash = hashToken("test");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
