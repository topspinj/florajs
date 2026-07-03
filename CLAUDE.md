# Flora

Beautiful, interactive diagrams from Mermaid-compatible syntax.

## Conventions

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>: <short description>
```

Types:
- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `test:` — adding or updating tests
- `chore:` — build, CI, dependency updates

Keep the subject line under 72 characters. Use the body for details if needed.

### GitHub issues

Follow the same prefix convention for issue titles:

```
feat: render and collapse subgraphs
fix: edge labels overlap nodes at small sizes
docs: add API reference for layout options
```

### Branch names

Use the format `<type>/<short-description>`:

```
feat/subgraph-rendering
fix/edge-label-overlap
```

### Documentation

Every new feature, API change, or new type/interface **must** be documented in the public-facing docs at `site/src/pages/docs.astro`. This includes:
- New API functions → add to the API Reference section
- New component props or integrations → add to the Integrations section
- New or changed TypeScript types → add to the Types section
- New theme presets or options → add to the Theming section

## Project structure

- `src/parser/` — Tokenizer and flowchart parser (Mermaid-compatible syntax)
- `src/layout/` — Graph layout using dagre
- `src/renderer/` — SVG rendering with interactivity (zoom, pan, hover, click)
- `src/themes/` — Theme definitions (default, tufte, digital, sketch)
- `src/types.ts` — All shared TypeScript types
- `python/` — Python package (`florajs` on PyPI): Jupyter display + headless SVG export via an embedded V8 running the vendored IIFE bundle (`npm run build:python` vendors it)
- `skills/flora/` — the Flora skill for Claude Code, distributed as a plugin (manifests in `.claude-plugin/`). `.claude/skills/flora` is a symlink to it so the skill auto-loads when working in this repo. Keep the skill's syntax/API reference in sync with `src/` changes.
- `playground.html` — Browser-based playground for testing diagrams (run `npx serve .` and open `/playground.html`)

## Commands

- `npm run build` — Build with tsup
- `npm run build:python` — Build and vendor the JS bundle into `python/src/florajs/_vendor/`
- `cd python && .venv/bin/pytest` — Run Python package tests (after `build:python`)
- `npm run dev` — Build in watch mode
- `npm run test` — Run tests with vitest (watch mode)
- `npm run test:run` — Run tests once
- `npm run lint` — Type-check with tsc
- `npx serve .` — Serve locally for playground (open `/playground.html`)
