import type { ParseWarning } from "../types.js";

export type TokenType =
  | "keyword"
  | "direction"
  | "identifier"
  | "text"
  | "arrow"
  | "pipe_text"
  | "open_bracket"
  | "close_bracket"
  | "open_paren"
  | "close_paren"
  | "open_brace"
  | "close_brace"
  | "open_diamond"
  | "close_diamond"
  | "open_stadium"
  | "close_stadium"
  | "open_cylinder"
  | "close_cylinder"
  | "open_queue"
  | "close_queue"
  | "newline"
  | "eof";

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

export interface TokenizeResult {
  tokens: Token[];
  warnings: ParseWarning[];
}

const KEYWORDS = new Set(["flowchart", "graph", "subgraph", "end"]);
const DIRECTIONS = new Set(["TB", "TD", "BT", "LR", "RL"]);

// Mermaid directives Flora understands but deliberately does not act on.
// Styling is handled by themes; click bindings by the onNodeClick option.
const IGNORED_DIRECTIVES = new Map<string, string>([
  ["classDef", "styling directive — Flora handles styling through themes"],
  ["class", "styling directive — Flora handles styling through themes"],
  ["style", "styling directive — Flora handles styling through themes"],
  ["linkStyle", "styling directive — Flora handles styling through themes"],
  ["click", "click binding — use the onNodeClick option instead"],
  ["direction", "subgraph direction is not supported yet"],
]);

