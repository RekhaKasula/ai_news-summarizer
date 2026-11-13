import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CategoryGrid from "../components/CategoryGrid";

describe("CategoryGrid", () => {
  it("renders all eight categories", () => {
    render(<CategoryGrid onSelect={() => {}} />);
    for (const name of ["Sports", "Politics", "Education", "Technology", "Business", "Entertainment", "Health", "World"]) {
      expect(screen.getByRole("button", { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it("reports the selected category id", async () => {
    const onSelect = vi.fn();
    render(<CategoryGrid onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /Technology/ }));
    expect(onSelect).toHaveBeenCalledWith("technology");
  });
});
