import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Modal from "@/app/components/ui/Modal";

describe("Modal Component", () => {
  it("renders when isOpen is true", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <p>Modal Content</p>
      </Modal>
    );
    expect(screen.getByText("Test Modal")).toBeInTheDocument();
    expect(screen.getByText("Modal Content")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
        <p>Modal Content</p>
      </Modal>
    );
    expect(screen.queryByText("Test Modal")).not.toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Test">
        <p>Content</p>
      </Modal>
    );
    const closeButton = screen.getByRole("button");
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when overlay is clicked", () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Test">
        <p>Content</p>
      </Modal>
    );
    const overlay = screen.getByText("Content").parentElement?.parentElement?.parentElement?.firstChild;
    if (overlay) fireEvent.click(overlay);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders with footer", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test" footer={<button>Save</button>}>
        <p>Content</p>
      </Modal>
    );
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("renders without title", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <p>No Title Content</p>
      </Modal>
    );
    expect(screen.getByText("No Title Content")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});