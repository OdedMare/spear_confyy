# Frontend guidance

- Read `design-system/spear/MASTER.md` before visual changes.
- Keep customer text Hebrew and page direction RTL; use `dir="ltr"` for code, refs and paths.
- Use semantic theme tokens from `globals.css`; do not add dark-only hardcoded surfaces.
- Keep dark mode primary and light mode complete. The theme toggle must remain keyboard accessible.
- Use Lucide icons already installed; no emoji navigation icons and no new UI dependency for native HTML behavior.
- API failures need visible recovery copy. Never silently replace real failures with fake/demo data.
- Run both lint and the production build before handoff.

