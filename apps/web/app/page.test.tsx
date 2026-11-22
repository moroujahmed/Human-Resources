import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("home page scaffold", () => {
  it("renders the shared staff role contract", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "StaffHub" })).toBeDefined();
    expect(screen.getByText("PAYROLL_OFFICER")).toBeDefined();
  });
});
