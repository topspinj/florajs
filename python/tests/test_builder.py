import pytest

from florajs import Flowchart


def test_minimal_flowchart_source():
    fc = Flowchart("LR")
    fc.edge("a", "b")
    assert fc.source == "flowchart LR\n  a --> b\n"


def test_node_shapes_and_labels():
    fc = Flowchart()
    fc.node("a", "Start", shape="stadium")
    fc.node("b", "Store", shape="cylinder")
    fc.node("c", "Decide?", shape="diamond")
    fc.node("d", "Loop", shape="circle")
    fc.node("e", "Queue it", shape="queue")
    fc.node("f", "Round", shape="rounded")
    src = fc.source
    assert "a([Start])" in src
    assert "b[(Store)]" in src
    assert "c{Decide?}" in src
    assert "d((Loop))" in src
    assert "e[[Queue it]]" in src
    assert "f(Round)" in src


def test_bare_node_uses_id_as_label():
    fc = Flowchart()
    fc.node("solo")
    assert "\n  solo\n" in fc.source


def test_edge_styles_and_arrows():
    fc = Flowchart()
    fc.edge("a", "b", style="dotted")
    fc.edge("b", "c", style="thick")
    fc.edge("c", "d", arrow="open")
    fc.edge("d", "e", arrow="bidirectional")
    fc.edge("e", "f", "label", style="dotted", arrow="bidirectional")
    src = fc.source
    assert "a -.-> b" in src
    assert "b ==> c" in src
    assert "c --- d" in src
    assert "d <--> e" in src
    assert "e <-.->|label| f" in src


def test_edge_label():
    fc = Flowchart()
    fc.edge("a", "b", "yes")
    assert "a -->|yes| b" in fc.source


def test_chaining():
    fc = Flowchart()
    assert fc.node("a").edge("a", "b").link("a", "https://example.com") is fc


def test_subgraph_nesting():
    fc = Flowchart()
    with fc.subgraph("outer"):
        fc.node("a", "A")
        with fc.subgraph("inner"):
            fc.node("b", "B")
    fc.node("c", "C")
    src = fc.source
    assert "subgraph outer\n    a[A]\n    subgraph inner\n      b[B]\n    end\n  end" in src
    assert "\n  c[C]\n" in src  # outside any subgraph


def test_click_link_with_tooltip_and_target():
    fc = Flowchart()
    fc.node("a", "Docs", href="https://example.com", tooltip="open docs", target="_blank")
    assert 'click a "https://example.com" "open docs" _blank' in fc.source


def test_direction_validation():
    with pytest.raises(ValueError, match="direction"):
        Flowchart("XX")


@pytest.mark.parametrize("bad_id", ["a b", "a--b", "end", "subgraph", "LR", "a-", ""])
def test_invalid_ids_rejected(bad_id):
    fc = Flowchart()
    with pytest.raises(ValueError):
        fc.node(bad_id)


def test_kebab_case_id_allowed():
    fc = Flowchart()
    fc.node("my-node_1")
    assert "my-node_1" in fc.source


def test_unbalanced_label_rejected():
    fc = Flowchart()
    with pytest.raises(ValueError, match="unbalanced"):
        fc.node("a", "oops ] bracket")
    with pytest.raises(ValueError, match="unbalanced"):
        fc.node("b", "open ( paren", shape="rounded")


def test_balanced_nested_label_allowed():
    fc = Flowchart()
    fc.node("a", "has [nested] brackets")
    assert "a[has [nested] brackets]" in fc.source


def test_label_shape_collision_rejected():
    fc = Flowchart()
    with pytest.raises(ValueError, match="different node shape"):
        fc.node("a", "(starts with paren)")
    with pytest.raises(ValueError, match="different node shape"):
        fc.node("b", "[starts with bracket]", shape="rect")


def test_edge_label_pipe_rejected():
    fc = Flowchart()
    with pytest.raises(ValueError, match="pipe|[|]"):
        fc.edge("a", "b", "has | pipe")


def test_unsafe_link_rejected():
    fc = Flowchart()
    with pytest.raises(ValueError, match="unsafe"):
        fc.link("a", "javascript:alert(1)")


def test_link_quote_handling():
    fc = Flowchart()
    fc.link("a", "https://example.com", tooltip="it's fine")
    assert 'click a "https://example.com" "it\'s fine"' in fc.source
    with pytest.raises(ValueError, match="quotes"):
        fc.link("b", "https://example.com", tooltip="both \" and '")


def test_tooltip_without_href_rejected():
    fc = Flowchart()
    with pytest.raises(ValueError, match="href"):
        fc.node("a", tooltip="orphan")


def test_duplicate_subgraph_rejected():
    fc = Flowchart()
    with fc.subgraph("s"):
        pass
    with pytest.raises(ValueError, match="duplicate"):
        with fc.subgraph("s"):
            pass


def test_unknown_shape_and_style():
    fc = Flowchart()
    with pytest.raises(ValueError, match="shape"):
        fc.node("a", shape="blob")
    with pytest.raises(ValueError, match="style"):
        fc.edge("a", "b", style="wavy")
    with pytest.raises(ValueError, match="arrow"):
        fc.edge("a", "b", arrow="loopy")


def test_unknown_theme():
    with pytest.raises(ValueError, match="theme"):
        Flowchart(theme="neon")
