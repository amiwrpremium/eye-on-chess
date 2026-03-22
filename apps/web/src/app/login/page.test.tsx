import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "test-game-id" }),
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

vi.mock("../../stores/auth", () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ login: vi.fn(), user: null, isLoading: false }),
}));

import LoginPage from "./page";

describe("LoginPage", () => {
  it("renders the login form", () => {
    render(<LoginPage />);
    expect(screen.getByText("Log In", { selector: "h1" })).toBeInTheDocument();
  });

  it("shows the logo", () => {
    render(<LoginPage />);
    const img = screen.getByAltText("EyeOnChess");
    expect(img).toBeInTheDocument();
  });

  it("has an email input field", () => {
    render(<LoginPage />);
    expect(screen.getByText("Email")).toBeInTheDocument();
    const emailInput = document.querySelector('input[type="email"]');
    expect(emailInput).toBeInTheDocument();
  });

  it("has a password input field", () => {
    render(<LoginPage />);
    expect(screen.getByText("Password")).toBeInTheDocument();
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput).toBeInTheDocument();
  });

  it("has a submit button", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: "Log In" })).toBeInTheDocument();
  });

  it("has a link to register page", () => {
    render(<LoginPage />);
    const link = screen.getByText("Register");
    expect(link).toHaveAttribute("href", "/register");
  });
});
