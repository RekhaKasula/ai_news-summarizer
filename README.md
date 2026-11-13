# AI News Summarizer – Personalized News Feed with AI Chat

A full-stack web app where you log in, pick a news category, read **AI-generated summaries and key points**, open the original article, and **chat with an AI about any article**. Conversations are stored in PostgreSQL, so you can close the browser and continue later.

> Built as a learning project: the code is small, layered and commented so you can explain every part in a demo or interview.

## 1. Features

- Register / log in with JWT authentication (Argon2 password hashing)
- 8 categories: Sports, Politics, Education, Technology, Business, Entertainment, Health, World (+ free-text search)
- News cards with image, publisher, date, AI summary, "Read original", "Ask AI"
- Article page with summary, key takeaways and a note when the summary is based on limited information
- Load more, refresh, loading skeletons, error and empty states (no fake news is ever shown)
- Per-article AI chat grounded in the article, with suggested questions and timestamps
- Chat history sidebar: open, continue, create and delete (with confirmation) – all stored in PostgreSQL
- Responses are cached in the database; the same article is never summarized twice

## 2. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, JavaScript, Tailwind CSS 3, React Router 6, Axios, Lucide icons, Vitest + Testing Library |
| Backend | Python, FastAPI, Uvicorn, Pydantic v2, SQLAlchemy 2 ORM, Alembic |
| Database | PostgreSQL (psycopg 3 driver) |
| News | GNews API |
| AI | Google Gemini via the `google-genai` SDK (model set by `GEMINI_MODEL`) |
| Auth | JWT (PyJWT) + Argon2 (argon2-cffi) |
| Deploy | Vercel (frontend), Render (backend + PostgreSQL) |

## 3. Architecture

```
Browser (React)  ──HTTPS + Bearer JWT──▶  FastAPI  ──▶  PostgreSQL
                                           │   ├──▶ GNews API   (news_service)
                                           │   └──▶ Gemini API  (ai_service)
```

Backend layers (each has one job):

- `routes/` – HTTP only: parse input, call a service, return a schema
- `services/` – business logic: `news_service` (GNews, normalise, dedupe, cache, store), `ai_service` (all Gemini calls), `chat_service` (ownership, history window, saving)
- `models/` – SQLAlchemy tables; `schemas/` – Pydantic request/response models
- `core/` – settings, security (JWT/Argon2), dependencies, rate limiter, error classes

**News flow:** category → `GET /news` → GNews (10-minute in-memory cache) → normalise → drop duplicates by canonical URL → upsert in PostgreSQL → summarize only articles without a stored summary (3 in parallel) → return.

**Chat flow:** `POST /chat/sessions/{id}/messages` → check the session belongs to the user → load the last `CHAT_HISTORY_WINDOW` messages → send article + history to Gemini → save question and answer → return both. If Gemini fails nothing is saved, so the user can simply retry.

**Prompt-injection defence:** article text is untrusted. It is placed inside `<article>` tags, and the system instruction says to treat it as data and never follow instructions inside it.

## 4. Folder structure

```
ai-news-summarizer/
├── backend/
│   ├── app/
│   │   ├── core/        config, security, deps, errors, rate_limit
│   │   ├── models/      user, article, chat
│   │   ├── schemas/     auth, news, chat
│   │   ├── routes/      auth, news, chat, health
│   │   ├── services/    news_service, ai_service, chat_service
│   │   ├── utils/       urls, text
│   │   ├── database.py
│   │   └── main.py
│   ├── alembic/         env.py + versions/0001_initial_schema.py
│   ├── tests/           pytest suite (all external APIs mocked)
│   ├── alembic.ini  requirements.txt  requirements-dev.txt  .env.example
├── frontend/
│   ├── src/ components/ pages/ layouts/ services/ hooks/ context/ utils/ test/
│   ├── package.json  vite.config.js  tailwind.config.js  vercel.json  .env.example
├── docker-compose.yml   (local PostgreSQL)
├── render.yaml          (optional Render blueprint)
├── .gitignore  LICENSE  README.md
```

