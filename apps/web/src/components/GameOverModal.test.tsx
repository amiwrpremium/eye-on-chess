import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GameOverModal from "./GameOverModal";

const defaultProps = {
  gameOver: {
    result: "1-0",
    termination: "checkmate",
    ratingChange: { white: 12, black: -12 },
  },
  rematchIncoming: false,
  rematchOffered: false,
  onRematchOffer: vi.fn(),
  onRematchAccept: vi.fn(),
  onRematchDecline: vi.fn(),
  onClose: vi.fn(),
  resultLabel: "White wins by checkmate",
};

function renderModal(overrides = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(<GameOverModal {...props} />);
}

describe("GameOverModal", () => {
  it("renders result label", () => {
    renderModal();
    expect(screen.getByText("White wins by checkmate")).toBeInTheDocument();
    expect(screen.getByText("Game Over")).toBeInTheDocument();
  });

  it("shows rating changes", () => {
    renderModal();
    expect(screen.getByText("+12")).toBeInTheDocument();
    expect(screen.getByText("-12")).toBeInTheDocument();
  });

  it("shows positive rating in green and negative in red", () => {
    renderModal();
    const plus = screen.getByText("+12");
    expect(plus.className).toContain("text-green-400");
    const minus = screen.getByText("-12");
    expect(minus.className).toContain("text-red-400");
  });

  it("rematch button calls onRematchOffer", () => {
    const onRematchOffer = vi.fn();
    renderModal({ onRematchOffer });
    fireEvent.click(screen.getByText("Rematch"));
    expect(onRematchOffer).toHaveBeenCalledOnce();
  });

  it("shows Accept Rematch and Decline when rematchIncoming=true", () => {
    renderModal({ rematchIncoming: true });
    expect(screen.getByText("Accept Rematch")).toBeInTheDocument();
    expect(screen.getByText("Decline")).toBeInTheDocument();
  });

  it("Accept Rematch calls onRematchAccept", () => {
    const onRematchAccept = vi.fn();
    renderModal({ rematchIncoming: true, onRematchAccept });
    fireEvent.click(screen.getByText("Accept Rematch"));
    expect(onRematchAccept).toHaveBeenCalledOnce();
  });

  it("Decline calls onRematchDecline", () => {
    const onRematchDecline = vi.fn();
    renderModal({ rematchIncoming: true, onRematchDecline });
    fireEvent.click(screen.getByText("Decline"));
    expect(onRematchDecline).toHaveBeenCalledOnce();
  });

  it("shows 'Offered...' text when rematchOffered=true", () => {
    renderModal({ rematchOffered: true });
    expect(screen.getByText("Offered...")).toBeInTheDocument();
    expect(screen.queryByText("Rematch")).not.toBeInTheDocument();
  });

  it("rematch button is disabled when rematchOffered=true", () => {
    renderModal({ rematchOffered: true });
    const btn = screen.getByText("Offered...");
    expect(btn).toBeDisabled();
  });

  it("Back button calls onClose", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByText("Back"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
