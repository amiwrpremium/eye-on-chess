import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "test-game-id" }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
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

vi.mock("../../stores/auth", () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ register: vi.fn(), user: null, isLoading: false }),
}));

vi.mock("../../lib/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import RegisterPage from "./page";

describe("RegisterPage", () => {
  it("renders the register form", () => {
    render(<RegisterPage />);
    expect(screen.getByText("Register", { selector: "h1" })).toBeInTheDocument();
  });

  it("shows the logo", () => {
    render(<RegisterPage />);
    const img = screen.getByAltText("EyeOnChess");
    expect(img).toBeInTheDocument();
  });

  it("has an invite code field", () => {
    render(<RegisterPage />);
    expect(screen.getByText("Invite Code")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Paste your invite code")).toBeInTheDocument();
  });

  it("has an email field", () => {
    render(<RegisterPage />);
    expect(screen.getByText("Email")).toBeInTheDocument();
    const emailInput = document.querySelector('input[type="email"]');
    expect(emailInput).toBeInTheDocument();
  });

  it("has a username field", () => {
    render(<RegisterPage />);
    expect(screen.getByText("Username")).toBeInTheDocument();
  });

  it("has a password field", () => {
    render(<RegisterPage />);
    expect(screen.getByText("Password")).toBeInTheDocument();
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput).toBeInTheDocument();
  });

  it("has a login link", () => {
    render(<RegisterPage />);
    const link = screen.getByText("Log in");
    expect(link).toHaveAttribute("href", "/login");
  });

  it("shows invite-only message", () => {
    render(<RegisterPage />);
    expect(screen.getByText(/invite-only/)).toBeInTheDocument();
  });
});
