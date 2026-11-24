import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LeavePage from "./page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/leave",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("../../src/lib/session", () => ({
  getSession: () => ({
    accessToken: "test-access",
    csrfToken: "test-csrf",
  }),
}));

vi.mock("../../src/lib/api", () => ({
  api: vi.fn(async (path: string) => {
    if (path === "/leave/types") {
      return [{ id: "11111111-1111-4111-8111-111111111111", code: "ANNUAL", name: "Annual Leave" }];
    }
    if (path.startsWith("/leave/balances")) {
      return [{
        year: 2026,
        entitledDays: "21",
        carriedOverDays: "2",
        usedDays: "3",
        pendingDays: "1",
        leaveType: { code: "ANNUAL", name: "Annual Leave", isPaid: true },
      }];
    }
    return [];
  }),
}));

describe("Employee leave page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads leave types and live balance data", async () => {
    render(<LeavePage />);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Annual Leave" })).toBeDefined();
    });
    expect(screen.getByText("19")).toBeDefined();
    expect(screen.getByText(/Annual Leave days remaining/)).toBeDefined();
  });
});