## 5. Prerequisites (Ubuntu)

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip git curl
# Node.js 20+ (check with: node -v). If it is older, install from NodeSource or use nvm:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
# Docker (for PostgreSQL) – or see "Without Docker" below
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER   # log out and back in afterwards
```

Python 3.10+ is required. The pinned versions in `requirements.txt` were tested together on Python 3.12; if pip cannot resolve a pin on an older Python, upgrade Python or relax the pins.

## 6. API keys

**GNews** (news): create a free account at <https://gnews.io>, open the dashboard, copy your API key. The free plan allows ~100 requests/day, 10 articles per request, and **may not support `page` > 1** – in that case "Load more" simply stops offering new stories.

**Gemini** (AI): open <https://aistudio.google.com/apikey>, sign in with a Google account, click *Create API key*. The free tier has per-minute and per-day limits; if you hit them the app shows a friendly message and lets you retry.

Never commit keys. `.env` files are git-ignored.

## 7. Configuration

```bash
cd ai-news-summarizer
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
python3 -c "import secrets; print(secrets.token_urlsafe(48))"   # paste as JWT_SECRET_KEY
nano backend/.env     # fill JWT_SECRET_KEY, GNEWS_API_KEY, GEMINI_API_KEY
```

| Variable (backend) | Required | Meaning |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL URL. `postgres://` and `postgresql://` are converted automatically |
| `JWT_SECRET_KEY` | yes | ≥ 32 random characters |
| `GNEWS_API_KEY` | for news | the app returns a clear 503 message if missing |
| `GEMINI_API_KEY` | for AI | same |
| `GEMINI_MODEL` | no | default `gemini-2.5-flash`; check <https://ai.google.dev/gemini-api/docs/models> for current names |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | default 60 |
| `FRONTEND_URL` | no | allowed CORS origin(s), comma-separated, default `http://localhost:5173` |
| `GNEWS_LANG`, `GNEWS_COUNTRY` | no | e.g. `en` and `in` for Indian news |
| `NEWS_PAGE_SIZE`, `NEWS_CACHE_TTL_SECONDS`, `CHAT_HISTORY_WINDOW`, `RATE_LIMIT_ENABLED` | no | tuning |

Frontend: `VITE_API_BASE_URL` (default `http://localhost:8000`).

If a required variable is missing the server stops at startup with a message listing exactly what to fix.

## 8. PostgreSQL

**With Docker (recommended):**

```bash
docker compose up -d        # starts PostgreSQL on localhost:5432 (user newsapp / db ai_news)
docker compose ps           # should show "healthy"
```

The default `DATABASE_URL` in `.env.example` already matches this container.

**Without Docker:**

```bash
sudo apt install -y postgresql
sudo -u postgres psql -c "CREATE USER newsapp WITH PASSWORD 'newsapp_password';"
sudo -u postgres psql -c "CREATE DATABASE ai_news OWNER newsapp;"
```

