import html

from florajs import Diagram, Flowchart

SIMPLE = "flowchart TD\n  a[Start] --> b[End]\n"


def test_repr_html_is_iframe_embed():
    out = Diagram(SIMPLE)._repr_html_()
    assert out.startswith("<iframe srcdoc=")
    doc = html.unescape(out.split('srcdoc="', 1)[1].split('" style=', 1)[0])
    assert "var Flora=" in doc  # bundle inlined
    assert "Flora.render(" in doc
    assert "a[Start]" in doc


def test_repr_html_fixed_height():
    from florajs._notebook import notebook_html

    out = notebook_html(SIMPLE, "default", height=300)
    assert "height:300px" in out
    # fixed height: no auto-resize script
    assert "frameElement" not in html.unescape(out)


def test_to_html_standalone_document():
    doc = Flowchart().edge("a", "b").to_html()
    assert doc.startswith("<!DOCTYPE html>")
    assert "Flora.render(" in doc
    assert "flowchart TD" in doc


def test_to_html_file(tmp_path):
    path = Diagram(SIMPLE).to_html_file(tmp_path / "d.html")
    assert path.read_text(encoding="utf-8").startswith("<!DOCTYPE html>")


def test_theme_passed_to_render():
    doc = Diagram(SIMPLE, theme="digital").to_html()
    assert '"digital"' in doc
