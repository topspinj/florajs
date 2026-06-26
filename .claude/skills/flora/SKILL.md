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
| Cylinder | `A[(Label)]` | Databases, storage |
| Queue | `A[[Label]]` | Message queues, buffers |

### Edges

```
A --> B          solid arrow
A ==> B          thick arrow
A -.-> B         dotted arrow
A -->|label| B   solid arrow with label
A ==>|label| B   thick arrow with label
A -.->|label| B  dotted arrow with label
```

### Edge Labels

Labels go between pipes immediately after the arrow: `-->|Yes|`. The label text cannot contain `|` characters.

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

## Design Guidelines

When generating diagrams, follow these principles:

1. **Default to top-down (`TD`).** Most diagrams — architectures, decision trees, pipelines with branching — look best vertical. Only use `LR` for simple, linear chains with no branching (A -> B -> C -> D). If the diagram has subgraphs, always use `TD` — horizontal subgraphs render poorly.

2. **Pick meaningful shapes.** Use cylinders for databases, diamonds for decisions, stadiums for start/end points, queues for message brokers. Don't use rectangles for everything.

3. **Use subgraphs sparingly.** Only add subgraphs when there are clear, distinct groupings (frontend/backend, environments). Don't over-organize — a flat diagram with 6-8 nodes doesn't need subgraphs. Subgraphs always pair with `TD` direction.

4. **Label edges when the relationship isn't obvious.** `-->|writes to|` is better than `-->` when connecting an API to a database. But `A --> B` is fine when the arrow's meaning is clear from context.

5. **Keep it lean.** Only create nodes for things the user explicitly mentioned. Don't invent intermediate steps or wrapper nodes. If the user says "redirect to dashboard", that's one node, not two. Fewer nodes = cleaner diagram.

6. **Keep IDs short, labels descriptive.** `db[(User Database)]` is better than `UserDatabase[(UserDatabase)]`.

## Rendering

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
  theme: "default",        // "default" | "tufte" | "digital"
  interactive: true,       // zoom, pan, hover, click
  onNodeClick: (id) => {}, // callback when node is clicked
  onHighlight: (id, upstream, downstream) => {}, // lineage callback
});
```

### Available Themes

- **default** — Clean, colorful, with gradients and shadows. Good for presentations.
- **tufte** — Minimal, muted. Good for documentation and technical writing.
- **digital** — Dark-friendly, high contrast. Good for dashboards and developer tools.

## dbt Manifest Support

When the user provides a dbt `manifest.json` or asks to visualize dbt lineage, read `references/dbt.md` for the full guide on parsing manifests, mapping resource types to Flora shapes, and handling large projects.

## Output Format

Always output the Flora syntax in a fenced code block. If the user just wants the diagram definition (most common), use a plain code block. If they want integration code, use a `javascript` code block with the `render()` call.

When modifying an existing diagram, show the complete updated syntax — not a diff or partial snippet.
