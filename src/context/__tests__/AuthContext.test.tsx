import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthContext";

const TestComponent = () => {
  const { user, verified, loading, login, logout, markVerified } = useAuth();
  if (loading) return <div>Loading...</div>;
  return (
    <div>
      <div data-testid="user">{user ? user.email : "No user"}</div>
      <div data-testid="verified">{verified ? "Verified" : "Not Verified"}</div>
      <button onClick={() => login("test@test.com", "password")}>Login</button>
      <button onClick={logout}>Logout</button>
      <button onClick={markVerified}>Verify</button>
    </div>
  );
};

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "";
  });

  it("shows loading state initially", () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows no user when not authenticated", async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("No user");
    });
  });

  it("throws error when useAuth is used outside AuthProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow("useAuth harus digunakan dalam AuthProvider");
    consoleSpy.mockRestore();
  });

  it("handles login failure", async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      const loginBtn = screen.getByText("Login");
      fireEvent.click(loginBtn);
    });
  });

  it("handles logout", async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      const logoutBtn = screen.getByText("Logout");
      fireEvent.click(logoutBtn);
      expect(screen.getByTestId("user")).toHaveTextContent("No user");
    });
  });

  it("handles markVerified", async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      const verifyBtn = screen.getByText("Verify");
      fireEvent.click(verifyBtn);
      expect(screen.getByTestId("verified")).toHaveTextContent("Verified");
    });
  });
});
