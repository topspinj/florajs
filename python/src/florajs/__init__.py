"""Flora for Python — beautiful, interactive diagrams from Mermaid-compatible
syntax, rendered by the Flora JS library.

Quick start::

    from florajs import Flowchart

    fc = Flowchart("LR", theme="tufte")
    fc.node("raw", "Raw events", shape="cylinder")
    fc.node("clean", "Cleaned")
    fc.edge("raw", "clean", "dbt run")
    fc  # displays interactively in Jupyter
    fc.to_svg_file("pipeline.svg")

Or from raw Flora/Mermaid syntax::

    from florajs import Diagram

    Diagram('''
    flowchart TD
      a[Start] --> b{Decide}
      b -->|yes| c([Done])
    ''')
"""

from ._diagram import Diagram, Flowchart, THEMES
from ._errors import FloraParseError, FloraSyntaxWarning, ParseWarning

__version__ = "0.1.0"

__all__ = [
    "Diagram",
    "Flowchart",
    "THEMES",
    "FloraParseError",
    "FloraSyntaxWarning",
    "ParseWarning",
    "__version__",
]
