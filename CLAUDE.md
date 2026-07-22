# CLAUDE.md — Spear

## Product contract

Spear is a Hebrew-first, RTL knowledge platform. Customers see only published documents and public submissions. Team members are FDEs; Spearoni+ may access internal code and knowledge. Never leak internal context, repository content, tokens, prompts or private chat into customer responses.

## Repository map

- `frontend/`: Next.js App Router, React, TypeScript and plain CSS.
- `backend/`: FastAPI targeting Python 3.8.10 exactly.
- `design-system/spear/MASTER.md`: visual source of truth.
- `compose.yaml`: local production-like stack with PostgreSQL.

## Working rules

1. Keep all customer-facing copy Hebrew and RTL. Code, paths and commands stay LTR.
2. Dark mode is the default; every visual change must also work in light mode.
3. Use the existing Lucide icon family. Do not use emoji as structural icons.
4. Preserve 44px touch targets, visible focus states and reduced-motion behavior.
5. Backend code must remain valid on Python 3.8.10: use `List[str]`/`Optional[str]`, not `list[str]` or `X | None`.
6. Do not add Redis, queues, object storage or a vector database without a measured need.
7. Never send `SPEAR_GITLAB_TOKEN`, `SPEAR_LLM_API_KEY`, session secrets or internal document content to public endpoints.
8. Schema changes belong in `init_database()` until a second deployment needs formal migrations.

## Checks before handing off

```bash
cd frontend && npm run lint && npm run build
cd backend && PYTHONPATH=. python -m pytest
docker compose config
```

