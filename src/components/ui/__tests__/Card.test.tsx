import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Card from "../Card";

describe("Card Component", () => {
  it("renders card with children", () => {
    render(<Card>Card Content</Card>);
    expect(screen.getByText("Card Content")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<Card className="custom-class">Content</Card>);
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("renders card with title", () => {
    render(<Card title="Card Title">Content</Card>);
    expect(screen.getByText("Card Title")).toBeInTheDocument();
  });

  it("renders card with icon", () => {
    render(<Card title="With Icon" icon={<span data-testid="icon">Icon</span>}>Content</Card>);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("has cursor-pointer when onClick is provided", () => {
    const { container } = render(<Card onClick={() => {}}>Clickable</Card>);
    expect(container.firstChild).toHaveClass("cursor-pointer");
  });

  it("has correct base classes", () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toHaveClass("rounded-xl");
    expect(container.firstChild).toHaveClass("shadow-lg");
    expect(container.firstChild).toHaveClass("border");
  });

  it("renders without title and icon", () => {
    const { container } = render(<Card>No Header</Card>);
    expect(container.querySelector("h3")).not.toBeInTheDocument();
  });
});
