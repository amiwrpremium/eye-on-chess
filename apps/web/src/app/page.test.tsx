import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => ({ get: vi.fn() }),
}));

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

const mockAuthState = { user: null, isLoading: false, fetchMe: vi.fn() };

vi.mock("../stores/auth", () => ({
  useAuthStore: (selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState,
}));

import Home from "./page";

describe("Home page", () => {
  it("renders the logo", () => {
    render(<Home />);
    const img = screen.getByAltText("EyeOnChess");
    expect(img).toBeInTheDocument();
  });

  it("renders the app name", () => {
    render(<Home />);
    expect(screen.getByText("EyeOnChess")).toBeInTheDocument();
  });

  it("shows the tagline", () => {
    render(<Home />);
    expect(screen.getByText("Self-hostable chess platform")).toBeInTheDocument();
  });

  it("has a login link", () => {
    render(<Home />);
    const link = screen.getByText("Log In");
    expect(link).toHaveAttribute("href", "/login");
  });

  it("has a register link", () => {
    render(<Home />);
    const link = screen.getByText("Register");
    expect(link).toHaveAttribute("href", "/register");
  });
});
