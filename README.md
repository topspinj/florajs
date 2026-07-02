<p align="center">
  <img src="https://florajs.dev/logo.png" alt="Flora logo" width="140" />
</p>

# Flora

Beautiful, interactive diagrams from Mermaid-compatible syntax.

Flora takes the text-to-diagram syntax you already know from Mermaid and produces polished, interactive SVGs with better typography, colors, and hover/click/zoom out of the box.

## Try it

Open the [playground](https://florajs.dev/playground/) — write a diagram, watch it render live, and share it with a link. Diagrams are encoded in the URL fragment, so no account or server is involved.

## Install

```bash
npm install @topspinj/flora
```

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

### `toAST(input, options?)`

Parse input and return the AST without rendering.

### `toLayout(input, options?)`

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
  strict: false, // throw FloraParseError on parse errors instead of rendering best-effort
  onNodeClick: (nodeId) => console.log("clicked", nodeId),
  onNodeHover: (nodeId) => console.log("hovered", nodeId),
  onHighlight: (nodeId, upstream, downstream) => console.log("lineage", nodeId),
}
```

## Error handling

Flora's contract is **never blank, never silently wrong**:

- A line the parser can't understand is skipped whole and reported as a diagnostic (`{ line, col, message, severity }`) — it is never reinterpreted as extra nodes. Everything valid still renders.
- Mermaid styling and behavior directives (`classDef`, `class`, `style`, `linkStyle`, `click`, `%%{init}%%`) are recognized and deliberately ignored with `info` diagnostics — Flora handles styling through themes and clicks through `onNodeClick`.
- If nothing parses, `render()` shows an error card listing the diagnostics instead of a blank SVG.
- Pass `strict: true` to any API function to throw a `FloraParseError` (all diagnostics on `.warnings`) instead of rendering best-effort. The rehype plugin is strict by default so a broken diagram fails your build; pass `strict: false` to opt out.

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
