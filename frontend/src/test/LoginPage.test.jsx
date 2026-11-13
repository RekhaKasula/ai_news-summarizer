import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "../pages/LoginPage";

// `login` records calls; the wrapper below optionally throws. (Spying on a rejecting promise makes
// the spy itself report an unhandled rejection, so failures are thrown by a plain async function.)
const login = vi.fn();
let failWith = null;
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    login: async (...args) => {
      login(...args);
      if (failWith) throw failWith;
      return { name: "Rekha" };
    },
  }),
}));

const renderPage = () => render(<MemoryRouter><LoginPage /></MemoryRouter>);

describe("LoginPage", () => {
  beforeEach(() => {
    login.mockReset();
    failWith = null;
  });

  it("shows validation errors and does not call the API for empty input", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("submits valid credentials", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "rekha@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(login).toHaveBeenCalledWith("rekha@example.com", "secret123"));
  });

  it("shows the server error message", async () => {
    failWith = Object.assign(new Error("Request failed"), { response: { status: 401, data: { detail: "Incorrect email or password." } } });
    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "rekha@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrongpass1");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
  });
});
