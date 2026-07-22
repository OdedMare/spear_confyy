# Spear backend

FastAPI API for authentication, customer knowledge, public submissions, project chat, Spearoni/Spearoni+, GitLab scanning and PostgreSQL persistence.

## Runtime

- Python `3.8.10` exactly.
- PostgreSQL 14+.
- OpenAI-compatible `/v1/chat/completions` endpoint.

## Start

```bash
python3.8 -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
uvicorn app.main:app --reload
```

The schema and safe seed content are created on application startup. Production secrets belong in environment variables, never in `.env.example` or source control.

Like locatoAi, environment values are defaults. `GET/PUT /api/settings` updates a persisted runtime settings file, and the LLM client, PostgreSQL connections and GitLab scans read it on every operation. Blank secret fields retain the saved secret; API responses return only masked hints.

## Main endpoints

- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- `GET/PUT /api/settings`, `GET/POST /api/models`
- `GET /api/public/{project}`, `POST /api/submissions`
- `POST /api/chat/customer`, `POST /api/chat/team`
- `GET/POST /api/team/messages`
- `POST /api/team/knowledge`
- `POST /api/repositories/analyze`, `GET /api/repositories/scans/{id}`
- `WS /api/ws/projects/{project}`

Repository scanning reads UTF-8 source/text only, is bounded by `SPEAR_GITLAB_MAX_FILES` and `SPEAR_GITLAB_MAX_FILE_BYTES`, and excludes secret-like names and generated/vendor directories.
