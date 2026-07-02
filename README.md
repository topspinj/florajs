# Flora

Beautiful, interactive diagrams from Mermaid-compatible syntax.

Flora takes the text-to-diagram syntax you already know from Mermaid and produces polished, interactive SVGs with better typography, colors, and hover/click/zoom out of the box.

## Install

```bash
npm install @topspinj/flora
```

Or drop it into any HTML page with no build step — the CDN bundle exposes `window.Flora` and registers a `<flora-diagram>` custom element:

```html
<script src="https://unpkg.com/@topspinj/flora"></script>

<flora-diagram theme="default">
flowchart TD
  A[Dashboard] --> B[API]
  B --> C[(Database)]
</flora-diagram>
```

Diagrams are interactive (zoom, pan, click-to-highlight) by default — set `interactive="false"` to disable. The element re-renders when its text content or `theme`/`interactive` attributes change.

## Usage

```javascript
import { render } from "@topspinj/flora";

render(
  `flowchart LR
    A[Start] --> B{Decision}
    B -->|Yes| C[Do thing]
    B -->|No| D[Other thing]`,
  document.getElementById("diagram")
);
```

## API

### `render(input, element, options?)`

Parse and render a diagram into a DOM element.

### `toSVGElement(input, options?)`

Returns an SVGSVGElement without attaching it to the DOM.

### `toAST(input)`

Parse input and return the AST without rendering.

### `toLayout(input)`

Parse input and return computed node/edge positions.

## Options

```typescript
{
  theme: {
    background: "#ffffff",
    nodeColors: { fill: "#f0f4ff", stroke: "#4f6df5", text: "#1e293b" },
    edgeColors: { stroke: "#94a3b8", label: "#64748b" },
    fontFamily: "Inter, sans-serif",
    fontSize: 14,
    nodeRadius: 8,
    shadow: true,
  },
  interactive: true,
  onNodeClick: (nodeId) => console.log("clicked", nodeId),
  onNodeHover: (nodeId) => console.log("hovered", nodeId),
  onHighlight: (nodeId, upstream, downstream) => console.log("lineage", nodeId),
}
```

## Node Shapes

| Shape | Syntax | Example |
|-------|--------|---------|
| Rectangle | `[text]` | `A[Start]` |
| Rounded | `(text)` | `A(Process)` |
| Diamond | `{text}` | `A{Decision}` |
| Stadium | `([text])` | `A([Terminal])` |
| Cylinder | `[(text)]` | `A[(Database)]` |
| Queue | `[[text]]` | `A[[Kafka]]` |

## Subgraphs

Group nodes into collapsible subgraphs:

```
flowchart TD
  subgraph Backend
    API --> DB[(Database)]
  end
  subgraph Frontend
    UI --> API
  end
```

Subgraphs render with a dashed border and a label pill. Nested subgraphs are supported.

## Interactivity

Flora diagrams are interactive by default:

- **Zoom & pan** — scroll to zoom, drag to pan
- **Hover** — nodes highlight on hover
- **Lineage highlighting** — click any node to trace its upstream and downstream connections. Connected nodes and edges stay highlighted while everything else fades out. Click the node again, press Escape, or click the background to clear.

```javascript
render(input, element, {
  interactive: true,
  onNodeClick: (nodeId) => console.log("clicked", nodeId),
  onNodeHover: (nodeId) => console.log("hovered", nodeId),
  onHighlight: (nodeId, upstream, downstream) => {
    console.log("lineage", { nodeId, upstream, downstream });
  },
});
```

## Supported Diagram Types

- **Flowcharts** — `flowchart LR`, `flowchart TD`, etc.
- **ERD** — coming soon

## License

MIT
