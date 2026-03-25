import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBotChat } from "./useBotChat";
import type { BotMessages } from "@eyeonchess/chess";

const messages: BotMessages = {
  gameStart: ["Hello!", "Let's play!"],
  onCapture: ["Got one!"],
  onCheckmate: ["I win!"],
  onCheckmated: ["GG!"],
};

describe("useBotChat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null initially", () => {
    const { result } = renderHook(() => useBotChat({ messages }));
    expect(result.current.currentMessage).toBeNull();
  });

  it("triggers a message from the correct event pool", () => {
    const { result } = renderHook(() => useBotChat({ messages, probability: 1 }));
    act(() => result.current.triggerMessage("gameStart"));
    expect(messages.gameStart).toContain(result.current.currentMessage);
  });

  it("auto-dismisses after displayMs", () => {
    const { result } = renderHook(() => useBotChat({ messages, displayMs: 2000 }));
    act(() => result.current.triggerMessage("gameStart"));
    expect(result.current.currentMessage).not.toBeNull();
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.currentMessage).toBeNull();
  });

  it("respects cooldown", () => {
    const { result } = renderHook(() => useBotChat({ messages, probability: 1, cooldownMs: 5000 }));
    act(() => result.current.triggerMessage("gameStart"));
    const first = result.current.currentMessage;
    expect(first).not.toBeNull();

    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.triggerMessage("onCapture"));
    // Should still show first message (cooldown not expired)
    expect(result.current.currentMessage).toBe(first);
  });

  it("allows message after cooldown expires", () => {
    const { result } = renderHook(() =>
      useBotChat({ messages, probability: 1, cooldownMs: 5000, displayMs: 10000 })
    );
    act(() => result.current.triggerMessage("gameStart"));
    expect(result.current.currentMessage).not.toBeNull();

    act(() => vi.advanceTimersByTime(5000));
    act(() => result.current.triggerMessage("onCapture"));
    expect(result.current.currentMessage).toBe("Got one!");
  });

  it("always shows gameStart regardless of probability", () => {
    const { result } = renderHook(() => useBotChat({ messages, probability: 0 }));
    act(() => result.current.triggerMessage("gameStart"));
    expect(result.current.currentMessage).not.toBeNull();
  });

  it("always shows onCheckmate regardless of probability", () => {
    const { result } = renderHook(() => useBotChat({ messages, probability: 0, cooldownMs: 0 }));
    act(() => result.current.triggerMessage("onCheckmate"));
    expect(result.current.currentMessage).toBe("I win!");
  });

  it("always shows onCheckmated regardless of probability", () => {
    const { result } = renderHook(() => useBotChat({ messages, probability: 0, cooldownMs: 0 }));
    act(() => result.current.triggerMessage("onCheckmated"));
    expect(result.current.currentMessage).toBe("GG!");
  });

  it("returns null for events with no messages", () => {
    const { result } = renderHook(() => useBotChat({ messages, probability: 1 }));
    act(() => result.current.triggerMessage("onBlunder"));
    expect(result.current.currentMessage).toBeNull();
  });

  it("returns null when no messages provided", () => {
    const { result } = renderHook(() => useBotChat({ probability: 1 }));
    act(() => result.current.triggerMessage("gameStart"));
    expect(result.current.currentMessage).toBeNull();
  });

  it("clearMessage resets state", () => {
    const { result } = renderHook(() => useBotChat({ messages }));
    act(() => result.current.triggerMessage("gameStart"));
    expect(result.current.currentMessage).not.toBeNull();
    act(() => result.current.clearMessage());
    expect(result.current.currentMessage).toBeNull();
  });
});