## 9. Run the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
alembic upgrade head                      # creates the tables
uvicorn app.main:app --reload --port 8000
```

Open <http://localhost:8000/docs> (interactive API docs) and <http://localhost:8000/health>.

## 10. Run the frontend (second terminal)

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>, register, and pick a category.

## 11. Migrations

```bash
cd backend && source .venv/bin/activate
alembic upgrade head                                   # apply
alembic revision --autogenerate -m "describe change"   # after editing models
alembic downgrade -1                                   # undo the last migration
```

## 12. Tests

```bash
cd backend && source .venv/bin/activate && pytest -q   # 38 tests, SQLite in memory, GNews/Gemini mocked
cd frontend && npm test                                # 15 tests, Vitest + Testing Library
```

No API keys or network are needed for tests. They cover registration, login, JWT expiry, news fetching and caching, duplicates, error mapping, chat storage, user isolation, history window, rate limiting, and the login form / category grid / news feed / chat UI.

## 13. API summary

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | return `{access_token, user}` |
| GET | `/auth/me` | current user |
| GET | `/news/categories` | public |
| GET | `/news?category=sports&page=1` | also `q=`, `refresh=true` |
| GET | `/news/{id}` | |
| POST | `/news/{id}/summarize` | creates the summary if missing (`?force=true` regenerates) |
| POST/GET | `/chat/sessions` | create (optionally with `article_id`) / list |
| GET/DELETE | `/chat/sessions/{id}` | owner only (others get 404) |
| POST | `/chat/sessions/{id}/messages` | `{content}` → user + assistant messages |
| GET | `/health` | includes database check |

## 14. Troubleshooting

| Problem | Fix |
|---|---|
| `Invalid configuration: JWT_SECRET_KEY ...` | fill `backend/.env` (section 7) |
| `connection refused` on port 5432 | `docker compose up -d`; check `docker compose ps` |
| `permission denied` for docker | `sudo usermod -aG docker $USER`, then log out/in |
| 503 "GNews API key is not configured/invalid" | check `GNEWS_API_KEY`; restart uvicorn after editing `.env` |
| 429 "request limit reached" | GNews daily quota or Gemini rate limit; wait or upgrade |
| 503 "Gemini model was not found" | set a currently supported `GEMINI_MODEL` |
| Browser shows a CORS error | `FRONTEND_URL` must equal the exact origin in the address bar (no trailing slash) |
| Some cards say "Generate AI summary" | Gemini failed for that article; click the button to retry |
| "Load more" disappears after page 1 | free GNews plans may not support paging |
| `alembic: Can't locate revision` after changing DBs | run it from the `backend` folder with the venv active |

## 15. Upload to GitHub

```bash
cd ai-news-summarizer
git init && git add . && git commit -m "Initial commit: AI News Summarizer"
git status          # make sure no .env file is listed!
git branch -M main
git remote add origin https://github.com/<your-username>/ai-news-summarizer.git
git push -u origin main
```

## 16. Deploy

### Database (Render PostgreSQL)
Render → *New* → *PostgreSQL* → create. Copy the **Internal Database URL** (use the *External* URL only for connecting from your own computer). Paste it as `DATABASE_URL`.

### Backend (Render)
1. Render → *New* → *Web Service* → connect your GitHub repo. **Root Directory:** `backend`. **Runtime:** Python.
2. **Build command:** `pip install -r requirements.txt`
3. **Start command:** `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'` (migrations run on every deploy)
4. Environment variables: `DATABASE_URL`, `JWT_SECRET_KEY`, `GNEWS_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, and `FRONTEND_URL` = your Vercel URL (add it after step Frontend).
5. Health check path: `/health`. (Alternatively use the included `render.yaml` Blueprint.)

Free Render services sleep when idle, so the first request can take ~30–60 s.

### Frontend (Vercel)
1. Vercel → *Add New Project* → import the repo. **Root Directory:** `frontend`. Framework preset: Vite.
2. Environment variable: `VITE_API_BASE_URL` = your Render URL (e.g. `https://ai-news-api.onrender.com`).
3. Deploy. `vercel.json` makes page refreshes on routes like `/chat/3` work.
4. Put the Vercel URL into the backend's `FRONTEND_URL` and redeploy the backend.

## 17. Security notes

- Passwords hashed with Argon2; JWT with expiry; same error for wrong email/password
- Every chat query filters by `user_id`; other users' sessions return 404
- API keys exist only in backend environment variables; `httpx` logging is lowered so the GNews key never appears in logs
- Pydantic validation on all inputs, SQLAlchemy parameterised queries, CORS limited to `FRONTEND_URL`, 100 KB request body limit
- Article URLs must be http(s); tracking parameters are stripped
- In-memory rate limits (auth 10/min, news 30/min, chat 20/min). For several server instances use a shared store such as Redis
- The app never fetches full article pages or bypasses paywalls: it summarizes only what GNews supplies (headline, description, short excerpt) and says when information is limited

## 18. Known limitations

- Comparing with a *different* article is not possible; the AI only sees the selected article and says so
- The JWT is stored in `localStorage` (simple for learning; production apps often use httpOnly cookies)
- The news cache and rate limiter are per-process memory
- GNews free plan limits: 100 requests/day, 10 articles per request, delayed articles
