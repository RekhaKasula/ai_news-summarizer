import api from "./api";

export const chatService = {
  createSession: ({ articleId = null, title = null } = {}) =>
    api.post("/chat/sessions", { article_id: articleId, title }).then((r) => r.data),
  listSessions: () => api.get("/chat/sessions").then((r) => r.data),
  getSession: (id) => api.get(`/chat/sessions/${id}`).then((r) => r.data),
  sendMessage: (id, content) => api.post(`/chat/sessions/${id}/messages`, { content }).then((r) => r.data),
  deleteSession: (id) => api.delete(`/chat/sessions/${id}`),
};
