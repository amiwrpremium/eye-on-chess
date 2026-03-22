import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import KeyboardShortcutsHelp from "./KeyboardShortcutsHelp";

const shortcuts = [
  { key: "?", description: "Show shortcuts" },
  { key: "f", description: "Flip board" },
  { key: "Left", description: "Previous move" },
];

describe("KeyboardShortcutsHelp", () => {
  it("returns null when open=false", () => {
    const { container } = render(
      <KeyboardShortcutsHelp open={false} onClose={() => {}} shortcuts={shortcuts} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders shortcuts when open=true", () => {
    render(<KeyboardShortcutsHelp open={true} onClose={() => {}} shortcuts={shortcuts} />);
    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
  });

  it("shows each shortcut key and description", () => {
    render(<KeyboardShortcutsHelp open={true} onClose={() => {}} shortcuts={shortcuts} />);
    for (const s of shortcuts) {
      expect(screen.getByText(s.key)).toBeInTheDocument();
      expect(screen.getByText(s.description)).toBeInTheDocument();
    }
  });

  it("calls onClose when clicking overlay", () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsHelp open={true} onClose={onClose} shortcuts={shortcuts} />);
    // The overlay is the outermost fixed div
    const overlay = screen.getByText("Keyboard Shortcuts").closest(".fixed");
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when clicking Esc button", () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsHelp open={true} onClose={onClose} shortcuts={shortcuts} />);
    fireEvent.click(screen.getByText("Esc"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose when clicking inside the modal content", () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsHelp open={true} onClose={onClose} shortcuts={shortcuts} />);
    fireEvent.click(screen.getByText("Keyboard Shortcuts"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
