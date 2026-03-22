import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => ({ get: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockAuthState = {
  user: { id: "1", username: "testuser", email: "test@test.com", rating: 1200 },
  isLoading: false,
  fetchMe: vi.fn(),
};

vi.mock("../../stores/auth", () => ({
  useAuthStore: (selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState,
}));

const mockSettingsState = {
  darkMode: true,
  boardTheme: "classic",
  pieceSet: "classic",
  soundEnabled: true,
  setDarkMode: vi.fn(),
  setBoardTheme: vi.fn(),
  setPieceSet: vi.fn(),
  setSoundEnabled: vi.fn(),
};

vi.mock("../../stores/settings", () => ({
  useSettingsStore: (selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector(mockSettingsState) : mockSettingsState,
  BoardTheme: {},
  PieceSet: {},
}));

import SettingsPage from "./page";

describe("SettingsPage", () => {
  it("renders the Settings heading", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders Appearance section", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Appearance")).toBeInTheDocument();
  });

  it("renders Dark Mode toggle", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Dark Mode")).toBeInTheDocument();
  });

  it("renders Sound Effects toggle", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Sound Effects")).toBeInTheDocument();
  });

  it("renders Board Theme section", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Board Theme")).toBeInTheDocument();
  });

  it.skip("renders board theme options", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Classic")).toBeInTheDocument();
    expect(screen.getByText("Green")).toBeInTheDocument();
    expect(screen.getByText("Blue")).toBeInTheDocument();
  });

  it("renders Piece Set section", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Piece Set")).toBeInTheDocument();
  });

  it("renders back to play link", () => {
    render(<SettingsPage />);
    const link = screen.getByText(/Back to Play/);
    expect(link).toHaveAttribute("href", "/play");
  });
});