export function tokenize(input: string): TokenizeResult {
  const tokens: Token[] = [];
  const warnings: ParseWarning[] = [];
  let pos = 0;
  let line = 1;
  let col = 1;

  function peek(): string {
    return input[pos] ?? "";
  }

  function advance(): string {
    const ch = input[pos] ?? "";
    pos++;
    if (ch === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  }

  function skipWhitespace(): void {
    while (pos < input.length && (input[pos] === " " || input[pos] === "\t")) {
      advance();
    }
  }

  function skipComment(): boolean {
    if (input[pos] === "%" && input[pos + 1] === "%") {
      if (input[pos + 2] === "{") {
        warnings.push({
          line,
          col,
          message: "Mermaid init directives are ignored — use Flora themes instead",
          severity: "info",
        });
      }
      while (pos < input.length && input[pos] !== "\n") {
        advance();
      }
      return true;
    }
    return false;
  }

  function skipRestOfLine(): void {
    while (pos < input.length && input[pos] !== "\n") {
      advance();
    }
  }

  function atLineStart(): boolean {
    return tokens.length === 0 || tokens[tokens.length - 1]!.type === "newline";
  }

  function readWord(): string {
    let word = "";
    while (
      pos < input.length &&
      /[a-zA-Z0-9_-]/.test(input[pos]!)
    ) {
      // A hyphen can appear inside an id (kebab-case), but "--", "-." and "->"
      // start an arrow, as in "A-->B" written without spaces.
      if (
        input[pos] === "-" &&
        (input[pos + 1] === "-" || input[pos + 1] === "." || input[pos + 1] === ">")
      ) {
        break;
      }
      word += advance();
    }
    return word;
  }

  function readQuotedString(): string {
    const quote = advance();
    const startLine = line;
    const startCol = col;
    let str = "";
    while (pos < input.length && input[pos] !== quote && input[pos] !== "\n") {
      str += advance();
    }
    if (pos < input.length && input[pos] === quote) {
      advance();
    } else {
      warnings.push({
        line: startLine,
        col: startCol,
        message: `Unterminated string (expected closing ${quote})`,
        severity: "error",
      });
    }
    return str;
  }

  function readBracketedText(close: string): string {
    let text = "";
    let depth = 1;
    const open = input[pos - 1]!;
    const startLine = line;
    const startCol = col;
    while (pos < input.length && depth > 0) {
      if (input[pos] === "\n") {
        // Unterminated bracket on this line — stop and warn
        warnings.push({
          line: startLine,
          col: startCol,
          message: `Unterminated ${open}${close} (missing closing ${close})`,
          severity: "error",
        });
        break;
      }
      if (input[pos] === open) depth++;
      if (input[pos] === close) depth--;
      if (depth > 0) text += advance();
      else advance();
    }
    if (pos >= input.length && depth > 0) {
      warnings.push({
        line: startLine,
        col: startCol,
        message: `Unterminated ${open}${close} (missing closing ${close})`,
        severity: "error",
      });
    }
    return text;
  }

  while (pos < input.length) {
    skipWhitespace();
    if (pos >= input.length) break;

    const startLine = line;
    const startCol = col;
    const ch = peek();

    if (skipComment()) continue;

    if (ch === "\n" || ch === ";") {
      advance();
      tokens.push({ type: "newline", value: ch, line: startLine, col: startCol });
      continue;
    }

    if (ch === "-" || ch === "=" || ch === ".") {
      let arrow = "";
      while (pos < input.length && /[-=.>]/.test(input[pos]!)) {
        arrow += advance();
      }
      if (arrow.includes(">")) {
        tokens.push({ type: "arrow", value: arrow, line: startLine, col: startCol });
        continue;
      }
      tokens.push({ type: "identifier", value: arrow, line: startLine, col: startCol });
      continue;
    }

    if (ch === "|") {
      advance();
      let text = "";
      const pipeStartLine = line;
      const pipeStartCol = col;
      while (pos < input.length && input[pos] !== "|" && input[pos] !== "\n") {
        text += advance();
      }
      if (pos < input.length && input[pos] === "|") {
        advance();
      } else {
        warnings.push({
          line: pipeStartLine,
          col: pipeStartCol,
          message: "Unterminated edge label (missing closing |)",
          severity: "error",
        });
      }
      tokens.push({ type: "pipe_text", value: text, line: startLine, col: startCol });
      continue;
    }

    if (ch === "[") {
      advance();
      if (peek() === "[") {
        advance();
        const text = readBracketedText("]");
        if (peek() === "]") advance();
        tokens.push({ type: "open_queue", value: "[[", line: startLine, col: startCol });
        tokens.push({ type: "text", value: text, line: startLine, col: startCol + 2 });
        tokens.push({ type: "close_queue", value: "]]", line: startLine, col: col });
      } else if (peek() === "(") {
        advance();
        const text = readBracketedText(")");
        if (peek() === "]") advance();
        tokens.push({ type: "open_cylinder", value: "[(", line: startLine, col: startCol });
        tokens.push({ type: "text", value: text, line: startLine, col: startCol + 2 });
        tokens.push({ type: "close_cylinder", value: ")]", line: startLine, col: col });
      } else {
        const text = readBracketedText("]");
        tokens.push({ type: "open_bracket", value: "[", line: startLine, col: startCol });
        tokens.push({ type: "text", value: text, line: startLine, col: startCol + 1 });
        tokens.push({ type: "close_bracket", value: "]", line: startLine, col: col });
      }
      continue;
    }

    if (ch === "(") {
      advance();
      if (peek() === "[") {
        advance();
        const text = readBracketedText("]");
        if (peek() === ")") advance();
        tokens.push({ type: "open_stadium", value: "([", line: startLine, col: startCol });
        tokens.push({ type: "text", value: text, line: startLine, col: startCol + 2 });
        tokens.push({ type: "close_stadium", value: "])", line: startLine, col: col });
      } else {
        const text = readBracketedText(")");
        tokens.push({ type: "open_paren", value: "(", line: startLine, col: startCol });
        tokens.push({ type: "text", value: text, line: startLine, col: startCol + 1 });
        tokens.push({ type: "close_paren", value: ")", line: startLine, col: col });
      }
      continue;
    }

    if (ch === "{") {
      advance();
      const text = readBracketedText("}");
      tokens.push({ type: "open_brace", value: "{", line: startLine, col: startCol });
      tokens.push({ type: "text", value: text, line: startLine, col: startCol + 1 });
      tokens.push({ type: "close_brace", value: "}", line: startLine, col: col });
      continue;
    }

    if (ch === '"' || ch === "'") {
      const str = readQuotedString();
      tokens.push({ type: "text", value: str, line: startLine, col: startCol });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      const word = readWord();
      // A directive keyword at the start of a line is recognized and skipped,
      // unless it is immediately followed by a shape bracket (then it's a node id).
      if (
        atLineStart() &&
        IGNORED_DIRECTIVES.has(word) &&
        !/[[({]/.test(peek())
      ) {
        warnings.push({
          line: startLine,
          col: startCol,
          message: `'${word}' ignored: ${IGNORED_DIRECTIVES.get(word)}`,
          severity: "info",
        });
        skipRestOfLine();
        continue;
      }
      if (KEYWORDS.has(word)) {
        tokens.push({ type: "keyword", value: word, line: startLine, col: startCol });
      } else if (DIRECTIONS.has(word)) {
        tokens.push({ type: "direction", value: word, line: startLine, col: startCol });
      } else {
        tokens.push({ type: "identifier", value: word, line: startLine, col: startCol });
      }
      continue;
    }

    if (/[0-9]/.test(ch)) {
      const word = readWord();
      tokens.push({ type: "identifier", value: word, line: startLine, col: startCol });
      continue;
    }

    // Unknown character — skip it and warn
    const skipped = advance();
    warnings.push({
      line: startLine,
      col: startCol,
      message: `Unexpected character '${skipped}'`,
      severity: "error",
    });
  }

  tokens.push({ type: "eof", value: "", line, col });
  return { tokens, warnings };
}
