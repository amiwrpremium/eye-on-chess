import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BotChatBubble from "./BotChatBubble";

describe("BotChatBubble", () => {
  it("renders nothing when message is null", () => {
    const { container } = render(<BotChatBubble message={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders message text when provided", () => {
    render(<BotChatBubble message="Hello there!" />);
    expect(screen.getByText("Hello there!")).toBeInTheDocument();
  });

  it("updates message text when prop changes", () => {
    const { rerender } = render(<BotChatBubble message="First" />);
    expect(screen.getByText("First")).toBeInTheDocument();
    rerender(<BotChatBubble message="Second" />);
    expect(screen.getByText("Second")).toBeInTheDocument();
  });
});
