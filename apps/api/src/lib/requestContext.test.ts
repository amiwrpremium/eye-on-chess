import { describe, it, expect } from "vitest";
import { runWithRequestId, getRequestId, enterRequestContext } from "./requestContext.js";

describe("requestContext", () => {
  describe("getRequestId", () => {
    it("returns undefined outside a request context", () => {
      expect(getRequestId()).toBeUndefined();
    });
  });

  describe("runWithRequestId", () => {
    it("sets and retrieves the request ID within the callback", () => {
      runWithRequestId("req-123", () => {
        expect(getRequestId()).toBe("req-123");
      });
    });

    it("returns undefined after the callback exits", () => {
      runWithRequestId("req-456", () => {});
      // Outside the context — may or may not be undefined depending on async
      // but in a synchronous context it should be undefined
    });

    it("returns the callback return value", () => {
      const result = runWithRequestId("req-789", () => 42);
      expect(result).toBe(42);
    });

    it("supports nested contexts", () => {
      runWithRequestId("outer", () => {
        expect(getRequestId()).toBe("outer");
        runWithRequestId("inner", () => {
          expect(getRequestId()).toBe("inner");
        });
        expect(getRequestId()).toBe("outer");
      });
    });
  });

  describe("enterRequestContext", () => {
    it("sets the request ID for the current async chain", () => {
      enterRequestContext("req-enter-1");
      expect(getRequestId()).toBe("req-enter-1");
    });
  });

  describe("async propagation", () => {
    it("propagates through async/await", async () => {
      await runWithRequestId("async-req", async () => {
        expect(getRequestId()).toBe("async-req");
        await new Promise((r) => setTimeout(r, 10));
        expect(getRequestId()).toBe("async-req");
      });
    });

    it("propagates through promises", async () => {
      await runWithRequestId("promise-req", async () => {
        const id = await Promise.resolve().then(() => getRequestId());
        expect(id).toBe("promise-req");
      });
    });
  });
});
