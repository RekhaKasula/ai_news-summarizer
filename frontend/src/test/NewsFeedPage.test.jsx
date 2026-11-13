import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewsFeedPage from "../pages/NewsFeedPage";
import { newsService } from "../services/newsService";

vi.mock("../services/newsService", () => ({ newsService: { list: vi.fn(), summarize: vi.fn() } }));
vi.mock("../services/chatService", () => ({ chatService: { createSession: vi.fn() } }));

const article = (id, extra = {}) => ({
  id, title: `Story ${id}`, description: `Desc ${id}`, image_url: null, original_url: `https://example.com/${id}`,
  source: "Example Times", published_at: "2026-11-01T10:00:00Z", category: "sports",
  summary: `Summary ${id}`, key_points: ["a"], content_available: false, ...extra,
});

const renderFeed = (url = "/news?category=sports") => render(<MemoryRouter initialEntries={[url]}><NewsFeedPage /></MemoryRouter>);

describe("NewsFeedPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a loading skeleton, then article cards", async () => {
    newsService.list.mockResolvedValue({ articles: [article(1), article(2)], has_more: false, summaries_failed: 0 });
    renderFeed();
    expect(screen.getByLabelText("Loading news")).toBeInTheDocument();
    expect(await screen.findByText("Story 1")).toBeInTheDocument();
    expect(screen.getByText("Summary 2")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /ask ai/i })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /read original/i })[0]).toHaveAttribute("href", "https://example.com/1");
    expect(newsService.list).toHaveBeenCalledWith(expect.objectContaining({ category: "sports", page: 1 }));
  });

  it("shows an empty state when there are no stories", async () => {
    newsService.list.mockResolvedValue({ articles: [], has_more: false, summaries_failed: 0 });
    renderFeed();
    expect(await screen.findByText("No stories found")).toBeInTheDocument();
  });

  it("shows an error with retry and never fake articles", async () => {
    newsService.list.mockRejectedValueOnce({ response: { status: 503, data: { detail: "The GNews API key is not configured." } } });
    newsService.list.mockResolvedValueOnce({ articles: [article(7)], has_more: false, summaries_failed: 0 });
    renderFeed();
    expect(await screen.findByRole("alert")).toHaveTextContent("The GNews API key is not configured.");
    expect(screen.queryByText(/Story/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Story 7")).toBeInTheDocument();
  });

  it("loads more and appends new articles", async () => {
    newsService.list.mockResolvedValueOnce({ articles: [article(1)], has_more: true, summaries_failed: 0 });
    newsService.list.mockResolvedValueOnce({ articles: [article(2)], has_more: false, summaries_failed: 0 });
    renderFeed();
    await userEvent.click(await screen.findByRole("button", { name: /load more/i }));
    await waitFor(() => expect(screen.getByText("Story 2")).toBeInTheDocument());
    expect(screen.getByText("Story 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("offers a retry button for articles without a summary", async () => {
    newsService.list.mockResolvedValue({ articles: [article(3, { summary: null, key_points: null })], has_more: false, summaries_failed: 1 });
    newsService.summarize.mockResolvedValue(article(3, { summary: "Fresh summary" }));
    renderFeed();
    await userEvent.click(await screen.findByRole("button", { name: /generate ai summary/i }));
    expect(await screen.findByText("Fresh summary")).toBeInTheDocument();
  });
});
