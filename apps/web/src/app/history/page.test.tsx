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

vi.mock("../../lib/api", () => ({
  default: {
    get: vi.fn().mockReturnValue(new Promise(() => {})),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../components/Skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

vi.mock("../../components/GameNoteEditor", () => ({
  default: () => <div data-testid="game-note-editor" />,
}));

vi.mock("../../components/ExportPGN", () => ({
  default: () => <div data-testid="export-pgn" />,
}));

vi.mock("@eyeonchess/chess", () => ({
  RESULT_LABELS: {
    WHITE_WIN: "White wins",
    BLACK_WIN: "Black wins",
    DRAW: "Draw",
    ABORTED: "Aborted",
  },
}));

import HistoryPage from "./page";

describe("HistoryPage", () => {
  it("renders the Game History heading", () => {
    render(<HistoryPage />);
    expect(screen.getByText("Game History")).toBeInTheDocument();
  });

  it("shows loading skeletons while loading", () => {
    render(<HistoryPage />);
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders back to play link", () => {
    render(<HistoryPage />);
    const link = screen.getByText(/Back to Play/);
    expect(link).toHaveAttribute("href", "/play");
  });
});
