# Spear frontend

Next.js App Router interface for the customer portal and FDE workspace. The entire product is Hebrew-first/RTL, with LTR treatment for code and repository paths.

## Start

```bash
npm ci
BACKEND_URL=http://127.0.0.1:8000 npm run dev
```

Open `http://localhost:3000`. `/api/*` is proxied to `BACKEND_URL`, which keeps backend credentials and internal service locations out of browser code.

## Routes

- `/`: customer/team entry and real team login.
- `/customer?name=...`: public docs, Spearoni and community submissions.
- `/team`: authenticated room, GitLab scan controls and Spearoni+ knowledge actions.

The settings panel in `/team` follows the locatoAi flow: edit the LLM endpoint and key, probe the model list before saving, choose `gemma4:31b-cloud`, and configure PostgreSQL plus the GitLab URL/token. Secrets are write-only and never returned to the browser.

Theme preference is stored as `spear-theme` in local storage. The inline bootstrap in `layout.tsx` applies it before paint to prevent a theme flash.

## Checks

```bash
npm run lint
npm run build
npm audit --omit=dev
```
