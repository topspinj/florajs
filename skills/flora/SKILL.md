---
name: flora
description: >
  Generate Flora diagram syntax and render interactive flowcharts. Use this skill whenever the user wants to
  create a diagram, draw a flowchart, visualize architecture, map out a data pipeline, show relationships
  between components, or describe any system they want to see as a graph. Also trigger when the user provides
  or references a dbt manifest.json and wants to visualize lineage, or says things like "show me the lineage",
  "diagram this manifest", or "visualize my dbt project". Trigger on phrases like "draw", "diagram",
  "visualize", "flowchart", "map out", "show the flow", "lineage", "manifest", or when the user describes
  a system and would clearly benefit from a visual representation — even if they don't explicitly ask for a diagram.
---

# Flora Diagram Skill

Flora renders interactive SVG diagrams from a Mermaid-compatible text syntax. Your job is to translate what the user describes into valid Flora syntax, and when possible, render it.

## When to use this skill

- User asks to diagram, visualize, or draw something
- User describes a system, pipeline, or architecture that would benefit from a visual
- User wants to modify an existing Flora diagram
- User is working in a codebase that uses `@topspinj/flora`

## Syntax Reference

### Structure

Every diagram starts with `flowchart` (or `graph`) followed by a direction:

```
flowchart TD
  A[Start] --> B[End]
```

### Directions

| Code | Meaning |
|------|---------|
| `TB` or `TD` | Top to bottom (default) |
| `BT` | Bottom to top |
| `LR` | Left to right |
| `RL` | Right to left |

Use `LR` for pipelines and horizontal flows. Use `TD` for hierarchies and vertical flows.

### Node Shapes

Nodes are defined inline with their shape syntax. If a node appears multiple times, define its shape on first use — later references use just the ID.

| Shape | Syntax | Use for |
|-------|--------|---------|
| Rectangle | `A[Label]` | Default, processes, steps |
| Rounded | `A(Label)` | Intermediate processes |
| Diamond | `A{Label}` | Decisions, conditions |
| Stadium | `A([Label])` | Terminals, start/end |
| Circle | `A((Label))` | Events, connectors |
| Cylinder | `A[(Label)]` | Databases, storage |
| Queue | `A[[Label]]` | Message queues, buffers |

To put brackets or parentheses inside a label, wrap the whole label in double quotes: `A["uses [square] brackets"]`. The quotes are stripped from the rendered label (Mermaid behavior); this also works for pipe edge labels (`-->|"yes"|`).

### Edges

```
A --> B          solid arrow
A ==> B          thick arrow
A -.-> B         dotted arrow
A --- B          open link (no arrowhead — non-directional relationships)
A <--> B         bidirectional arrow (two-way communication)
A -->|label| B   arrow with label
```

Dotted and thick edges follow the same pattern: `-.-` / `===` for open, `<-.->` / `<==>` for bidirectional. Chain multiple nodes in one line: `A --> B --> C --> D`.

### Edge Labels

Labels go between pipes immediately after the arrow: `-->|Yes|`. The label text cannot contain `|` characters. Inline labels between dashes also work: `A -- label --> B`.

### Node Links

Attach a clickable URL to a node with the `click` directive — useful for linking dbt models to their docs, or services to their dashboards:

```
click A "https://docs.example.com" "hover tooltip"
click B "https://api.example.com" _blank
```

The tooltip and target (`_blank` etc.) are optional. Click lines may appear before or after the node they reference.

### Subgraphs

Group related nodes into collapsible containers:

```
flowchart TD
  subgraph Backend
    API[API Server] --> DB[(Database)]
  end
  subgraph Frontend
    UI[Web App] --> API
  end
```

Subgraphs can be nested. Each subgraph needs a matching `end`.

### Comments

```
%% This is a comment
A --> B  %% Inline comments work too
```

### Node IDs

- IDs can contain letters, numbers, hyphens, and underscores: `my-node`, `node_1`
- IDs are case-sensitive
- Keep IDs short and descriptive — they're used internally, labels are what users see

### Mermaid features to avoid

Flora is a Mermaid-compatible **subset**, not full Mermaid. Do not emit:

- Styling directives: `classDef`, `class`, `style`, `linkStyle`, `%%{init}%%` — Flora recognizes and deliberately ignores these (styling goes through themes)
- Mermaid's `click A myCallback` callback form — deliberately ignored; use the URL form (`click A "url"`) or the `onNodeClick` option instead
- Other diagram types: `sequenceDiagram`, `classDiagram`, `erDiagram`, `gantt`, etc. Only `flowchart`/`graph` is supported.

