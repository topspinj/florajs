# florajs

Beautiful, interactive diagrams from Mermaid-compatible syntax — the Python
interface to [Flora](https://github.com/topspinj/florajs).

- **Jupyter-native**: diagrams display interactively (zoom, pan, hover
  highlighting, click links) right in the notebook.
- **Headless SVG export**: `to_svg()` runs the Flora renderer in an embedded
  V8 engine — no browser, no Node.js.
- **Two ways in**: a programmatic builder, or raw Flora/Mermaid syntax.

```
pip install florajs
```

## Quick start

```python
from florajs import Flowchart

fc = Flowchart("LR", theme="tufte")
fc.node("raw", "Raw events", shape="cylinder")
fc.node("clean", "Cleaned", shape="stadium")
fc.edge("raw", "clean", "dbt run")
fc  # displays interactively in Jupyter
```

Or from raw Flora/Mermaid syntax:

```python
from florajs import Diagram

d = Diagram("""
flowchart TD
  a[Start] --> b{Decide}
  b -->|yes| c([Done])
  b -->|no| a
""", theme="sketch")
d.to_svg_file("decision.svg")
```

## Building diagrams

```python
fc = Flowchart("TD")                       # TB | TD | BT | LR | RL

fc.node("a", "Label", shape="diamond")     # rect | rounded | circle | diamond
                                           # stadium | cylinder | queue
fc.edge("a", "b", "maybe",                 # optional edge label
        style="dotted",                    # solid | dotted | thick
        arrow="bidirectional")             # arrow | open | bidirectional

with fc.subgraph("Ingest"):                # groups nest
    fc.node("api", "API")
    fc.node("queue", "Queue", shape="queue")

fc.link("api", "https://example.com/api",  # click-through links
        tooltip="API docs", target="_blank")
```

Every builder method chains: `fc.node("a").edge("a", "b")`.

## Rendering

| Method | Output |
| --- | --- |
| `to_svg()` | SVG string (headless, no browser needed) |
| `to_svg_file(path)` | SVG file |
| `to_html()` | standalone interactive HTML document |
| `to_html_file(path)` | standalone interactive HTML file |
| `_repr_html_` | automatic interactive display in Jupyter |
| `source` | the generated Flora syntax |
| `warnings` | parser diagnostics |

## Themes

Presets: `default`, `tufte`, `digital`, `sketch`. Or pass a dict of
[theme overrides](https://github.com/topspinj/florajs#theming):

```python
Diagram(src, theme={"background": "#0b1021", "fontSize": 13})
```

## Errors you can trust

Flora never renders silently wrong output. Lines that cannot be parsed are
skipped and reported as a `FloraSyntaxWarning`; pass `strict=True` to raise
`FloraParseError` instead:

```python
Diagram(src, strict=True).to_svg()  # raises FloraParseError on any skipped line
```

## Development

The package embeds a JS bundle built from the repository root:

```
npm run build:python        # builds and vendors flora.iife.js
cd python
pip install -e ".[dev]"
pytest
```
