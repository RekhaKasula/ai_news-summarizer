import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatWindow from "../components/ChatWindow";
import { chatService } from "../services/chatService";

vi.mock("../services/chatService", () => ({ chatService: { getSession: vi.fn(), sendMessage: vi.fn() } }));

const session = (messages = []) => ({
  id: 5, title: "Chat: Story", article_id: 1, article_title: "Story",
  created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-01T10:00:00Z", messages,
});

const renderChat = (props = {}) => render(<MemoryRouter><ChatWindow sessionId={5} {...props} /></MemoryRouter>);

describe("ChatWindow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads saved messages from the server", async () => {
    chatService.getSession.mockResolvedValue(session([
      { id: 1, role: "user", content: "Earlier question", created_at: "2026-11-01T10:00:00Z" },
      { id: 2, role: "assistant", content: "Earlier answer", created_at: "2026-11-01T10:00:05Z" },
    ]));
    renderChat();
    expect(await screen.findByText("Earlier question")).toBeInTheDocument();
    expect(screen.getByText("Earlier answer")).toBeInTheDocument();
    expect(screen.getByText("Chat: Story")).toBeInTheDocument();
  });

  it("sends a question and shows the AI answer", async () => {
    chatService.getSession.mockResolvedValue(session());
    chatService.sendMessage.mockResolvedValue({
      user_message: { id: 10, role: "user", content: "Why did this happen?", created_at: "2026-11-01T11:00:00Z" },
      assistant_message: { id: 11, role: "assistant", content: "According to the article, because of X.", created_at: "2026-11-01T11:00:03Z" },
      session: { ...session(), updated_at: "2026-11-01T11:00:03Z" },
    });
    const onSessionUpdated = vi.fn();
    renderChat({ onSessionUpdated });
    await userEvent.type(await screen.findByLabelText("Your message"), "Why did this happen?");
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));
    expect(await screen.findByText("According to the article, because of X.")).toBeInTheDocument();
    expect(chatService.sendMessage).toHaveBeenCalledWith(5, "Why did this happen?");
    expect(onSessionUpdated).toHaveBeenCalled();
    expect(screen.getByLabelText("Your message")).toHaveValue("");
  });

  it("shows an error and keeps the question when the AI fails", async () => {
    chatService.getSession.mockResolvedValue(session());
    chatService.sendMessage.mockRejectedValue({ response: { status: 502, data: { detail: "The AI service returned an error. Please try again." } } });
    renderChat();
    await userEvent.type(await screen.findByLabelText("Your message"), "Hello?");
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The AI service returned an error.");
    await waitFor(() => expect(screen.getByLabelText("Your message")).toHaveValue("Hello?"));
  });

  it("sends a suggested question with one click", async () => {
    chatService.getSession.mockResolvedValue(session());
    chatService.sendMessage.mockResolvedValue({
      user_message: { id: 1, role: "user", content: "What could happen next?", created_at: "2026-11-01T11:00:00Z" },
      assistant_message: { id: 2, role: "assistant", content: "Possibly more talks.", created_at: "2026-11-01T11:00:02Z" },
      session: session(),
    });
    renderChat();
    await userEvent.click(await screen.findByRole("button", { name: "What could happen next?" }));
    expect(await screen.findByText("Possibly more talks.")).toBeInTheDocument();
  });
});
