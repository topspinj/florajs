# Flora

Beautiful, interactive diagrams from Mermaid-compatible syntax.

Flora takes the text-to-diagram syntax you already know from Mermaid and produces polished, interactive SVGs with better typography, colors, and hover/click/zoom out of the box.

## Install

```bash
npm install florajs
```

## Usage

```javascript
import { render } from "florajs";

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
}
```

## Supported Diagram Types

- **Flowcharts** — `flowchart LR`, `flowchart TD`, etc.
- **ERD** — coming soon

## License

MIT
