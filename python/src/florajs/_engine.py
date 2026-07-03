"""Runs the bundled Flora JS library in an embedded V8 (mini-racer).

The bundle's toSVGString/parse paths are DOM-free, so no browser or Node.js
is needed for SVG export.
"""

from __future__ import annotations

import json
import threading
from importlib import resources
from typing import Any

_BUNDLE_RESOURCE = "flora.iife.js"

_lock = threading.Lock()
_ctx = None


def bundle_source() -> str:
    path = resources.files("florajs").joinpath("_vendor", _BUNDLE_RESOURCE)
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise RuntimeError(
            "The Flora JS bundle is missing from this installation "
            "(florajs/_vendor/flora.iife.js). If you are working from a "
            "source checkout, run `npm run build:python` in the repository "
            "root to build and vendor it."
        ) from None


def _context():
    global _ctx
    with _lock:
        if _ctx is None:
            from py_mini_racer import MiniRacer

            ctx = MiniRacer()
            ctx.eval(bundle_source())
            _ctx = ctx
        return _ctx


def call(expression: str, *args: Any) -> Any:
    """Call a function on the Flora global with JSON-serialized args,
    returning the JSON-decoded result. `expression` is e.g. "Flora.parse"."""
    ctx = _context()
    js_args = ", ".join(json.dumps(a) for a in args)
    with _lock:
        result = ctx.eval(f"JSON.stringify({expression}({js_args}))")
    return json.loads(result)
