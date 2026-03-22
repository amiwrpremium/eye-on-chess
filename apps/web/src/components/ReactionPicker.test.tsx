import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ReactionPicker from "./ReactionPicker";

describe("ReactionPicker", () => {
  it("renders 6 reaction buttons", () => {
    render(<ReactionPicker onReact={() => {}} disabled={false} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(6);
  });

  it("clicking a button calls onReact with the reaction type", () => {
    const onReact = vi.fn();
    render(<ReactionPicker onReact={onReact} disabled={false} />);
    const buttons = screen.getAllByRole("button");
    // Click the first button (good_move)
    fireEvent.click(buttons[0]);
    expect(onReact).toHaveBeenCalledOnce();
    expect(onReact).toHaveBeenCalledWith("good_move");
  });

  it("calls onReact with correct type for each button", () => {
    const onReact = vi.fn();
    render(<ReactionPicker onReact={onReact} disabled={false} />);
    const buttons = screen.getAllByRole("button");
    const expectedTypes = ["good_move", "brilliant", "blunder", "thinking", "gg", "takeback"];

    buttons.forEach((btn, i) => {
      fireEvent.click(btn);
      expect(onReact).toHaveBeenLastCalledWith(expectedTypes[i]);
    });
    expect(onReact).toHaveBeenCalledTimes(6);
  });

  it("buttons are disabled when disabled=true", () => {
    render(<ReactionPicker onReact={() => {}} disabled={true} />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it("buttons have title attributes with labels", () => {
    render(<ReactionPicker onReact={() => {}} disabled={false} />);
    const buttons = screen.getAllByRole("button");
    const expectedLabels = [
      "Good Move!",
      "Brilliant!",
      "Blunder!",
      "Hmm...",
      "GG",
      "Take it back!",
    ];
    buttons.forEach((btn, i) => {
      expect(btn).toHaveAttribute("title", expectedLabels[i]);
    });
  });
});
