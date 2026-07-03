"""Diagram objects: raw Flora/Mermaid source and a programmatic builder."""

from __future__ import annotations

import json
import re
import warnings as _warnings
from pathlib import Path
from typing import Any, Iterator, Union

from contextlib import contextmanager

from . import _engine
from ._errors import FloraParseError, FloraSyntaxWarning, ParseWarning
from ._notebook import notebook_html, standalone_html

Theme = Union[str, dict]

THEMES = ("default", "tufte", "digital", "sketch")

_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")

# Words the tokenizer treats specially at statement level; they cannot be
# node or subgraph ids.
_RESERVED_IDS = {
    "flowchart", "graph", "subgraph", "end", "click",
    "classDef", "class", "style", "linkStyle", "direction",
    "TB", "TD", "BT", "LR", "RL",
}

_DIRECTIONS = ("TB", "TD", "BT", "LR", "RL")

# shape -> (opening delimiter, closing delimiter, balance pair)
_SHAPES = {
    "rect": ("[", "]", "[]"),
    "rounded": ("(", ")", "()"),
    "circle": ("((", "))", "()"),
    "diamond": ("{", "}", "{}"),
    "stadium": ("([", "])", "[]"),
    "cylinder": ("[(", ")]", "()"),
    "queue": ("[[", "]]", "[]"),
}

_EDGE_STYLES = ("solid", "dotted", "thick")
_ARROW_TYPES = ("arrow", "open", "bidirectional")

# (style, arrow) -> connector
_CONNECTORS = {
    ("solid", "arrow"): "-->",
    ("solid", "open"): "---",
    ("solid", "bidirectional"): "<-->",
    ("dotted", "arrow"): "-.->",
    ("dotted", "open"): "-.-",
    ("dotted", "bidirectional"): "<-.->",
    ("thick", "arrow"): "==>",
    ("thick", "open"): "===",
    ("thick", "bidirectional"): "<==>",
}

_LINK_TARGETS = ("_self", "_blank", "_parent", "_top")


def _check_id(id: str, kind: str) -> str:
    if not isinstance(id, str) or not _ID_RE.match(id):
        raise ValueError(
            f"invalid {kind} id {id!r}: ids may only contain letters, digits, "
            "'_' and '-'"
        )
    if "--" in id or id.endswith("-"):
        raise ValueError(
            f"invalid {kind} id {id!r}: '--' inside or '-' at the end of an id "
            "is read as the start of an arrow"
        )
    if id in _RESERVED_IDS:
        raise ValueError(f"invalid {kind} id {id!r}: reserved word in Flora syntax")
    return id


def _check_label(label: str, shape: str) -> str:
    opening, _closing, pair = _SHAPES[shape]
    if "\n" in label:
        raise ValueError(f"label {label!r} cannot contain a newline")
    open_ch, close_ch = pair[0], pair[1]
    depth = 0
    for ch in label:
        if ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth < 0:
                break
    if depth != 0:
        raise ValueError(
            f"label {label!r} has unbalanced '{open_ch}{close_ch}' delimiters, "
            f"which would break the {shape} shape syntax {opening}...{_closing}"
        )
    # "[(", "((" etc. after the opening delimiter would be read as a
    # different shape.
    if len(opening) == 1 and label[:1] in ("[", "("):
        raise ValueError(
            f"label {label!r} cannot start with {label[0]!r} for shape "
            f"{shape!r} — it would be read as a different node shape; "
            "add a leading space or pick another shape"
        )
    return label


def _quote(text: str, what: str) -> str:
    """Quote a string for click statements. Flora quoted strings have no
    escape sequences, so the text must avoid one of the two quote chars."""
    if "\n" in text:
        raise ValueError(f"{what} {text!r} cannot contain a newline")
    if '"' not in text:
        return f'"{text}"'
    if "'" not in text:
        return f"'{text}'"
    raise ValueError(f"{what} {text!r} cannot contain both single and double quotes")


def _check_theme(theme: Theme) -> Theme:
    if isinstance(theme, str):
        if theme not in THEMES:
            raise ValueError(f"unknown theme {theme!r}: expected one of {THEMES}")
        return theme
    if isinstance(theme, dict):
        return theme
    raise TypeError("theme must be a preset name or a dict of theme overrides")


