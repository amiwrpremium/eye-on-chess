import { describe, it, expect } from "vitest";
import { parsePagination, paginationMeta } from "./pagination.js";

describe("parsePagination", () => {
  it("returns defaults when no params provided", () => {
    const result = parsePagination({});
    expect(result).toEqual({ page: 1, limit: 20, skip: 0, take: 20 });
  });

  it("parses page and limit from strings", () => {
    const result = parsePagination({ page: "3", limit: "10" });
    expect(result).toEqual({ page: 3, limit: 10, skip: 20, take: 10 });
  });

  it("clamps page to minimum 1", () => {
    const result = parsePagination({ page: "0" });
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it("clamps negative page to 1", () => {
    const result = parsePagination({ page: "-5" });
    expect(result.page).toBe(1);
  });

  it("defaults limit when 0 is passed", () => {
    const result = parsePagination({ limit: "0" });
    expect(result.limit).toBe(20);
  });

  it("clamps limit to minimum 1", () => {
    const result = parsePagination({ limit: "-5" });
    expect(result.limit).toBe(1);
  });

  it("clamps limit to maximum 50", () => {
    const result = parsePagination({ limit: "100" });
    expect(result.limit).toBe(50);
  });

  it("handles NaN page gracefully", () => {
    const result = parsePagination({ page: "abc" });
    expect(result.page).toBe(1);
  });

  it("handles NaN limit gracefully", () => {
    const result = parsePagination({ limit: "xyz" });
    expect(result.limit).toBe(20);
  });

  it("computes correct skip for page 2", () => {
    const result = parsePagination({ page: "2", limit: "15" });
    expect(result.skip).toBe(15);
  });

  it("computes correct skip for page 5 limit 10", () => {
    const result = parsePagination({ page: "5", limit: "10" });
    expect(result.skip).toBe(40);
  });
});

describe("paginationMeta", () => {
  it("computes totalPages correctly", () => {
    const result = paginationMeta(1, 20, 55);
    expect(result).toEqual({ page: 1, limit: 20, total: 55, totalPages: 3 });
  });

  it("returns 1 page for 0 items", () => {
    const result = paginationMeta(1, 20, 0);
    expect(result.totalPages).toBe(0);
  });

  it("returns 1 page for exactly limit items", () => {
    const result = paginationMeta(1, 20, 20);
    expect(result.totalPages).toBe(1);
  });

  it("returns correct page info", () => {
    const result = paginationMeta(3, 10, 42);
    expect(result).toEqual({ page: 3, limit: 10, total: 42, totalPages: 5 });
  });
});
