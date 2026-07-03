"""HTML embedding for Jupyter notebooks and standalone documents.

The interactive diagram (zoom, pan, hover highlighting, click links) needs a
real DOM, so the JS bundle is inlined into the output HTML. In notebooks the
document is wrapped in a sandboxed same-origin iframe (srcdoc), which keeps
the bundle's globals out of the notebook page and works across JupyterLab,
classic Notebook, and VS Code.
"""

from __future__ import annotations

import html
import json

from . import _engine

_DEFAULT_HEIGHT = 480
_MAX_AUTO_HEIGHT = 640
_MIN_AUTO_HEIGHT = 160


def _document(source: str, theme, height: int | None) -> str:
    fixed = height is not None
    container_height = f"{height}px" if fixed else "100vh"
    resize_script = "" if fixed else f"""
  var svg = document.querySelector("#diagram svg");
  var frame = window.frameElement;
  if (svg && frame) {{
    var vb = svg.viewBox.baseVal;
    var w = document.documentElement.clientWidth || vb.width;
    var scale = Math.min(1, w / vb.width);
    var h = Math.ceil(vb.height * scale) + 4;
    h = Math.max({_MIN_AUTO_HEIGHT}, Math.min(h, {_MAX_AUTO_HEIGHT}));
    frame.style.height = h + "px";
  }}"""
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>html, body {{ margin: 0; padding: 0; }} #diagram {{ width: 100%; height: {container_height}; }}</style>
</head>
<body>
<div id="diagram"></div>
<script>{_engine.bundle_source()}</script>
<script>
(function () {{
  Flora.render({json.dumps(source)}, document.getElementById("diagram"), {{
    theme: {json.dumps(theme)},
    interactive: true,
  }});{resize_script}
}})();
</script>
</body>
</html>
"""


def standalone_html(source: str, theme, *, height: int | None = None) -> str:
    """A self-contained HTML document with the interactive diagram."""
    return _document(source, theme, height)


def notebook_html(source: str, theme, *, height: int | None = None) -> str:
    """An iframe-wrapped embed for IPython's rich display (_repr_html_)."""
    doc = _document(source, theme, height)
    initial = height if height is not None else _DEFAULT_HEIGHT
    return (
        f'<iframe srcdoc="{html.escape(doc)}" '
        f'style="width:100%;height:{initial}px;border:none;display:block" '
        'sandbox="allow-scripts allow-same-origin allow-popups" '
        'loading="lazy" title="Flora diagram"></iframe>'
    )