class Diagram:
    """A diagram from raw Flora (Mermaid-compatible) source.

    In Jupyter, the object displays as an interactive diagram (zoom, pan,
    hover highlighting). Elsewhere, use to_svg() / to_svg_file().

    Flora never renders silently wrong output: lines that cannot be parsed
    are skipped and reported. With strict=False (default) they surface as a
    FloraSyntaxWarning; with strict=True rendering raises FloraParseError.
    """

    def __init__(self, source: str, *, theme: Theme = "default", strict: bool = False):
        self._source = source
        self.theme = _check_theme(theme)
        self.strict = strict

    @property
    def source(self) -> str:
        """The Flora syntax for this diagram."""
        return self._source

    # -- parsing ---------------------------------------------------------

    @property
    def warnings(self) -> list[ParseWarning]:
        """Diagnostics from parsing the source (empty when all is well)."""
        result = _engine.call("Flora.parse", self.source)
        return [ParseWarning(**w) for w in result["warnings"]]

    def _handle_diagnostics(self, raw_warnings: list[dict], unsupported: str | None) -> None:
        parsed = [ParseWarning(**w) for w in raw_warnings]
        errors = [w for w in parsed if w.severity == "error"]
        if unsupported is not None:
            message = (
                f"unsupported diagram type {unsupported!r}: Flora currently "
                "supports flowchart diagrams only"
            )
            if self.strict:
                raise FloraParseError(message, parsed)
            _warnings.warn(message, FloraSyntaxWarning, stacklevel=3)
            return
        if errors:
            summary = "; ".join(str(w) for w in errors[:3])
            if len(errors) > 3:
                summary += f"; and {len(errors) - 3} more"
            message = f"some lines could not be parsed and were skipped: {summary}"
            if self.strict:
                raise FloraParseError(message, parsed)
            _warnings.warn(message, FloraSyntaxWarning, stacklevel=3)

    # -- rendering -------------------------------------------------------

    def to_svg(self) -> str:
        """Render to an SVG string (no browser or Node.js required)."""
        result = _engine.call("Flora.toSVGString", self.source, {"theme": self.theme})
        self._handle_diagnostics(result["warnings"], result.get("unsupportedType"))
        return result["svg"]

    def to_svg_file(self, path: str | Path) -> Path:
        """Render to an SVG file and return its path."""
        path = Path(path)
        path.write_text(self.to_svg(), encoding="utf-8")
        return path

    def to_html(self, *, height: int | None = None) -> str:
        """A standalone HTML document with the interactive diagram."""
        self._check()
        return standalone_html(self.source, self.theme, height=height)

    def to_html_file(self, path: str | Path, *, height: int | None = None) -> Path:
        """Write a standalone interactive HTML document and return its path."""
        path = Path(path)
        path.write_text(self.to_html(height=height), encoding="utf-8")
        return path

    def _check(self) -> None:
        """Run diagnostics without rendering (warn or raise as configured)."""
        result = _engine.call("Flora.parse", self.source)
        unsupported = None
        if result["ast"].get("type") == "unsupported":
            unsupported = result["ast"]["detectedType"]
        self._handle_diagnostics(result["warnings"], unsupported)

    def _repr_html_(self) -> str:
        self._check()
        return notebook_html(self.source, self.theme)

    def __repr__(self) -> str:
        first = self.source.strip().splitlines()[0] if self.source.strip() else ""
        return f"{type(self).__name__}({first!r}…)"


