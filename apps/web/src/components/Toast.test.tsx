import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { act } from "@testing-library/react";
import Toast, { useToast } from "./Toast";

describe("Toast", () => {
  it("renders nothing when no message", () => {
    const { container } = render(<Toast />);
    expect(container.firstChild).toBeNull();
  });

  it("renders message when show is called", () => {
    render(<Toast />);
    act(() => {
      useToast.getState().show("Saved successfully");
    });
    expect(screen.getByText("Saved successfully")).toBeInTheDocument();
  });

  it("renders success toast with green background", () => {
    render(<Toast />);
    act(() => {
      useToast.getState().show("OK", "success");
    });
    const el = screen.getByText("OK").closest("div");
    expect(el?.className).toContain("bg-green-600");
  });

  it("renders error toast with red background", () => {
    render(<Toast />);
    act(() => {
      useToast.getState().show("Failed", "error");
    });
    const el = screen.getByText("Failed").closest("div");
    expect(el?.className).toContain("bg-red-600");
  });

  it("clears message via clear()", () => {
    render(<Toast />);
    act(() => {
      useToast.getState().show("Temp");
    });
    expect(screen.getByText("Temp")).toBeInTheDocument();
    act(() => {
      useToast.getState().clear();
    });
    expect(screen.queryByText("Temp")).not.toBeInTheDocument();
  });
});
