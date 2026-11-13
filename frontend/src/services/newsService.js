import api from "./api";

export const newsService = {
  categories: () => api.get("/news/categories").then((r) => r.data),
  list: ({ category, q, page = 1, refresh = false }) =>
    api
      .get("/news", { params: { category: category || undefined, q: q || undefined, page, refresh: refresh || undefined } })
      .then((r) => r.data),
  get: (id) => api.get(`/news/${id}`).then((r) => r.data),
  summarize: (id, force = false) =>
    api.post(`/news/${id}/summarize`, null, { params: { force: force || undefined } }).then((r) => r.data),
};
