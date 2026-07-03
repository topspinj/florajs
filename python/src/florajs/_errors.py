"""Errors and warnings surfaced by the Flora Python interface."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ParseWarning:
    """One diagnostic from the Flora parser.

    severity is "error" (the line could not be understood and was skipped)
    or "info" (the input was understood and deliberately ignored, e.g.
    Mermaid styling directives that Flora replaces with themes).
    """

    line: int
    col: int
    message: str
    severity: str

    def __str__(self) -> str:
        return f"line {self.line}: {self.message}"


class FloraParseError(ValueError):
    """Raised in strict mode when the input has error-severity diagnostics
    or uses a diagram type Flora does not support."""

    def __init__(self, message: str, warnings: list[ParseWarning] | None = None):
        super().__init__(message)
        self.warnings = warnings or []


class FloraSyntaxWarning(UserWarning):
    """Emitted (via warnings.warn) when a diagram renders with skipped lines.

    Flora never renders silently wrong output: if part of the input could not
    be parsed, the affected lines are dropped and this warning tells you so.
    Pass strict=True to raise FloraParseError instead.
    """