Lines Flora can't parse are skipped whole and reported as diagnostics — valid lines still render. Stick to the syntax documented above and the output will be clean.

## Design Guidelines

When generating diagrams, follow these principles:

1. **Default to top-down (`TD`).** Most diagrams — architectures, decision trees, pipelines with branching — look best vertical. Only use `LR` for simple, linear chains with no branching (A -> B -> C -> D). If the diagram has subgraphs, always use `TD` — horizontal subgraphs render poorly.

2. **Pick meaningful shapes.** Use cylinders for databases, diamonds for decisions, stadiums for start/end points, queues for message brokers. Don't use rectangles for everything.

3. **Use subgraphs sparingly.** Only add subgraphs when there are clear, distinct groupings (frontend/backend, environments). Don't over-organize — a flat diagram with 6-8 nodes doesn't need subgraphs. Subgraphs always pair with `TD` direction.

4. **Label edges when the relationship isn't obvious.** `-->|writes to|` is better than `-->` when connecting an API to a database. But `A --> B` is fine when the arrow's meaning is clear from context.

5. **Keep it lean.** Only create nodes for things the user explicitly mentioned. Don't invent intermediate steps or wrapper nodes. If the user says "redirect to dashboard", that's one node, not two. Fewer nodes = cleaner diagram.

6. **Keep IDs short, labels descriptive.** `db[(User Database)]` is better than `UserDatabase[(UserDatabase)]`.

## Rendering

### Playground share link

Always offer a live link alongside the syntax — it works even if the user has nothing installed. Write the diagram to a temp file with a file-writing tool, then pass the path to the bundled script (theme is optional):

```bash
node scripts/share-link.mjs /tmp/diagram.flora tufte
```

Run it from this skill's directory. Don't pipe the syntax in via `echo` — arrows like `-->|label|` are full of shell redirection characters, and a quoting slip corrupts the encoded diagram silently while the displayed one stays correct. The script prints the diagram it encoded to stderr; check it matches what you showed the user. The URL (`https://florajs.dev/playground/#flora:...`) opens the diagram in the interactive playground, where the user can view, edit, and re-share it.

### JavaScript

If the user's project has `@topspinj/flora` installed, output runnable code:

```javascript
import { render } from "@topspinj/flora";

render(`flowchart LR
  A[Input] --> B[Process] --> C[Output]`,
  document.getElementById("diagram")
);
```

### Render Options

```javascript
render(syntax, element, {
  theme: "default",        // "default" | "tufte" | "digital" | "sketch"
  interactive: true,       // zoom, pan, hover, click
  strict: false,           // true = throw FloraParseError instead of best-effort render
  onNodeClick: (id) => {}, // callback when node is clicked
  onNodeHover: (id) => {}, // callback when node is hovered
  onHighlight: (id, upstream, downstream) => {}, // lineage callback
});
```

### Available Themes

- **default** — Clean, colorful, with gradients and shadows. Good for presentations.
- **tufte** — Minimal, muted. Good for documentation and technical writing.
- **digital** — Dark-friendly, high contrast. Good for dashboards and developer tools.
- **sketch** — Hand-drawn look. Good for informal docs and brainstorming.

### Python / Jupyter

If the user works in Python (the `florajs` package on PyPI), diagrams display interactively in notebooks and export to SVG headlessly:

```python
from florajs import Diagram

d = Diagram("""
flowchart TD
  a[Start] --> b{Decide}
  b -->|yes| c([Done])
""", theme="sketch")
d                          # displays interactively in Jupyter
d.to_svg_file("out.svg")   # headless SVG export (no browser needed)
```

There is also a programmatic builder (`from florajs import Flowchart`) with `.node(id, label, shape=...)` and `.edge(src, dst, label)` methods.

## dbt Manifest Support

When the user provides a dbt `manifest.json` or asks to visualize dbt lineage, read `references/dbt.md` for the full guide on parsing manifests, mapping resource types to Flora shapes, and handling large projects.

## Output Format

Always output the Flora syntax in a fenced code block, followed by a playground share link so the user can see the rendered diagram immediately. If the user just wants the diagram definition (most common), use a plain code block. If they want integration code, use a `javascript` code block with the `render()` call.

When modifying an existing diagram, show the complete updated syntax — not a diff or partial snippet.
