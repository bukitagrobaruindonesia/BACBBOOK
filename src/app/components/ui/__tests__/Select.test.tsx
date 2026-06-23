import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Select from "@/app/components/ui/Select";

const options = [
  { value: "1", label: "Option 1" },
  { value: "2", label: "Option 2" },
  { value: "3", label: "Option 3" },
];

describe("Select Component", () => {
  it("renders select with label", () => {
    render(<Select label="Choose" options={options} />);
    expect(screen.getByText("Choose")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders all options", () => {
    render(<Select options={options} />);
    options.forEach((opt) => {
      expect(screen.getByText(opt.label)).toBeInTheDocument();
    });
  });

  it("handles selection change", () => {
    const handleChange = vi.fn();
    render(<Select options={options} onChange={handleChange} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "2" } });
    expect(handleChange).toHaveBeenCalled();
  });

  it("shows error message", () => {
    render(<Select options={options} error="Invalid selection" />);
    expect(screen.getByText("Invalid selection")).toBeInTheDocument();
  });

  it("shows required indicator", () => {
    render(<Select label="Field" options={options} required />);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("renders with placeholder", () => {
    render(<Select options={options} placeholder="Select option" />);
    expect(screen.getByText("Select option")).toBeInTheDocument();
  });

  it("renders with value", () => {
    render(<Select options={options} value="2" />);
    expect(screen.getByRole("combobox")).toHaveValue("2");
  });

  it("applies custom className", () => {
    const { container } = render(<Select options={options} className="custom-class" />);
    expect(container.querySelector("select")).toHaveClass("custom-class");
  });

  it("renders with name attribute", () => {
    render(<Select name="test-select" options={options} />);
    expect(screen.getByRole("combobox")).toHaveAttribute("name", "test-select");
  });
});
