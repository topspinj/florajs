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
  | "newline"
  | "eof";

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

const KEYWORDS = new Set(["flowchart", "graph", "subgraph", "end"]);
const DIRECTIONS = new Set(["TB", "TD", "BT", "LR", "RL"]);

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
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
      while (pos < input.length && input[pos] !== "\n") {
        advance();
      }
      return true;
    }
    return false;
  }

  function readWord(): string {
    let word = "";
    while (
      pos < input.length &&
      /[a-zA-Z0-9_-]/.test(input[pos]!)
    ) {
      word += advance();
    }
    return word;
  }

  function readQuotedString(): string {
    const quote = advance();
    let str = "";
    while (pos < input.length && input[pos] !== quote) {
      str += advance();
    }
    if (pos < input.length) advance();
    return str;
  }

  function readBracketedText(close: string): string {
    let text = "";
    let depth = 1;
    const open = input[pos - 1]!;
    while (pos < input.length && depth > 0) {
      if (input[pos] === open) depth++;
      if (input[pos] === close) depth--;
      if (depth > 0) text += advance();
      else advance();
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

    if (ch === "\n") {
      advance();
      tokens.push({ type: "newline", value: "\n", line: startLine, col: startCol });
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
      while (pos < input.length && input[pos] !== "|") {
        text += advance();
      }
      if (pos < input.length) advance();
      tokens.push({ type: "pipe_text", value: text, line: startLine, col: startCol });
      continue;
    }

    if (ch === "[") {
      advance();
      const text = readBracketedText("]");
      tokens.push({ type: "open_bracket", value: "[", line: startLine, col: startCol });
      tokens.push({ type: "text", value: text, line: startLine, col: startCol + 1 });
      tokens.push({ type: "close_bracket", value: "]", line: startLine, col: col });
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

    advance();
  }

  tokens.push({ type: "eof", value: "", line, col });
  return tokens;
}
