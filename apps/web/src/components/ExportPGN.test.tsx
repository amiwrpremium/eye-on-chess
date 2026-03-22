import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock api module
vi.mock("../lib/api", () => ({
  default: {
    get: vi.fn(),
  },
}));

import ExportPGN from "./ExportPGN";

describe("ExportPGN", () => {
  it("renders the export button", () => {
    render(<ExportPGN gameId="abc123" />);
    expect(screen.getByText("Export PGN")).toBeInTheDocument();
  });

  it("renders full-size button by default", () => {
    render(<ExportPGN gameId="abc123" />);
    const btn = screen.getByText("Export PGN");
    expect(btn.className).toContain("w-full");
  });

  it("compact mode renders smaller button with 'PGN' text", () => {
    render(<ExportPGN gameId="abc123" compact />);
    expect(screen.getByText("PGN")).toBeInTheDocument();
    expect(screen.queryByText("Export PGN")).not.toBeInTheDocument();
  });

  it("compact button has smaller styling", () => {
    render(<ExportPGN gameId="abc123" compact />);
    const btn = screen.getByText("PGN");
    expect(btn.className).toContain("text-xs");
  });
});
