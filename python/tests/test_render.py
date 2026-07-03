"""End-to-end rendering through the embedded V8 engine.

These tests exercise the real vendored JS bundle; run `npm run build:python`
first if the bundle is missing.
"""

import warnings

import pytest

from florajs import Diagram, Flowchart, FloraParseError, FloraSyntaxWarning

SIMPLE = """
flowchart TD
  a[Start] --> b{Decide}
  b -->|yes| c([Done])
"""


def test_to_svg_returns_svg():
    svg = Diagram(SIMPLE).to_svg()
    assert svg.startswith("<svg")
    assert "Start" in svg
    assert "Decide" in svg


def test_builder_round_trips_through_parser():
    fc = Flowchart("LR", theme="tufte")
    fc.node("raw", "Raw events", shape="cylinder")
    fc.node("clean", "Cleaned", shape="stadium")
    with fc.subgraph("models"):
        fc.node("stg", "stg_events")
        fc.node("fct", "fct_events")
    fc.edge("raw", "stg", "load")
    fc.edge("stg", "fct", style="dotted")
    fc.edge("fct", "clean", arrow="bidirectional")
    fc.link("raw", "https://example.com/warehouse", tooltip="warehouse")

    assert fc.warnings == []
    svg = fc.to_svg()
    assert "Raw events" in svg
    assert "stg_events" in svg
    assert "models" in svg  # subgraph label
    assert "https://example.com/warehouse" in svg


def test_theme_presets_render():
    for theme in ("default", "tufte", "digital", "sketch"):
        svg = Diagram(SIMPLE, theme=theme).to_svg()
        assert svg.startswith("<svg")


def test_theme_overrides_dict():
    svg = Diagram(SIMPLE, theme={"background": "#123456"}).to_svg()
    assert "#123456" in svg


def test_special_characters_survive():
    fc = Flowchart()
    fc.node("a", 'label with "quotes" & <angle>')
    svg = fc.to_svg()
    assert "quotes" in svg
    assert fc.warnings == []


def test_broken_source_warns_but_renders():
    d = Diagram("flowchart TD\n  a --> b\n  %%%% ??? not parseable ???\n  !!!")
    with pytest.warns(FloraSyntaxWarning, match="skipped"):
        svg = d.to_svg()
    assert svg.startswith("<svg")


def test_broken_source_strict_raises():
    d = Diagram("flowchart TD\n  a --> b\n  !!!", strict=True)
    with pytest.raises(FloraParseError) as excinfo:
        d.to_svg()
    assert any(w.severity == "error" for w in excinfo.value.warnings)


def test_unsupported_diagram_type_warns():
    d = Diagram("sequenceDiagram\n  A->>B: hi")
    with pytest.warns(FloraSyntaxWarning, match="sequenceDiagram"):
        svg = d.to_svg()
    assert "Unsupported diagram type" in svg


def test_unsupported_diagram_type_strict_raises():
    with pytest.raises(FloraParseError, match="sequenceDiagram"):
        Diagram("sequenceDiagram\n  A->>B: hi", strict=True).to_svg()


def test_warnings_property():
    ws = Diagram("flowchart TD\n  a --> b\n  !!!").warnings
    assert any(w.severity == "error" for w in ws)
    assert all({"line", "col", "message", "severity"} == set(vars(w)) for w in ws)


def test_clean_source_no_warnings():
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        svg = Diagram(SIMPLE).to_svg()
    assert svg.startswith("<svg")


def test_to_svg_file(tmp_path):
    path = Diagram(SIMPLE).to_svg_file(tmp_path / "out.svg")
    assert path.read_text(encoding="utf-8").startswith("<svg")
