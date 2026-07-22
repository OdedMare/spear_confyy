# Backend guidance

- Target Python 3.8.10 and the dependency ranges in `pyproject.toml`.
- Public retrieval must query `visibility = 'public'`; Spearoni+ may query public and internal documents.
- Keep auth cookie HTTP-only and verify it on every `/api/team/*`, model, scan and WebSocket route.
- Keep GitLab and LLM credentials server-side. Logs and API errors must not expose them.
- A scan is intentionally a bounded FastAPI background task. Add a worker only after real scan load blocks request throughput.
- Use PostgreSQL parameter binding; never interpolate user values into SQL.
- Add one focused test for each parser, security path or branching workflow.

