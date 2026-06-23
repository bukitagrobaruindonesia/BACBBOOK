import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Button from "../Button";

describe("Button Component", () => {
  it("renders button with children text", () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByText("Click Me")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByText("Click"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByText("Disabled")).toBeDisabled();
  });

  it("applies primary variant by default", () => {
    const { container } = render(<Button>Primary</Button>);
    expect(container.firstChild).toHaveClass("from-green-700");
  });

  it("applies secondary variant", () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    expect(container.firstChild).toHaveClass("bg-amber-600");
  });

  it("applies danger variant", () => {
    const { container } = render(<Button variant="danger">Danger</Button>);
    expect(container.firstChild).toHaveClass("bg-red-600");
  });

  it("applies outline variant", () => {
    const { container } = render(<Button variant="outline">Outline</Button>);
    expect(container.firstChild).toHaveClass("border-green-600");
  });

  it("applies size classes correctly", () => {
    const { container: sm } = render(<Button size="sm">Small</Button>);
    expect(sm.firstChild).toHaveClass("px-4");

    const { container: md } = render(<Button size="md">Medium</Button>);
    expect(md.firstChild).toHaveClass("px-6");

    const { container: lg } = render(<Button size="lg">Large</Button>);
    expect(lg.firstChild).toHaveClass("px-8");
  });

  it("shows loading spinner when isLoading", () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByRole("button")).toContainHTML("animate-spin");
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders as submit type", () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("applies custom className", () => {
    const { container } = render(<Button className="custom-class">Custom</Button>);
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("does not call onClick when disabled", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick} disabled>Disabled</Button>);
    fireEvent.click(screen.getByText("Disabled"));
    expect(handleClick).not.toHaveBeenCalled();
  });
});
