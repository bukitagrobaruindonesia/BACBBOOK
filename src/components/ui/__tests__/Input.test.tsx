import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Input from "../Input";

describe("Input Component", () => {
  it("renders input with label", () => {
    render(<Input label="Username" name="username" />);
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });

  it("handles value changes", () => {
    const handleChange = vi.fn();
    render(<Input name="test" onChange={handleChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "hello" } });
    expect(handleChange).toHaveBeenCalled();
  });

  it("shows error message when error prop is provided", () => {
    render(<Input name="test" error="Required field" />);
    expect(screen.getByText("Required field")).toBeInTheDocument();
  });

  it("shows helper text when provided", () => {
    render(<Input name="test" helperText="Helper text" />);
    expect(screen.getByText("Helper text")).toBeInTheDocument();
  });

  it("prioritizes error over helperText", () => {
    render(<Input name="test" error="Error" helperText="Helper" />);
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.queryByText("Helper")).not.toBeInTheDocument();
  });

  it("shows required indicator", () => {
    render(<Input label="Field" name="test" required />);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("renders with placeholder", () => {
    render(<Input name="test" placeholder="Enter value" />);
    expect(screen.getByPlaceholderText("Enter value")).toBeInTheDocument();
  });

  it("renders different input types", () => {
    render(<Input name="number" type="number" />);
    expect(screen.getByRole("spinbutton")).toHaveAttribute("type", "number");
  });

  it("applies readOnly style", () => {
    const { container } = render(<Input name="test" readOnly />);
    expect(container.querySelector("input")).toHaveClass("bg-gray-50");
  });

  it("applies custom className", () => {
    const { container } = render(<Input name="test" className="custom-class" />);
    expect(container.querySelector("input")).toHaveClass("custom-class");
  });

  it("renders with value", () => {
    render(<Input name="test" value="test value" />);
    expect(screen.getByDisplayValue("test value")).toBeInTheDocument();
  });
});
