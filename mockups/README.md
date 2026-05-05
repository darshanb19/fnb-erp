# F&B ERP — Mockups Harness

Phase 2c visual mockup foundation. Vite + React 18 + TypeScript + Tailwind v4 + shadcn/ui.

## First-time setup

After cloning, point git at the in-tree pre-commit hook from the **repo root**:

```bash
git config core.hooksPath mockups/.git-hooks
```

This is stored in your local `.git/config` and isn't committable, so every clone has to do it once. The hook enforces DESIGN.md token rules on staged `.ts`/`.tsx` files under `mockups/src/{screens,shell,dev,lib,pages}/`. CI doesn't enforce token rules — the local hook is the safety net during scaffolding and Phase 4 work. See `mockups/.git-hooks/test-cases.md` and plan §10.8 for what the hook checks.

To verify:

```bash
git config --get core.hooksPath   # → mockups/.git-hooks
bash mockups/.git-hooks/run-tests.sh
```

## Run

```bash
npm install
npm run dev
```

## Tokens

Tokens come from `DESIGN.md` §5–§8 (project root) and are wired through `src/globals.css` (Tailwind v4 `@theme`).

See project root `claude.md` for current phase and rules.
