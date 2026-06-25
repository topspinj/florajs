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

## Project structure

- `src/parser/` — Tokenizer and flowchart parser (Mermaid-compatible syntax)
- `src/layout/` — Graph layout using dagre
- `src/renderer/` — SVG rendering with interactivity (zoom, pan, hover, click)
- `src/themes/` — Theme definitions (default, tufte, digital)
- `src/types.ts` — All shared TypeScript types

## Commands

- `npm run build` — Build with tsup
- `npm run dev` — Build in watch mode
- `npm run test` — Run tests with vitest (watch mode)
- `npm run test:run` — Run tests once
- `npm run lint` — Type-check with tsc