class Flowchart(Diagram):
    """Build a flowchart programmatically; renders like Diagram.

    >>> fc = Flowchart("LR", theme="tufte")
    >>> fc.node("raw", "Raw events", shape="cylinder")
    >>> fc.node("clean", "Cleaned")
    >>> fc.edge("raw", "clean", "dbt run")
    >>> svg = fc.to_svg()
    """

    def __init__(self, direction: str = "TD", *, theme: Theme = "default", strict: bool = False):
        if direction not in _DIRECTIONS:
            raise ValueError(f"invalid direction {direction!r}: expected one of {_DIRECTIONS}")
        super().__init__("", theme=theme, strict=strict)
        self.direction = direction
        self._nodes: dict[str, dict[str, Any]] = {}
        self._edges: list[dict[str, Any]] = []
        self._clicks: list[str] = []
        # subgraph id -> {"label", "parent", "nodes": [ids], "children": [ids]}
        self._subgraphs: dict[str, dict[str, Any]] = {}
        self._subgraph_stack: list[str] = []

    # -- building --------------------------------------------------------

    def node(
        self,
        id: str,
        label: str | None = None,
        *,
        shape: str = "rect",
        href: str | None = None,
        tooltip: str | None = None,
        target: str | None = None,
    ) -> "Flowchart":
        """Add (or redefine) a node. Returns self for chaining.

        href/tooltip/target attach a clickable link to the node.
        """
        _check_id(id, "node")
        if shape not in _SHAPES:
            raise ValueError(f"unknown shape {shape!r}: expected one of {tuple(_SHAPES)}")
        if label is not None:
            _check_label(label, shape)
        self._nodes[id] = {"label": label, "shape": shape}
        if self._subgraph_stack:
            members = self._subgraphs[self._subgraph_stack[-1]]["nodes"]
            if id not in members:
                members.append(id)
        if href is not None:
            self.link(id, href, tooltip=tooltip, target=target)
        elif tooltip is not None or target is not None:
            raise ValueError("tooltip/target require href")
        return self

    def edge(
        self,
        source: str,
        dest: str,
        label: str | None = None,
        *,
        style: str = "solid",
        arrow: str = "arrow",
    ) -> "Flowchart":
        """Connect two nodes. Nodes that were never defined with node()
        are created automatically with their id as label. Returns self.

        style: solid | dotted | thick.
        arrow: arrow (directed) | open (no arrowheads) | bidirectional.
        """
        _check_id(source, "node")
        _check_id(dest, "node")
        if style not in _EDGE_STYLES:
            raise ValueError(f"unknown edge style {style!r}: expected one of {_EDGE_STYLES}")
        if arrow not in _ARROW_TYPES:
            raise ValueError(f"unknown arrow type {arrow!r}: expected one of {_ARROW_TYPES}")
        if label is not None:
            if "|" in label or "\n" in label:
                raise ValueError(f"edge label {label!r} cannot contain '|' or a newline")
        self._edges.append(
            {"source": source, "dest": dest, "label": label, "style": style, "arrow": arrow}
        )
        return self

    def link(
        self,
        id: str,
        href: str,
        *,
        tooltip: str | None = None,
        target: str | None = None,
    ) -> "Flowchart":
        """Attach a clickable link to a node (Mermaid `click` directive)."""
        _check_id(id, "node")
        if re.match(r"^(javascript|data|vbscript):", href, re.IGNORECASE):
            raise ValueError(f"unsafe URL scheme in link for {id!r}: {href!r}")
        if target is not None and target not in _LINK_TARGETS:
            raise ValueError(f"invalid link target {target!r}: expected one of {_LINK_TARGETS}")
        parts = ["click", id, _quote(href, "link URL")]
        if tooltip is not None:
            parts.append(_quote(tooltip, "link tooltip"))
        if target is not None:
            parts.append(target)
        self._clicks.append(" ".join(parts))
        return self

    @contextmanager
    def subgraph(self, id: str, *, label: str | None = None) -> Iterator["Flowchart"]:
        """Group nodes: every node() defined inside the block belongs to the
        subgraph. Blocks nest.

        >>> with fc.subgraph("ingest"):
        ...     fc.node("api", "API")

        Note: Flora displays the subgraph id as its label, so ids double as
        titles. A separate label is not supported yet (label= reserved).
        """
        _check_id(id, "subgraph")
        if label is not None:
            raise ValueError(
                "subgraph labels separate from the id are not supported by the "
                "Flora parser yet; encode the title in the id (e.g. 'Data_Prep')"
            )
        if id in self._subgraphs:
            raise ValueError(f"duplicate subgraph id {id!r}")
        if id in self._nodes:
            raise ValueError(f"subgraph id {id!r} collides with a node id")
        parent = self._subgraph_stack[-1] if self._subgraph_stack else None
        self._subgraphs[id] = {"parent": parent, "nodes": [], "children": []}
        if parent is not None:
            self._subgraphs[parent]["children"].append(id)
        self._subgraph_stack.append(id)
        try:
            yield self
        finally:
            self._subgraph_stack.pop()

    # -- source generation -------------------------------------------------

    def _node_line(self, id: str) -> str:
        spec = self._nodes[id]
        if spec["label"] is None and spec["shape"] == "rect":
            return id
        opening, closing, _ = _SHAPES[spec["shape"]]
        label = spec["label"] if spec["label"] is not None else id
        return f"{id}{opening}{label}{closing}"

    def _subgraph_lines(self, id: str, indent: str) -> list[str]:
        sub = self._subgraphs[id]
        lines = [f"{indent}subgraph {id}"]
        for node_id in sub["nodes"]:
            lines.append(f"{indent}  {self._node_line(node_id)}")
        for child in sub["children"]:
            lines.extend(self._subgraph_lines(child, indent + "  "))
        lines.append(f"{indent}end")
        return lines

    @property
    def source(self) -> str:
        lines = [f"flowchart {self.direction}"]
        in_subgraph = {n for sub in self._subgraphs.values() for n in sub["nodes"]}
        for id in self._nodes:
            if id not in in_subgraph:
                lines.append(f"  {self._node_line(id)}")
        for id, sub in self._subgraphs.items():
            if sub["parent"] is None:
                lines.extend(self._subgraph_lines(id, "  "))
        for e in self._edges:
            connector = _CONNECTORS[(e["style"], e["arrow"])]
            label = f"|{e['label']}|" if e["label"] else ""
            lines.append(f"  {e['source']} {connector}{label} {e['dest']}")
        lines.extend(f"  {c}" for c in self._clicks)
        return "\n".join(lines) + "\n"
