import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
  }) => <img src={src} alt={alt} width={width} height={height} />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import OfflinePage from "./page";

describe("OfflinePage", () => {
  it("renders the offline message", () => {
    render(<OfflinePage />);
    expect(screen.getByText("You're Offline")).toBeInTheDocument();
  });

  it("shows description text", () => {
    render(<OfflinePage />);
    expect(screen.getByText(/No internet connection/)).toBeInTheDocument();
  });

  it("has a Play vs Bot link", () => {
    render(<OfflinePage />);
    const link = screen.getByText("Play vs Bot (Offline)");
    expect(link).toHaveAttribute("href", "/play/bot");
  });

  it("has a Try Again button", () => {
    render(<OfflinePage />);
    expect(screen.getByText("Try Again")).toBeInTheDocument();
  });

  it("Try Again button triggers reload", () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadMock },
      writable: true,
    });

    render(<OfflinePage />);
    fireEvent.click(screen.getByText("Try Again"));
    expect(reloadMock).toHaveBeenCalled();
  });
});
