import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("StaffHub public landing", () => {
  it("renders secure sign-in and public careers entry points", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Human resources operations" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Open vacancies" })).toBeDefined();
  });
});
